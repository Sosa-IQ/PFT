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
        .select("id, date, merchant_name, category, amount, note, is_recurring")
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

    return query.execute().data or []
