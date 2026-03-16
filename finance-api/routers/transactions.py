"""
routers/transactions.py — Read transaction data.

Endpoints:
    GET /transactions   → List transactions with optional filters
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from supabase import Client

from middleware.auth import get_current_user, get_supabase_client

router = APIRouter(prefix="/transactions", tags=["transactions"])


# ---------------------------------------------------------------------------
# Response model
# ---------------------------------------------------------------------------

class Transaction(BaseModel):
    id: str
    date: str
    merchant_name: Optional[str] = None
    category: Optional[str] = None
    amount: float
    note: Optional[str] = None
    is_recurring: bool = False
    account_name: Optional[str] = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/", response_model=list[Transaction])
def list_transactions(
    category: Optional[str] = Query(None, description="Filter by category"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    limit: int = Query(50, ge=1, le=500, description="Max results to return"),
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    """
    Return a list of the user's transactions, newest first.
    All filters are optional and can be combined.
    """
    query = (
        supabase.table("transactions")
        .select("id, date, merchant_name, category, amount, note, is_recurring, accounts(account_name)")
        .eq("user_id", user["id"])
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
    # Supabase returns the joined accounts row as a nested dict.
    # Flatten it so the response model sees a plain account_name field.
    for row in rows:
        account = row.pop("accounts", None)
        row["account_name"] = (account or {}).get("account_name")
    return rows


@router.get("/categories", response_model=list[str])
def list_categories(
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    """Return all distinct non-null transaction categories for the user, sorted."""
    rows = (
        supabase.table("transactions")
        .select("category")
        .eq("user_id", user["id"])
        .not_.is_("category", "null")
        .execute()
        .data or []
    )
    seen = set()
    categories = []
    for row in rows:
        cat = (row.get("category") or "").strip()
        if cat and cat not in seen:
            seen.add(cat)
            categories.append(cat)
    return sorted(categories)
