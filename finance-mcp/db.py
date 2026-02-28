"""
db.py — Supabase client and all database query functions.

Every function takes user_id as its first argument so queries are always
scoped to a single user. We use the service role key here (bypasses RLS)
because this server runs on the backend — RLS is still enforced on the
web app's anon-key client as an additional safety net.
"""

import os
from datetime import date, datetime, timedelta, timezone
from collections import defaultdict
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------

def create_db_client() -> Client:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise ValueError(
            "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env"
        )
    return create_client(url, key)


# ---------------------------------------------------------------------------
# Transactions
# ---------------------------------------------------------------------------

def get_transactions(
    supabase: Client,
    user_id: str,
    category: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    limit: int = 50,
) -> list[dict]:
    """Return a filtered list of transactions, newest first."""
    query = (
        supabase.table("transactions")
        .select("id, date, merchant_name, category, amount, note, is_recurring, accounts(account_name)")
        .eq("user_id", user_id)
        .order("date", desc=True)
        .limit(limit)
    )
    if category:
        query = query.eq("category", category)
    if start_date:
        query = query.gte("date", start_date)
    if end_date:
        query = query.lte("date", end_date)

    rows = query.execute().data or []
    # Flatten the nested accounts join into a top-level account_name field.
    for row in rows:
        account = row.pop("accounts", None)
        row["account_name"] = (account or {}).get("account_name")
    return rows


def get_spending_by_category(
    supabase: Client,
    user_id: str,
    start_date: str,
    end_date: str,
) -> dict[str, float]:
    """
    Return {category: total_spent} for debits in the given date range.
    Positive amounts are debits (money out); negatives are credits — we
    only sum debits for a spending summary.
    """
    rows = (
        supabase.table("transactions")
        .select("category, amount")
        .eq("user_id", user_id)
        .gte("date", start_date)
        .lte("date", end_date)
        .execute()
        .data
        or []
    )

    totals: dict[str, float] = defaultdict(float)
    for row in rows:
        if row["amount"] > 0:  # debit only
            label = row["category"] or "Uncategorized"
            totals[label] += float(row["amount"])

    return dict(sorted(totals.items(), key=lambda x: x[1], reverse=True))


def get_spending_by_month(
    supabase: Client,
    user_id: str,
    start_date: str,
    end_date: str,
) -> dict[str, float]:
    """Return {YYYY-MM: total_spent} for debits in the date range."""
    rows = (
        supabase.table("transactions")
        .select("date, amount")
        .eq("user_id", user_id)
        .gte("date", start_date)
        .lte("date", end_date)
        .execute()
        .data
        or []
    )

    totals: dict[str, float] = defaultdict(float)
    for row in rows:
        if row["amount"] > 0:
            month_key = row["date"][:7]  # "YYYY-MM"
            totals[month_key] += float(row["amount"])

    return dict(sorted(totals.items()))


# ---------------------------------------------------------------------------
# Budgets
# ---------------------------------------------------------------------------

def get_budgets(supabase: Client, user_id: str) -> list[dict]:
    """Return all budgets for the user."""
    return (
        supabase.table("budgets")
        .select("category, monthly_limit")
        .eq("user_id", user_id)
        .order("category")
        .execute()
        .data
        or []
    )


def get_current_month_spend_by_category(
    supabase: Client, user_id: str
) -> dict[str, float]:
    """Return debits grouped by category for the current calendar month."""
    today = date.today()
    start = today.replace(day=1).isoformat()
    end = today.isoformat()
    return get_spending_by_category(supabase, user_id, start, end)


# ---------------------------------------------------------------------------
# Savings goals
# ---------------------------------------------------------------------------

def get_savings_goals(supabase: Client, user_id: str) -> list[dict]:
    """Return all savings goals for the user."""
    return (
        supabase.table("savings_goals")
        .select("name, target_amount, current_amount, deadline, created_at")
        .eq("user_id", user_id)
        .order("deadline", desc=False, nullsfirst=False)
        .execute()
        .data
        or []
    )


# ---------------------------------------------------------------------------
# Accounts & Liabilities (for net worth)
# ---------------------------------------------------------------------------

def get_accounts(supabase: Client, user_id: str) -> list[dict]:
    """Return all linked bank accounts with balances."""
    return (
        supabase.table("accounts")
        .select("account_name, account_type, institution_name, current_balance, currency")
        .eq("user_id", user_id)
        .execute()
        .data
        or []
    )


def get_liabilities(supabase: Client, user_id: str) -> list[dict]:
    """Return all tracked liabilities."""
    return (
        supabase.table("liabilities")
        .select("name, balance, apr, type, minimum_payment")
        .eq("user_id", user_id)
        .order("balance", desc=True)
        .execute()
        .data
        or []
    )


# ---------------------------------------------------------------------------
# Write: Budgets
# ---------------------------------------------------------------------------

def upsert_budget(
    supabase: Client, user_id: str, category: str, monthly_limit: float
) -> dict:
    """
    Create or replace a budget for the given category.
    Uses upsert so a single call handles both create and update.
    """
    return (
        supabase.table("budgets")
        .upsert(
            {"user_id": user_id, "category": category, "monthly_limit": monthly_limit},
            on_conflict="user_id,category",
        )
        .execute()
        .data[0]
    )


def get_budget_by_category(
    supabase: Client, user_id: str, category: str
) -> dict | None:
    """Return a single budget row for the given category, or None if not found."""
    rows = (
        supabase.table("budgets")
        .select("category, monthly_limit")
        .eq("user_id", user_id)
        .eq("category", category)
        .execute()
        .data
        or []
    )
    return rows[0] if rows else None


# ---------------------------------------------------------------------------
# Write: Savings Goals
# ---------------------------------------------------------------------------

def insert_savings_goal(
    supabase: Client,
    user_id: str,
    name: str,
    target_amount: float,
    deadline: str | None,
) -> dict:
    """Insert a new savings goal. Raises if a goal with the same name already exists."""
    row = {"user_id": user_id, "name": name, "target_amount": target_amount, "current_amount": 0.0}
    if deadline:
        row["deadline"] = deadline
    return (
        supabase.table("savings_goals")
        .insert(row)
        .execute()
        .data[0]
    )


def update_goal_current_amount(
    supabase: Client, user_id: str, name: str, current_amount: float
) -> dict | None:
    """
    Update the current_amount for a savings goal by name.
    Returns the updated row, or None if no matching goal was found.
    """
    rows = (
        supabase.table("savings_goals")
        .update({"current_amount": current_amount})
        .eq("user_id", user_id)
        .eq("name", name)
        .execute()
        .data
        or []
    )
    return rows[0] if rows else None


def get_goal_by_name(
    supabase: Client, user_id: str, name: str
) -> dict | None:
    """Return a single savings goal row by name, or None if not found."""
    rows = (
        supabase.table("savings_goals")
        .select("name, target_amount, current_amount, deadline")
        .eq("user_id", user_id)
        .eq("name", name)
        .execute()
        .data
        or []
    )
    return rows[0] if rows else None


# ---------------------------------------------------------------------------
# Write: Liabilities
# ---------------------------------------------------------------------------

def insert_liability(
    supabase: Client,
    user_id: str,
    name: str,
    balance: float,
    apr: float | None,
    liability_type: str | None,
    minimum_payment: float | None,
) -> dict:
    """Insert a new manually-tracked liability."""
    row: dict = {"user_id": user_id, "name": name, "balance": balance}
    if apr is not None:
        row["apr"] = apr
    if liability_type:
        row["type"] = liability_type
    if minimum_payment is not None:
        row["minimum_payment"] = minimum_payment
    return (
        supabase.table("liabilities")
        .insert(row)
        .execute()
        .data[0]
    )


def delete_liability_by_name(
    supabase: Client, user_id: str, name: str
) -> int:
    """
    Delete a liability by name.
    Returns the number of rows deleted (0 if not found, 1 if deleted).
    """
    rows = (
        supabase.table("liabilities")
        .delete()
        .eq("user_id", user_id)
        .eq("name", name)
        .execute()
        .data
        or []
    )
    return len(rows)


def get_liability_by_name(
    supabase: Client, user_id: str, name: str
) -> dict | None:
    """Return a single liability row by name, or None if not found."""
    rows = (
        supabase.table("liabilities")
        .select("name, balance, apr, type, minimum_payment")
        .eq("user_id", user_id)
        .eq("name", name)
        .execute()
        .data
        or []
    )
    return rows[0] if rows else None


# ---------------------------------------------------------------------------
# Write: Transactions
# ---------------------------------------------------------------------------

def update_transaction_category(
    supabase: Client, user_id: str, transaction_id: str, new_category: str
) -> dict | None:
    """
    Update the category (and clear any auto-assigned flag) for a transaction.
    Returns the updated row, or None if the transaction was not found.
    """
    rows = (
        supabase.table("transactions")
        .update({"category": new_category})
        .eq("user_id", user_id)
        .eq("id", transaction_id)
        .execute()
        .data
        or []
    )
    return rows[0] if rows else None


def get_transaction_by_id(
    supabase: Client, user_id: str, transaction_id: str
) -> dict | None:
    """Return a single transaction row by id, or None if not found."""
    rows = (
        supabase.table("transactions")
        .select("id, date, merchant_name, category, amount")
        .eq("user_id", user_id)
        .eq("id", transaction_id)
        .execute()
        .data
        or []
    )
    return rows[0] if rows else None


# ---------------------------------------------------------------------------
# OAuth / MCP auth tables
# ---------------------------------------------------------------------------

def _parse_dt(dt_str: str) -> datetime:
    """Parse an ISO 8601 datetime string, handling both +00:00 and Z suffixes."""
    return datetime.fromisoformat(dt_str.replace("Z", "+00:00"))


def get_oauth_client(supabase: Client, client_id: str) -> dict | None:
    """Return an OAuth client row by client_id, or None if not found."""
    rows = (
        supabase.table("oauth_clients")
        .select("*")
        .eq("client_id", client_id)
        .execute()
        .data
        or []
    )
    return rows[0] if rows else None


def save_oauth_client(supabase: Client, row: dict) -> None:
    """Insert a new OAuth client record."""
    supabase.table("oauth_clients").insert(row).execute()


def save_pending_request(supabase: Client, row: dict) -> None:
    """Insert a pending OAuth authorization request."""
    supabase.table("oauth_pending_requests").insert(row).execute()


def get_pending_request(supabase: Client, rid: str) -> dict | None:
    """Return a pending request by ID if it has not expired, else None."""
    rows = (
        supabase.table("oauth_pending_requests")
        .select("*")
        .eq("id", rid)
        .execute()
        .data
        or []
    )
    if not rows:
        return None
    row = rows[0]
    if datetime.now(timezone.utc) > _parse_dt(row["expires_at"]):
        return None
    return row


def expire_pending_request(supabase: Client, rid: str) -> None:
    """Mark a pending request as expired by back-dating its expires_at."""
    supabase.table("oauth_pending_requests").update(
        {"expires_at": (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat()}
    ).eq("id", rid).execute()


def save_auth_code(supabase: Client, row: dict) -> None:
    """Insert an OAuth authorization code."""
    supabase.table("oauth_auth_codes").insert(row).execute()


def get_auth_code(supabase: Client, code: str) -> dict | None:
    """Return an unused, unexpired authorization code row, or None."""
    rows = (
        supabase.table("oauth_auth_codes")
        .select("*")
        .eq("code", code)
        .eq("used", False)
        .execute()
        .data
        or []
    )
    if not rows:
        return None
    row = rows[0]
    if datetime.now(timezone.utc) > _parse_dt(row["expires_at"]):
        return None
    return row


def mark_auth_code_used(supabase: Client, code: str) -> None:
    """Mark an authorization code as used (prevents replay)."""
    supabase.table("oauth_auth_codes").update({"used": True}).eq("code", code).execute()


def save_mcp_session(supabase: Client, row: dict) -> None:
    """Insert a new MCP session containing access + refresh token hashes."""
    supabase.table("mcp_sessions").insert(row).execute()


def get_session_by_access_token_hash(supabase: Client, token_hash: str) -> dict | None:
    """Return a session by access_token_hash if not expired, else None."""
    rows = (
        supabase.table("mcp_sessions")
        .select("*")
        .eq("access_token_hash", token_hash)
        .execute()
        .data
        or []
    )
    if not rows:
        return None
    row = rows[0]
    if datetime.now(timezone.utc) > _parse_dt(row["access_token_expires_at"]):
        return None
    return row


def get_session_by_refresh_token_hash(supabase: Client, token_hash: str) -> dict | None:
    """Return a session by refresh_token_hash if not expired, else None."""
    rows = (
        supabase.table("mcp_sessions")
        .select("*")
        .eq("refresh_token_hash", token_hash)
        .execute()
        .data
        or []
    )
    if not rows:
        return None
    row = rows[0]
    if datetime.now(timezone.utc) > _parse_dt(row["refresh_token_expires_at"]):
        return None
    return row


def update_mcp_session_tokens(
    supabase: Client,
    session_id: str,
    new_access_hash: str,
    new_refresh_hash: str,
    access_expires_at: str,
    refresh_expires_at: str,
) -> None:
    """Rotate both token hashes in an existing session (called on refresh)."""
    supabase.table("mcp_sessions").update({
        "access_token_hash": new_access_hash,
        "refresh_token_hash": new_refresh_hash,
        "access_token_expires_at": access_expires_at,
        "refresh_token_expires_at": refresh_expires_at,
    }).eq("id", session_id).execute()


def delete_session_by_access_hash(supabase: Client, token_hash: str) -> None:
    """Delete the session row matching the given access token hash."""
    supabase.table("mcp_sessions").delete().eq("access_token_hash", token_hash).execute()


def delete_session_by_refresh_hash(supabase: Client, token_hash: str) -> None:
    """Delete the session row matching the given refresh token hash."""
    supabase.table("mcp_sessions").delete().eq("refresh_token_hash", token_hash).execute()


def delete_session_by_id(supabase: Client, session_id: str) -> None:
    """Delete a session by its primary key UUID."""
    supabase.table("mcp_sessions").delete().eq("id", session_id).execute()
