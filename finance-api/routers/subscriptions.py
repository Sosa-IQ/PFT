"""
routers/subscriptions.py — Subscription tier management and RevenueCat webhook handler.

Endpoints:
    GET  /subscriptions/me           → Current user's subscription info (creates free row if absent)
    POST /webhooks/revenuecat        → RevenueCat webhook (public, validated via shared secret)
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

logger = logging.getLogger(__name__)

router = APIRouter(tags=["subscriptions"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _stripe_value(obj, key: str):
    if isinstance(obj, dict):
        return obj.get(key)
    return getattr(obj, key, None)


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


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class SubscriptionInfo(BaseModel):
    tier: str                               # 'free' | 'pro'
    period_type: Optional[str]              # 'monthly' | 'annual' | None
    trial_ends_at: Optional[str]
    current_period_end: Optional[str]
    cancel_at_period_end: bool
    trial_eligible: bool                    # False once a Stripe subscription has ever been created


# ---------------------------------------------------------------------------
# GET /subscriptions/me
# ---------------------------------------------------------------------------

@router.get("/subscriptions/me", response_model=SubscriptionInfo, tags=["subscriptions"])
def get_my_subscription(
    user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase_client),
):
    """Return the current user's subscription. Creates a free-tier row if none exists."""
    user_id = user["id"]

    result = db.table("user_subscriptions").select("*").eq("user_id", user_id).limit(1).execute()
    rows = result.data or []

    if rows:
        row = rows[0]
    else:
        # First time — create a free record (upsert avoids race condition duplicate errors)
        insert = db.table("user_subscriptions").upsert({
            "user_id": user_id,
            "tier": "free",
        }, on_conflict="user_id", ignore_duplicates=True).execute()
        # Re-fetch in case ignore_duplicates swallowed the existing row
        refetch = db.table("user_subscriptions").select("*").eq("user_id", user_id).limit(1).execute()
        row = refetch.data[0]

    # A user is trial-eligible only if they have never had a Stripe subscription.
    # stripe_subscription_id is set as soon as the first subscription is created,
    # and is never cleared — so its presence means a prior subscription exists.
    trial_eligible = not bool(row.get("stripe_subscription_id"))

    # Backfill current_period_end from Stripe if it's missing.
    # This covers users who cancelled before this field was stored, and cases where
    # the Stripe webhook hasn't fired yet.
    #
    # Newer Stripe API versions can omit current_period_end from the top-level
    # subscription object, so the helper also checks cancel_at and subscription items.
    if row.get("stripe_subscription_id") and not row.get("current_period_end"):
        stripe_key = os.getenv("STRIPE_SECRET_KEY", "")
        if stripe_key:
            try:
                stripe.api_key = stripe_key
                sub = stripe.Subscription.retrieve(row["stripe_subscription_id"])
                period_end_ts = _subscription_period_end_ts(sub)

                if period_end_ts:
                    backfilled = datetime.fromtimestamp(period_end_ts, tz=timezone.utc).isoformat()
                    db.table("user_subscriptions").update({
                        "current_period_end": backfilled,
                        "updated_at": datetime.now(tz=timezone.utc).isoformat(),
                    }).eq("user_id", user_id).execute()
                    row["current_period_end"] = backfilled
                else:
                    logger.warning(
                        "Stripe subscription %s missing current_period_end. "
                        "Status: %s. Keys: %s",
                        row["stripe_subscription_id"],
                        sub.get("status"),
                        sorted(sub.keys()),
                    )
            except Exception as e:
                logger.warning("Failed to backfill current_period_end for user %s: %s", user_id, e)

    return SubscriptionInfo(
        tier=row["tier"],
        period_type=row.get("period_type"),
        trial_ends_at=row.get("trial_ends_at"),
        current_period_end=row.get("current_period_end"),
        cancel_at_period_end=row.get("cancel_at_period_end", False),
        trial_eligible=trial_eligible,
    )


# ---------------------------------------------------------------------------
# POST /webhooks/revenuecat
# ---------------------------------------------------------------------------

# Map RevenueCat event types to tier/period actions
_PRO_EVENTS = {"INITIAL_PURCHASE", "RENEWAL", "TRIAL_STARTED", "TRIAL_CONVERTED", "UNCANCELLATION"}
_FREE_EVENTS = {"CANCELLATION", "EXPIRATION", "TRIAL_CANCELLED", "BILLING_ISSUE"}

def _parse_period_type(product_id: str) -> Optional[str]:
    """Infer period from product identifier (e.g. 'budgitbuddy_pro_annual')."""
    pid = (product_id or "").lower()
    if "annual" in pid or "yearly" in pid:
        return "annual"
    if "monthly" in pid or "month" in pid:
        return "monthly"
    return None

@router.post("/webhooks/revenuecat", status_code=status.HTTP_200_OK, tags=["webhooks"])
async def revenuecat_webhook(
    request: Request,
    authorization: Optional[str] = Header(None),
    db: Client = Depends(get_supabase_client),
):
    """
    RevenueCat sends events here when subscription state changes.
    Validates via shared secret in the Authorization header.
    """
    # Validate shared secret
    secret = os.getenv("REVENUECAT_WEBHOOK_SECRET", "")
    # Accept either "Bearer <secret>" or just "<secret>" to handle both RC dashboard formats
    expected_bearer = f"Bearer {secret}"
    expected_raw = secret
    if not secret or authorization not in (expected_bearer, expected_raw):
        logger.warning("RC webhook auth failed. received=%r expected_bearer=%r", authorization, expected_bearer)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook secret")

    body = await request.json()
    event = body.get("event", {})
    event_type = event.get("type", "")
    app_user_id = event.get("app_user_id")  # We set this to the Supabase user UUID

    logger.info("RC webhook received: type=%s app_user_id=%s", event_type, app_user_id)

    if not app_user_id:
        # Nothing we can do without a user ID
        logger.warning("RevenueCat webhook missing app_user_id: %s", event_type)
        return {"received": True}

    product_id = event.get("product_id", "")
    rc_customer_id = event.get("id", "")

    # Calculate expiry timestamp
    expiry_ms = event.get("expiration_at_ms")
    current_period_end = (
        datetime.fromtimestamp(expiry_ms / 1000, tz=timezone.utc).isoformat()
        if expiry_ms else None
    )

    # Trial end
    trial_end_ms = event.get("trial_end_date_ms")
    trial_ends_at = (
        datetime.fromtimestamp(trial_end_ms / 1000, tz=timezone.utc).isoformat()
        if trial_end_ms else None
    )

    if event_type in _PRO_EVENTS:
        payload = {
            "user_id": app_user_id,
            "tier": "pro",
            "period_type": _parse_period_type(product_id),
            "current_period_end": current_period_end,
            "trial_ends_at": trial_ends_at,
            "cancel_at_period_end": False,
            "revenuecat_customer_id": rc_customer_id,
            "updated_at": datetime.now(tz=timezone.utc).isoformat(),
        }
        db.table("user_subscriptions").upsert(payload, on_conflict="user_id").execute()
        logger.info("Upgraded user %s to pro (%s)", app_user_id, event_type)

    elif event_type in _FREE_EVENTS:
        is_cancel = event_type == "CANCELLATION"
        payload = {
            "user_id": app_user_id,
            "tier": "free" if not is_cancel else "pro",  # CANCELLATION keeps pro until period_end
            "cancel_at_period_end": is_cancel,
            "current_period_end": current_period_end if is_cancel else None,
            "trial_ends_at": None,
            "updated_at": datetime.now(tz=timezone.utc).isoformat(),
        }
        db.table("user_subscriptions").upsert(payload, on_conflict="user_id").execute()
        logger.info("Subscription change for user %s: %s", app_user_id, event_type)

    else:
        logger.debug("Unhandled RevenueCat event type: %s", event_type)

    return {"received": True}
