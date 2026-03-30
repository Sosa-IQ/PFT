"""
services/sync_service.py — Pulls transactions from Plaid and upserts them into Supabase.

NOTE: The `accounts` table needs two extra columns not in the original schema.
Run this migration in your Supabase SQL editor before using this service:

    ALTER TABLE accounts ADD COLUMN IF NOT EXISTS plaid_item_id text;
    ALTER TABLE accounts ADD COLUMN IF NOT EXISTS sync_cursor text;

These are used to track the Plaid item and the incremental sync cursor per account.
"""

from supabase import Client

from services import plaid_service
from services.encryption import encrypt, decrypt


def sync_user_accounts(supabase: Client, user_id: str) -> dict:
    """
    Sync transactions for all linked accounts belonging to the user.
    Returns a summary of how many transactions were added/modified/removed.
    """
    # Fetch all accounts with a stored access token.
    rows = (
        supabase.table("accounts")
        .select("id, plaid_access_token, sync_cursor")
        .eq("user_id", user_id)
        .execute()
        .data
        or []
    )

    total_added = 0
    total_modified = 0
    total_removed = 0

    # Group accounts by access token so we only call Plaid's balance endpoint
    # once per Item (bank connection), not once per account.
    items: dict[str, list[dict]] = {}
    for account in rows:
        token = account["plaid_access_token"]
        items.setdefault(token, []).append(account)

    for encrypted_token, item_accounts in items.items():
        access_token = decrypt(encrypted_token)

        # Refresh balances for all accounts in this Item.
        try:
            fresh_accounts = plaid_service.get_accounts(access_token)
            balance_by_plaid_id = {a["plaid_account_id"]: a for a in fresh_accounts}
            for acct_row in item_accounts:
                plaid_acct = (
                    supabase.table("accounts")
                    .select("plaid_account_id")
                    .eq("id", acct_row["id"])
                    .single()
                    .execute()
                    .data
                )
                if plaid_acct and plaid_acct["plaid_account_id"] in balance_by_plaid_id:
                    fresh = balance_by_plaid_id[plaid_acct["plaid_account_id"]]
                    supabase.table("accounts").update({
                        "current_balance": fresh["current_balance"],
                        "available_balance": fresh["available_balance"],
                    }).eq("id", acct_row["id"]).execute()
        except Exception:
            pass  # Don't let a balance refresh failure abort the transaction sync

        for account in item_accounts:
            account_id = account["id"]
            cursor = account.get("sync_cursor")  # None on first sync

            result = _sync_single_account(supabase, user_id, account_id, access_token, cursor)
            total_added += result["added"]
            total_modified += result["modified"]
            total_removed += result["removed"]

    return {
        "added": total_added,
        "modified": total_modified,
        "removed": total_removed,
    }


def _sync_single_account(
    supabase: Client,
    user_id: str,
    account_id: str,
    access_token: str,
    cursor: str | None,
) -> dict:
    """Sync one account and persist the new cursor."""
    result = plaid_service.sync_transactions(access_token, cursor)

    # Upsert new and modified transactions.
    if result["added"] or result["modified"]:
        _upsert_transactions(supabase, user_id, account_id, result["added"] + result["modified"])

    # Remove deleted transactions.
    if result["removed"]:
        removed_ids = [t["transaction_id"] for t in result["removed"]]
        (
            supabase.table("transactions")
            .delete()
            .in_("plaid_transaction_id", removed_ids)
            .eq("user_id", user_id)
            .execute()
        )

    # Save the new cursor so the next sync only fetches the delta.
    (
        supabase.table("accounts")
        .update({"sync_cursor": result["next_cursor"]})
        .eq("id", account_id)
        .execute()
    )

    return {
        "added": len(result["added"]),
        "modified": len(result["modified"]),
        "removed": len(result["removed"]),
    }


def _upsert_transactions(
    supabase: Client,
    user_id: str,
    account_id: str,
    plaid_transactions: list,
) -> None:
    """
    Convert Plaid transaction objects to our schema and upsert them.
    Conflicts on plaid_transaction_id are updated in-place.
    """
    if not plaid_transactions:
        return

    rows = []
    for txn in plaid_transactions:
        # Plaid amounts: positive = debit (money out), negative = credit (money in).
        # This matches our schema convention — no conversion needed.
        rows.append({
            "user_id": user_id,
            "account_id": account_id,
            "plaid_transaction_id": txn["transaction_id"],
            "amount": float(txn["amount"]),
            "merchant_name": txn.get("merchant_name") or txn.get("name"),
            # Use Plaid's primary category as a starting point; users can recategorise later.
            "category": _plaid_category(txn),
            "plaid_category": _plaid_category(txn),
            "date": str(txn["date"]),
            "is_recurring": txn.get("recurring_transaction_id") is not None,
        })

    (
        supabase.table("transactions")
        .upsert(rows, on_conflict="plaid_transaction_id")
        .execute()
    )


def _plaid_category(txn: dict) -> str | None:
    """Extract a human-readable category string from a Plaid transaction."""
    # Plaid provides a `personal_finance_category` object in newer API versions.
    pfc = txn.get("personal_finance_category")
    if pfc:
        return pfc.get("primary")

    # Fall back to the older `category` array (e.g. ["Food and Drink", "Restaurants"]).
    categories = txn.get("category")
    if categories and isinstance(categories, list):
        return categories[0]

    return None
