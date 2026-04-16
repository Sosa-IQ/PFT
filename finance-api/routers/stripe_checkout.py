"""
routers/stripe_checkout.py — Stripe payment processing for web subscriptions.

Endpoints:
    POST /stripe/create-subscription   → Create Stripe customer + SetupIntent
    POST /stripe/create-portal-session → Create Stripe Customer Portal session
    POST /webhooks/stripe              → Stripe webhook handler (public, validated via signature)
"""

import os
import logging
from datetime import datetime, timezone
from typing import Optional

import stripe
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel
from supabase import Client

from middleware.auth import get_current_user, get_supabase_client
from services.revenuecat import sync_stripe_subscription

logger = logging.getLogger(__name__)

router = APIRouter(tags=["stripe"])

# Stripe is configured lazily (reads env at request time so the key can be set after import)


def _stripe_client() -> stripe.StripeClient:
    key = os.getenv("STRIPE_SECRET_KEY", "")
    if not key:
        raise HTTPException(status_code=503, detail="Payment processing is not configured.")
    return stripe.StripeClient(key)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_or_create_stripe_customer(
    client: stripe.StripeClient, db: Client, user_id: str, email: str
) -> str:
    """Return the Stripe customer ID for this user, creating one if needed."""
    result = (
        db.table("user_subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    existing = rows[0].get("stripe_customer_id") if rows else None
    if existing:
        client.customers.update(existing, params={"metadata": _stripe_metadata(user_id)})
        return existing

    customer = client.customers.create(
        params={"email": email, "metadata": _stripe_metadata(user_id)}
    )
    db.table("user_subscriptions").upsert(
        {"user_id": user_id, "stripe_customer_id": customer.id},
        on_conflict="user_id",
    ).execute()
    return customer.id


def _period_type_from_price(price_id: str) -> Optional[str]:
    if price_id == os.getenv("STRIPE_ANNUAL_PRICE_ID"):
        return "annual"
    if price_id == os.getenv("STRIPE_MONTHLY_PRICE_ID"):
        return "monthly"
    return None


def _stripe_value(obj, key: str):
    if isinstance(obj, dict):
        return obj.get(key)
    return getattr(obj, key, None)


def _stripe_get(obj, key: str):
    """Read a key from dicts and StripeObjects without assuming Mapping methods."""
    if not obj:
        return None
    if isinstance(obj, dict):
        return obj.get(key)
    try:
        return obj[key]
    except (KeyError, TypeError):
        return getattr(obj, key, None)


def _stripe_metadata(user_id: str) -> dict:
    """Metadata keys RevenueCat and our webhook can use to identify the app user."""
    return {"user_id": user_id, "app_user_id": user_id}


def _stripe_id(obj) -> Optional[str]:
    if isinstance(obj, str):
        return obj
    return _stripe_value(obj, "id")


def _subscription_period_end_ts(subscription) -> Optional[int]:
    period_end_ts = _stripe_value(subscription, "current_period_end")
    if period_end_ts:
        return period_end_ts

    cancel_at_ts = _stripe_value(subscription, "cancel_at")
    if cancel_at_ts:
        return cancel_at_ts

    items = _stripe_value(subscription, "items")
    item_data = _stripe_value(items, "data") or []
    item_period_ends = [
        _stripe_value(item, "current_period_end")
        for item in item_data
        if _stripe_value(item, "current_period_end")
    ]
    return min(item_period_ends) if item_period_ends else None


def _unused_subscription_item_credit_cents(subscription_item, now_ts: int) -> int:
    """Return the unused value of the current subscription item in cents."""
    period_start = _stripe_value(subscription_item, "current_period_start")
    period_end = _stripe_value(subscription_item, "current_period_end")
    price = _stripe_value(subscription_item, "price")
    unit_amount = _stripe_value(price, "unit_amount")

    if not period_start or not period_end or not unit_amount:
        return 0

    period_seconds = period_end - period_start
    remaining_seconds = max(0, period_end - now_ts)
    if period_seconds <= 0 or remaining_seconds <= 0:
        return 0

    return int((unit_amount * remaining_seconds + period_seconds // 2) // period_seconds)


def _annual_upgrade_params(
    subscription_item,
    annual_price_id: str,
    annual_currency: str,
    annual_product_id: str,
    now_ts: int,
) -> dict:
    unused_credit_cents = _unused_subscription_item_credit_cents(subscription_item, now_ts)
    params = {
        "items": [{"id": subscription_item.id, "price": annual_price_id}],
        "billing_cycle_anchor": "now",
        "proration_behavior": "none",
    }
    if unused_credit_cents:
        params["add_invoice_items"] = [{
            "price_data": {
                "currency": annual_currency,
                "product": annual_product_id,
                "unit_amount": -unused_credit_cents,
            },
            "metadata": {"description": "Credit for unused monthly subscription"},
        }]
    return params


def _subscription_has_active_trial(subscription, now_ts: int) -> bool:
    trial_end_ts = _stripe_value(subscription, "trial_end")
    return _stripe_value(subscription, "status") == "trialing" and bool(
        trial_end_ts and trial_end_ts > now_ts
    )


def _trial_plan_change_params(subscription_item, price_id: str) -> dict:
    return {
        "items": [{"id": subscription_item.id, "price": price_id}],
        "proration_behavior": "none",
    }


def _upsert_from_subscription(db: Client, subscription) -> Optional[str]:
    """Update user_subscriptions from a Stripe Subscription object (from a webhook event).
    Accepts both StripeObject (from webhook) and plain dict."""
    customer_id = _stripe_value(subscription, "customer")
    metadata = _stripe_value(subscription, "metadata") or {}
    user_id = _stripe_get(metadata, "app_user_id") or _stripe_get(metadata, "user_id")

    result = (
        db.table("user_subscriptions")
        .select("user_id")
        .eq("stripe_customer_id", customer_id)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    if rows:
        user_id = rows[0]["user_id"]

    if not user_id:
        logger.warning("Stripe webhook: no user found for customer %s", customer_id)
        return None

    items = _stripe_value(subscription, "items")
    item_data = _stripe_value(items, "data") or []
    first_item = item_data[0] if item_data else {}
    price = _stripe_value(first_item, "price") or {}
    price_id = _stripe_value(price, "id")
    sub_status = _stripe_value(subscription, "status")  # trialing, active, past_due, canceled, etc.
    cancel_at_period_end = _stripe_value(subscription, "cancel_at_period_end") or False

    trial_end_ts = _stripe_value(subscription, "trial_end")
    trial_ends_at = (
        datetime.fromtimestamp(trial_end_ts, tz=timezone.utc).isoformat()
        if trial_end_ts else None
    )

    period_end_ts = _subscription_period_end_ts(subscription)
    current_period_end = (
        datetime.fromtimestamp(period_end_ts, tz=timezone.utc).isoformat()
        if period_end_ts else None
    )

    # Active if subscription is running (trialing counts as active)
    is_active = sub_status in ("active", "trialing")
    if is_active or cancel_at_period_end:
        tier = "pro"
    else:
        tier = "free"

    upsert_data: dict = {
        "user_id": user_id,
        "tier": tier,
        "period_type": _period_type_from_price(price_id),
        "trial_ends_at": trial_ends_at,
        "cancel_at_period_end": cancel_at_period_end,
        "stripe_customer_id": customer_id,
        "stripe_subscription_id": _stripe_value(subscription, "id"),
        "updated_at": datetime.now(tz=timezone.utc).isoformat(),
    }
    # Only write current_period_end when Stripe provides it. Newer API versions may omit
    # this field from webhook payloads, and a null upsert would wipe out a previously
    # backfilled value.
    if current_period_end is not None:
        upsert_data["current_period_end"] = current_period_end

    db.table("user_subscriptions").upsert(upsert_data, on_conflict="user_id").execute()
    logger.info("Updated subscription for user %s: tier=%s status=%s", user_id, tier, sub_status)
    return user_id


# ---------------------------------------------------------------------------
# POST /stripe/create-subscription
# ---------------------------------------------------------------------------

class CreateSubscriptionRequest(BaseModel):
    plan: str  # 'monthly' | 'annual'


class CreateSubscriptionResponse(BaseModel):
    client_secret: str
    subscription_id: str
    has_trial: bool


@router.post(
    "/stripe/create-subscription",
    response_model=CreateSubscriptionResponse,
    tags=["stripe"],
)
async def create_subscription(
    body: CreateSubscriptionRequest,
    user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase_client),
):
    """
    Create a Stripe SetupIntent so the frontend can collect card details.
    The actual subscription is created only after card setup succeeds.
    """
    client = _stripe_client()

    price_id = (
        os.getenv("STRIPE_ANNUAL_PRICE_ID")
        if body.plan == "annual"
        else os.getenv("STRIPE_MONTHLY_PRICE_ID")
    )
    if not price_id:
        raise HTTPException(status_code=503, detail="Stripe price IDs are not configured.")

    user_id = user["id"]
    email = user.get("email", "")
    customer_id = _get_or_create_stripe_customer(client, db, user_id, email)

    # Check for any existing subscriptions to avoid creating duplicates.
    # Legacy trial subscriptions may still have a pending SetupIntent from the
    # old flow; reuse that intent so those users can finish adding a card.
    existing = client.subscriptions.list(params={
        "customer": customer_id,
        "limit": 10,
        "expand": ["data.pending_setup_intent"],
    })

    for sub in existing.data:
        if sub.status in ("active", "trialing"):
            psi = getattr(sub, "pending_setup_intent", None)
            if psi and getattr(psi, "client_secret", None):
                # Card not yet collected — reuse this subscription's setup intent
                logger.info("Reusing existing subscription %s for user %s", sub.id, user_id)
                sync_stripe_subscription(user_id, sub.id)
                return CreateSubscriptionResponse(
                    client_secret=psi.client_secret,
                    subscription_id=sub.id,
                    has_trial=sub.status == "trialing",
                )
            else:
                # User already has an active subscription with a payment method
                raise HTTPException(status_code=409, detail="already_subscribed")
        elif sub.status in ("incomplete", "incomplete_expired"):
            # Stale incomplete subscription — cancel it before creating a fresh one
            logger.info("Cancelling stale subscription %s for user %s", sub.id, user_id)
            client.subscriptions.cancel(sub.id, params={})

    # Determine whether this customer is eligible for a trial.
    # Anyone who has ever had a subscription (even a canceled one) must pay immediately.
    prior_subs = client.subscriptions.list(params={
        "customer": customer_id,
        "status": "canceled",
        "limit": 1,
    })
    had_prior_subscription = len(prior_subs.data) > 0

    setup_intent = client.setup_intents.create(params={
        "customer": customer_id,
        "usage": "off_session",
        "automatic_payment_methods": {"enabled": True},
        "metadata": _stripe_metadata(user_id),
    })
    client_secret = getattr(setup_intent, "client_secret", None)
    if not client_secret:
        logger.error("create_subscription: no client_secret on setup_intent for customer %s", customer_id)
        raise HTTPException(status_code=500, detail="Failed to initialize payment setup.")

    return CreateSubscriptionResponse(
        client_secret=client_secret,
        subscription_id="",
        has_trial=not had_prior_subscription,
    )


# ---------------------------------------------------------------------------
# POST /stripe/create-portal-session
# ---------------------------------------------------------------------------

class PortalSessionResponse(BaseModel):
    url: str


@router.post(
    "/stripe/create-portal-session",
    response_model=PortalSessionResponse,
    tags=["stripe"],
)
def create_portal_session(
    user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase_client),
):
    """Create a Stripe Customer Portal session for self-service subscription management."""
    client = _stripe_client()
    user_id = user["id"]

    result = (
        db.table("user_subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    customer_id = rows[0].get("stripe_customer_id") if rows else None

    if not customer_id:
        raise HTTPException(status_code=404, detail="No subscription found.")

    frontend_url = os.getenv("FRONTEND_URL", "https://budgitbuddy.com")
    session = client.billing_portal.sessions.create(
        params={
            "customer": customer_id,
            "return_url": f"{frontend_url}/billing",
        }
    )
    return PortalSessionResponse(url=session.url)


# ---------------------------------------------------------------------------
# Shared helper — look up the user's active subscription ID
# ---------------------------------------------------------------------------

def _get_subscription_id(db: Client, user_id: str) -> str:
    """Return the active Stripe subscription ID for a user.

    Checks the DB first. If the column is empty (e.g. subscriptions created before
    this column was added), falls back to listing subscriptions from Stripe via
    the stored customer ID and backfills the DB for future calls.
    """
    result = (
        db.table("user_subscriptions")
        .select("stripe_subscription_id, stripe_customer_id")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    row = rows[0] if rows else {}
    sub_id = row.get("stripe_subscription_id")

    if sub_id:
        return sub_id

    # Backfill: look up the active subscription from Stripe using the customer ID
    customer_id = row.get("stripe_customer_id")
    if not customer_id:
        raise HTTPException(status_code=404, detail="No active subscription found.")

    client = _stripe_client()
    existing = client.subscriptions.list(params={
        "customer": customer_id,
        "status": "all",
        "limit": 10,
    })
    active_sub = next(
        (s for s in existing.data if s.status in ("active", "trialing")),
        None,
    )
    if not active_sub:
        raise HTTPException(status_code=404, detail="No active subscription found.")

    # Persist so we don't need to hit Stripe again next time
    db.table("user_subscriptions").update(
        {"stripe_subscription_id": active_sub.id}
    ).eq("user_id", user_id).execute()
    logger.info("Backfilled stripe_subscription_id %s for user %s", active_sub.id, user_id)
    return active_sub.id


# ---------------------------------------------------------------------------
# POST /stripe/cancel-subscription
# ---------------------------------------------------------------------------

@router.post("/stripe/cancel-subscription", status_code=status.HTTP_200_OK, tags=["stripe"])
def cancel_subscription(
    user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase_client),
):
    """Schedule cancellation at the end of the current billing period."""
    client = _stripe_client()
    user_id = user["id"]
    sub_id = _get_subscription_id(db, user_id)

    client.subscriptions.update(sub_id, params={"cancel_at_period_end": True})

    # Re-fetch the subscription so Supabase can show the access-through date
    # immediately after scheduling cancellation.
    stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")
    sub = stripe.Subscription.retrieve(sub_id)
    period_end_ts = _subscription_period_end_ts(sub)
    current_period_end = (
        datetime.fromtimestamp(period_end_ts, tz=timezone.utc).isoformat()
        if period_end_ts else None
    )

    update_data = {
        "cancel_at_period_end": True,
        "updated_at": datetime.now(tz=timezone.utc).isoformat(),
    }
    if current_period_end is not None:
        update_data["current_period_end"] = current_period_end

    db.table("user_subscriptions").update(update_data).eq("user_id", user_id).execute()
    sync_stripe_subscription(user_id, sub_id)
    logger.info("Scheduled cancellation for user %s subscription %s", user_id, sub_id)
    return {"ok": True}


# ---------------------------------------------------------------------------
# POST /stripe/reactivate-subscription
# ---------------------------------------------------------------------------

@router.post("/stripe/reactivate-subscription", status_code=status.HTTP_200_OK, tags=["stripe"])
def reactivate_subscription(
    user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase_client),
):
    """Remove a scheduled cancellation, keeping the subscription active."""
    client = _stripe_client()
    user_id = user["id"]
    sub_id = _get_subscription_id(db, user_id)

    client.subscriptions.update(sub_id, params={"cancel_at_period_end": False})

    db.table("user_subscriptions").update(
        {"cancel_at_period_end": False, "updated_at": datetime.now(tz=timezone.utc).isoformat()}
    ).eq("user_id", user_id).execute()
    sync_stripe_subscription(user_id, sub_id)
    logger.info("Reactivated subscription for user %s", user_id)
    return {"ok": True}


# ---------------------------------------------------------------------------
# POST /stripe/activate-subscription
# ---------------------------------------------------------------------------
#
# Called by the frontend after a subscriber confirms their card via SetupIntent.
# Creates the actual subscription using the saved payment method; first-time
# subscribers receive the 7-day trial here, after card collection.

class ActivateSubscriptionRequest(BaseModel):
    plan: str  # 'monthly' | 'annual'


@router.post("/stripe/activate-subscription", status_code=status.HTTP_200_OK, tags=["stripe"])
def activate_subscription(
    body: ActivateSubscriptionRequest,
    user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase_client),
):
    """Create a subscription after card setup succeeds."""
    client = _stripe_client()
    user_id = user["id"]

    price_id = (
        os.getenv("STRIPE_ANNUAL_PRICE_ID")
        if body.plan == "annual"
        else os.getenv("STRIPE_MONTHLY_PRICE_ID")
    )
    if not price_id:
        raise HTTPException(status_code=503, detail="Stripe price IDs are not configured.")

    customer_id = _get_or_create_stripe_customer(client, db, user_id, user.get("email", ""))

    # Idempotency: if the customer already has an active/trialing subscription, nothing to do.
    existing = client.subscriptions.list(params={"customer": customer_id, "limit": 5})
    active_subscription = next((s for s in existing.data if s.status in ("active", "trialing")), None)
    if active_subscription:
        logger.info("activate_subscription: user %s already has an active subscription", user_id)
        _upsert_from_subscription(db, active_subscription)
        sync_stripe_subscription(user_id, active_subscription.id)
        return {"ok": True}

    prior_subs = client.subscriptions.list(params={
        "customer": customer_id,
        "status": "canceled",
        "limit": 1,
    })
    had_prior_subscription = len(existing.data) > 0 or len(prior_subs.data) > 0

    # Use the most recently created payment method attached to this customer.
    pms = client.payment_methods.list(params={"customer": customer_id, "limit": 1})
    if not pms.data:
        raise HTTPException(status_code=400, detail="No payment method found. Please complete payment setup.")
    pm_id = pms.data[0].id

    # Set it as the customer's default so the subscription invoice auto-charges.
    client.customers.update(
        customer_id,
        params={"invoice_settings": {"default_payment_method": pm_id}},
    )

    subscription_params = {
        "customer": customer_id,
        "items": [{"price": price_id}],
        "default_payment_method": pm_id,
        "payment_settings": {"save_default_payment_method": "on_subscription"},
        "metadata": _stripe_metadata(user_id),
    }
    if not had_prior_subscription:
        subscription_params["trial_period_days"] = 7

    subscription = client.subscriptions.create(params=subscription_params)

    _upsert_from_subscription(db, subscription)
    sync_stripe_subscription(user_id, subscription.id)
    logger.info("activate_subscription: created sub %s for user %s", subscription.id, user_id)
    return {"ok": True}


# ---------------------------------------------------------------------------
# POST /stripe/change-plan
# ---------------------------------------------------------------------------

class ChangePlanRequest(BaseModel):
    plan: str  # 'monthly' | 'annual'


@router.post("/stripe/change-plan", status_code=status.HTTP_200_OK, tags=["stripe"])
def change_plan(
    body: ChangePlanRequest,
    user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase_client),
):
    """Switch the subscription between monthly and annual billing."""
    if body.plan not in ("monthly", "annual"):
        raise HTTPException(status_code=400, detail="Invalid billing plan.")

    client = _stripe_client()
    user_id = user["id"]

    new_price_id = (
        os.getenv("STRIPE_ANNUAL_PRICE_ID")
        if body.plan == "annual"
        else os.getenv("STRIPE_MONTHLY_PRICE_ID")
    )
    if not new_price_id:
        raise HTTPException(status_code=503, detail="Stripe price IDs are not configured.")

    sub_id = _get_subscription_id(db, user_id)
    subscription = client.subscriptions.retrieve(sub_id)
    subscription_item = subscription.items.data[0]
    now_ts = int(datetime.now(tz=timezone.utc).timestamp())

    if _stripe_value(subscription, "cancel_at_period_end"):
        raise HTTPException(
            status_code=400,
            detail="Reactivate your subscription before switching billing plans.",
        )

    if _subscription_has_active_trial(subscription, now_ts):
        update_params = _trial_plan_change_params(subscription_item, new_price_id)
    elif body.plan == "annual":
        annual_price = client.v1.prices.retrieve(new_price_id)
        annual_product_id = _stripe_id(annual_price.product)
        if not annual_product_id:
            raise HTTPException(status_code=500, detail="Stripe annual product is not configured.")
        update_params = _annual_upgrade_params(
            subscription_item,
            new_price_id,
            annual_price.currency,
            annual_product_id,
            now_ts,
        )
    else:
        raise HTTPException(
            status_code=400,
            detail="Switching to monthly billing is only available during an active trial.",
        )

    updated_subscription = client.subscriptions.update(sub_id, params=update_params)
    _upsert_from_subscription(db, updated_subscription)

    sync_stripe_subscription(user_id, sub_id)
    logger.info("Changed plan for user %s to %s", user_id, body.plan)
    return {"ok": True}


# ---------------------------------------------------------------------------
# GET /stripe/change-plan-preview
# ---------------------------------------------------------------------------

class ChangePlanPreviewResponse(BaseModel):
    amount_due: float
    invoice_total: float
    unused_monthly_credit: float
    applied_balance_credit: float
    currency: str


@router.get("/stripe/change-plan-preview", response_model=ChangePlanPreviewResponse, tags=["stripe"])
def preview_change_plan(
    plan: str,
    user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase_client),
):
    """Return the prorated charge the user would owe if they switch to annual billing now."""
    if plan != "annual":
        raise HTTPException(status_code=400, detail="Only upgrades to annual billing are supported.")

    client = _stripe_client()
    user_id = user["id"]

    new_price_id = os.getenv("STRIPE_ANNUAL_PRICE_ID")
    if not new_price_id:
        raise HTTPException(status_code=503, detail="Stripe price IDs are not configured.")

    sub_id = _get_subscription_id(db, user_id)
    subscription = client.subscriptions.retrieve(sub_id)
    subscription_item = subscription.items.data[0]
    annual_price = client.v1.prices.retrieve(new_price_id)
    annual_product_id = _stripe_id(annual_price.product)
    if not annual_product_id:
        raise HTTPException(status_code=500, detail="Stripe annual product is not configured.")
    now_ts = int(datetime.now(tz=timezone.utc).timestamp())
    if _subscription_has_active_trial(subscription, now_ts):
        subscription_details = _trial_plan_change_params(subscription_item, new_price_id)
    else:
        subscription_details = _annual_upgrade_params(
            subscription_item,
            new_price_id,
            annual_price.currency,
            annual_product_id,
            now_ts,
        )
    invoice_items = subscription_details.pop("add_invoice_items", None)
    unused_monthly_credit_cents = (
        -invoice_items[0]["price_data"]["unit_amount"] if invoice_items else 0
    )

    preview_params = {
        "customer": subscription.customer,
        "subscription": sub_id,
        "subscription_details": subscription_details,
    }
    if invoice_items:
        credit_item = invoice_items[0]
        preview_params["invoice_items"] = [{
            "amount": credit_item["price_data"]["unit_amount"],
            "currency": credit_item["price_data"]["currency"],
            "description": credit_item.get("metadata", {}).get("description"),
        }]

    upcoming = client.v1.invoices.create_preview(params=preview_params)

    return ChangePlanPreviewResponse(
        amount_due=upcoming.amount_due / 100,
        invoice_total=upcoming.total / 100,
        unused_monthly_credit=unused_monthly_credit_cents / 100,
        applied_balance_credit=max(0, upcoming.total - upcoming.amount_due) / 100,
        currency=upcoming.currency,
    )


# ---------------------------------------------------------------------------
# POST /webhooks/stripe
# ---------------------------------------------------------------------------

@router.post("/webhooks/stripe", status_code=status.HTTP_200_OK, tags=["webhooks"])
async def stripe_webhook(
    request: Request,
    stripe_signature: Optional[str] = Header(None),
    db: Client = Depends(get_supabase_client),
):
    """
    Stripe sends events here when subscription state changes.
    Validated via the Stripe-Signature header using the webhook signing secret.
    """
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET", "")
    if not webhook_secret:
        raise HTTPException(status_code=503, detail="Webhook secret not configured.")

    payload = await request.body()
    try:
        event = stripe.Webhook.construct_event(payload, stripe_signature, webhook_secret)
    except stripe.SignatureVerificationError:
        logger.warning("Stripe webhook signature verification failed")
        raise HTTPException(status_code=400, detail="Invalid signature")

    event_type = event["type"]
    data = event["data"]["object"]
    logger.info("Stripe webhook received: %s", event_type)

    if event_type in ("customer.subscription.created", "customer.subscription.updated"):
        user_id = _upsert_from_subscription(db, data)
        if user_id:
            sync_stripe_subscription(user_id, _stripe_value(data, "id"))

    elif event_type == "customer.subscription.deleted":
        customer_id = _stripe_value(data, "customer")
        metadata = _stripe_value(data, "metadata") or {}
        result = (
            db.table("user_subscriptions")
            .select("user_id")
            .eq("stripe_customer_id", customer_id)
            .limit(1)
            .execute()
        )
        rows = result.data or []
        user_id = (
            rows[0]["user_id"]
            if rows
            else _stripe_get(metadata, "app_user_id") or _stripe_get(metadata, "user_id")
        )
        if user_id:
            db.table("user_subscriptions").upsert(
                {
                    "user_id": user_id,
                    "tier": "free",
                    "period_type": None,
                    "trial_ends_at": None,
                    "current_period_end": None,
                    "cancel_at_period_end": False,
                    "stripe_customer_id": customer_id,
                    "stripe_subscription_id": _stripe_value(data, "id"),
                    "updated_at": datetime.now(tz=timezone.utc).isoformat(),
                },
                on_conflict="user_id",
            ).execute()
            sync_stripe_subscription(user_id, _stripe_value(data, "id"))
            logger.info("Downgraded user %s to free (subscription deleted)", user_id)

    else:
        logger.debug("Unhandled Stripe event: %s", event_type)

    return {"received": True}
