"""
db.py — Supabase client and all database query functions.

Every function takes user_id as its first argument so queries are always
scoped to a single user. We use the service role key here (bypasses RLS)
because this server runs on the backend — RLS is still enforced on the
web app's anon-key client as an additional safety net.
"""

import os
from datetime import date, datetime
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
