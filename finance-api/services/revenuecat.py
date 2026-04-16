"""
services/revenuecat.py — small server-side bridge for RevenueCat web purchases.

Stripe remains the web billing provider. RevenueCat receives Stripe subscription
tokens so the same app_user_id unlocks entitlements on web and mobile.
"""

import json
import logging
import os
import time
from typing import Optional
from urllib import error, request

logger = logging.getLogger(__name__)

REVENUECAT_API_BASE = "https://api.revenuecat.com/v1"
RETRYABLE_HTTP_CODES = {429, 500, 502, 503, 504, 529}
RETRY_DELAYS_SECONDS = (1, 2, 4)


def _api_key() -> Optional[str]:
    """Return the RevenueCat app API key used for Stripe receipt posts."""
    return (
        os.getenv("REVENUECAT_STRIPE_PUBLIC_API_KEY")
        or os.getenv("REVENUECAT_PUBLIC_API_KEY")
        or os.getenv("REVENUECAT_API_KEY")
    )


def _post(path: str, payload: dict, *, platform: Optional[str] = None) -> None:
    key = _api_key()
    if not key:
        raise RuntimeError(
            "RevenueCat API key is not configured. Set REVENUECAT_STRIPE_PUBLIC_API_KEY."
        )

    body = json.dumps(payload).encode("utf-8")
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "User-Agent": "budgitbuddy-api/1.0",
    }
    if platform:
        headers["X-Platform"] = platform

    req = request.Request(
        f"{REVENUECAT_API_BASE}{path}",
        data=body,
        headers=headers,
        method="POST",
    )

    with request.urlopen(req, timeout=10) as response:
        if response.status >= 400:
            raise RuntimeError(f"RevenueCat API returned HTTP {response.status}")


def _retry_delay(exc: error.HTTPError, attempt_index: int) -> int:
    retry_after = exc.headers.get("Retry-After") if exc.headers else None
    if retry_after:
        try:
            return max(1, min(int(retry_after), 10))
        except ValueError:
            pass
    return RETRY_DELAYS_SECONDS[attempt_index]


def sync_stripe_subscription(
    app_user_id: str,
    stripe_subscription_id: str,
    *,
    raise_on_error: bool = False,
) -> bool:
    """Register a Stripe subscription receipt with RevenueCat.

    Returns True when the subscription was posted. Missing configuration and
    API failures are logged and return False unless raise_on_error is True.
    """
    if not app_user_id or not stripe_subscription_id:
        logger.warning(
            "Skipping RevenueCat sync; app_user_id=%r subscription_id=%r",
            app_user_id,
            stripe_subscription_id,
        )
        return False

    last_http_error: Optional[error.HTTPError] = None

    for attempt in range(len(RETRY_DELAYS_SECONDS) + 1):
        try:
            _post(
                "/receipts",
                {"app_user_id": app_user_id, "fetch_token": stripe_subscription_id},
                platform="stripe",
            )
            break
        except error.HTTPError as exc:
            last_http_error = exc
            detail = exc.read().decode("utf-8", errors="replace")
            can_retry = exc.code in RETRYABLE_HTTP_CODES and attempt < len(RETRY_DELAYS_SECONDS)
            if can_retry:
                delay = _retry_delay(exc, attempt)
                logger.warning(
                    "RevenueCat Stripe sync retrying for user %s subscription %s after HTTP %s %s",
                    app_user_id,
                    stripe_subscription_id,
                    exc.code,
                    detail,
                )
                time.sleep(delay)
                continue

            logger.warning(
                "RevenueCat Stripe sync failed for user %s subscription %s: HTTP %s %s",
                app_user_id,
                stripe_subscription_id,
                exc.code,
                detail,
            )
            if raise_on_error:
                raise
            return False
        except (RuntimeError, error.URLError) as exc:
            logger.warning(
                "RevenueCat Stripe sync failed for user %s subscription %s: %s",
                app_user_id,
                stripe_subscription_id,
                exc,
            )
            if raise_on_error:
                raise
            return False
    else:
        if raise_on_error and last_http_error:
            raise last_http_error
        return False

    logger.info(
        "Synced Stripe subscription %s to RevenueCat for user %s",
        stripe_subscription_id,
        app_user_id,
    )
    return True
