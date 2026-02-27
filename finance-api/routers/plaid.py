"""
routers/plaid.py — Plaid Link flow endpoints.

Endpoints:
    POST /plaid/link-token      → Create a Plaid Link token (frontend uses this to open Link UI)
    POST /plaid/exchange-token  → Exchange public_token for access_token; upsert accounts; initial sync
    POST /plaid/sync            → Manually trigger a transaction sync for all user accounts
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from supabase import Client

from middleware.auth import get_current_user, get_supabase_client
from services import plaid_service, sync_service
from services.encryption import encrypt

router = APIRouter(prefix="/plaid", tags=["plaid"])


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class ExchangeTokenRequest(BaseModel):
    public_token: str


class LinkTokenResponse(BaseModel):
    link_token: str


class SyncResponse(BaseModel):
    added: int
    modified: int
    removed: int


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/link-token", response_model=LinkTokenResponse)
def create_link_token(
    user: dict = Depends(get_current_user),
):
    """
    Step 1 of the Plaid Link flow.
    Returns a short-lived link_token the frontend uses to open Plaid's bank-connection UI.
    """
    try:
        link_token = plaid_service.create_link_token(user["id"])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Plaid error: {e}",
        )
    return {"link_token": link_token}


@router.post("/exchange-token", status_code=status.HTTP_201_CREATED)
def exchange_token(
    body: ExchangeTokenRequest,
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    """
    Step 2 of the Plaid Link flow.
    Exchanges the one-time public_token for a permanent access_token, stores all linked
    bank accounts in Supabase, and runs an initial transaction sync.
    """
    try:
        exchanged = plaid_service.exchange_public_token(body.public_token)
        access_token = exchanged["access_token"]
        item_id = exchanged["item_id"]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Plaid token exchange failed: {e}",
        )

    # Fetch account details (name, type, balances) for each account in this item.
    try:
        accounts = plaid_service.get_accounts(access_token)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Plaid accounts fetch failed: {e}",
        )

    # Upsert each account into Supabase. We store the encrypted access_token on each
    # row so the sync service can fetch it per-account without a separate join table.
    encrypted_token = encrypt(access_token)
    upserted_ids = []

    for acct in accounts:
        row = {
            "user_id": user["id"],
            "plaid_account_id": acct["plaid_account_id"],
            "plaid_access_token": encrypted_token,
            "plaid_item_id": item_id,
            "account_name": acct["account_name"],
            "account_type": acct["account_type"],
            "current_balance": acct["current_balance"],
            "available_balance": acct["available_balance"],
            "currency": acct["currency"],
        }
        result = (
            supabase.table("accounts")
            .upsert(row, on_conflict="plaid_account_id")
            .execute()
        )
        if result.data:
            upserted_ids.append(result.data[0]["id"])

    # Run initial transaction sync in-process.
    # For large transaction histories this can be slow; in production you'd
    # offload this to a background task (e.g. FastAPI BackgroundTasks or a queue).
    try:
        sync_result = sync_service.sync_user_accounts(supabase, user["id"])
    except Exception as e:
        # Don't fail the whole request if sync has an error — accounts are already saved.
        sync_result = {"added": 0, "modified": 0, "removed": 0, "error": str(e)}

    return {
        "accounts_connected": len(upserted_ids),
        "transactions_synced": sync_result,
    }


@router.post("/sync", response_model=SyncResponse)
def sync_transactions(
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    """
    Manually trigger a transaction sync for all of the user's connected accounts.
    Uses the stored cursor for each account to only fetch new/changed transactions.
    """
    try:
        result = sync_service.sync_user_accounts(supabase, user["id"])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Sync failed: {e}",
        )
    return result
