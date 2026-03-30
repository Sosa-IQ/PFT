"""
routers/budgets.py — CRUD for budgets and budget lines.

A budget is a named plan with a date range.
Each budget contains income and expense lines.

Lines can optionally link to one or more transaction categories.
When categories are linked, computed_actual is calculated from matching
transactions within the budget's date range (for progress tracking).
Users can exclude individual transactions from being tracked per line.

Endpoints:
    GET    /budgets/                                                    → List all budgets
    POST   /budgets/                                                    → Create a budget
    GET    /budgets/{id}                                                → Get a budget
    PUT    /budgets/{id}                                                → Update a budget
    DELETE /budgets/{id}                                                → Delete a budget
    GET    /budgets/{id}/lines                                          → List lines with computed actuals
    POST   /budgets/{id}/lines                                          → Add a line
    PATCH  /budgets/{id}/lines/reorder                                  → Bulk-update sort_order
    PUT    /budgets/{id}/lines/{line_id}                                → Update a line
    DELETE /budgets/{id}/lines/{line_id}                                → Delete a line
    POST   /budgets/{id}/lines/{line_id}/excluded-transactions          → Exclude a transaction
    DELETE /budgets/{id}/lines/{line_id}/excluded-transactions/{txn_id} → Re-include a transaction
"""

from datetime import date, timedelta
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from supabase import Client

from middleware.auth import get_current_user, get_supabase_client

router = APIRouter(prefix="/budgets", tags=["budgets"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _current_period(date_range_type: str, start_date, end_date) -> tuple[str, str]:
    """Return (start, end) ISO date strings for the budget's active period."""
    today = date.today()
    if date_range_type == "custom":
        return str(start_date), str(end_date)
    elif date_range_type == "weekly":
        week_start = today - timedelta(days=today.weekday())
        return str(week_start), str(week_start + timedelta(days=6))
    elif date_range_type == "biweekly":
        return str(today - timedelta(days=13)), str(today)
    else:  # monthly
        month_start = today.replace(day=1)
        if today.month == 12:
            month_end = today.replace(day=31)
        else:
            month_end = today.replace(month=today.month + 1, day=1) - timedelta(days=1)
        return str(month_start), str(month_end)


def _compute_actuals(lines: list[dict], transactions: list[dict]) -> None:
    """Mutate each line dict in-place, setting computed_actual from transactions.

    Transactions listed in the line's excluded_transaction_ids are skipped.
    """
    for line in lines:
        cats = line.get("categories") or []
        cats_lower = {c.strip().lower() for c in cats if c}
        if not cats_lower:
            line["computed_actual"] = None
            continue
        excluded = set(line.get("excluded_transaction_ids") or [])
        if line["line_type"] == "expense":
            # Positive amounts = debits (expenses)
            total = sum(
                t["amount"] for t in transactions
                if (t.get("category") or "").lower() in cats_lower
                and t["amount"] > 0
                and t["id"] not in excluded
            )
        else:
            # Negative amounts = credits (income) — take absolute value
            total = abs(sum(
                t["amount"] for t in transactions
                if (t.get("category") or "").lower() in cats_lower
                and t["amount"] < 0
                and t["id"] not in excluded
            ))
        line["computed_actual"] = round(total, 2)


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class BudgetCreate(BaseModel):
    name: str = Field(..., min_length=1)
    date_range_type: Literal["custom", "weekly", "biweekly", "monthly"] = "monthly"
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class BudgetUpdate(BaseModel):
    name: Optional[str] = None
    date_range_type: Optional[Literal["custom", "weekly", "biweekly", "monthly"]] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class BudgetOut(BaseModel):
    id: str
    name: str
    date_range_type: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    created_at: str
    balance: Optional[float] = None


class BudgetLineCreate(BaseModel):
    line_type: Literal["income", "expense"]
    name: str = Field(..., min_length=1)
    categories: Optional[list[str]] = None  # links to tracked transaction categories
    planned_amount: float = Field(..., ge=0)


class BudgetLineUpdate(BaseModel):
    name: Optional[str] = None
    categories: Optional[list[str]] = None
    planned_amount: Optional[float] = None


class LineOrderItem(BaseModel):
    id: str
    sort_order: int


class BudgetLineOut(BaseModel):
    id: str
    budget_id: str
    line_type: str
    name: str
    categories: list[str] = []
    planned_amount: float
    sort_order: Optional[int] = None
    computed_actual: Optional[float] = None  # auto-calculated from transactions
    excluded_transaction_ids: list[str] = []  # transactions excluded from tracking


# ---------------------------------------------------------------------------
# Budget Endpoints
# ---------------------------------------------------------------------------

@router.get("/", response_model=list[BudgetOut])
def list_budgets(
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    """Return all budgets for the authenticated user, newest first, with computed balance."""
    budgets = (
        supabase.table("budgets")
        .select("*")
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
        .execute()
        .data or []
    )

    if not budgets:
        return budgets

    # Fetch all lines for these budgets in a single query and compute balance per budget
    budget_ids = [b["id"] for b in budgets]
    lines = (
        supabase.table("budget_lines")
        .select("budget_id, line_type, planned_amount")
        .in_("budget_id", budget_ids)
        .execute()
        .data or []
    )

    # Group lines by budget_id and compute balance = income - expenses
    balance_map: dict[str, float] = {b["id"]: 0.0 for b in budgets}
    for line in lines:
        bid = line["budget_id"]
        if line["line_type"] == "income":
            balance_map[bid] += float(line["planned_amount"])
        else:
            balance_map[bid] -= float(line["planned_amount"])

    for budget in budgets:
        budget["balance"] = round(balance_map[budget["id"]], 2)

    return budgets


@router.post("/", response_model=BudgetOut, status_code=status.HTTP_201_CREATED)
def create_budget(
    body: BudgetCreate,
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    """Create a new budget. Custom date range requires start_date and end_date."""
    if body.date_range_type == "custom" and (not body.start_date or not body.end_date):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_date and end_date are required for a custom date range.",
        )
    result = supabase.table("budgets").insert({
        "user_id": user["id"],
        "name": body.name.strip(),
        "date_range_type": body.date_range_type,
        "start_date": str(body.start_date) if body.start_date else None,
        "end_date": str(body.end_date) if body.end_date else None,
    }).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create budget.")
    return result.data[0]


@router.get("/{budget_id}", response_model=BudgetOut)
def get_budget(
    budget_id: str,
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    result = (
        supabase.table("budgets")
        .select("*")
        .eq("id", budget_id)
        .eq("user_id", user["id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Budget not found.")
    return result.data[0]


@router.put("/{budget_id}", response_model=BudgetOut)
def update_budget(
    budget_id: str,
    body: BudgetUpdate,
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    updates = body.model_dump(exclude_none=True)
    # Convert date objects to strings for Supabase
    if "start_date" in updates:
        updates["start_date"] = str(updates["start_date"])
    if "end_date" in updates:
        updates["end_date"] = str(updates["end_date"])
    result = (
        supabase.table("budgets")
        .update(updates)
        .eq("id", budget_id)
        .eq("user_id", user["id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Budget not found.")
    return result.data[0]


@router.delete("/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_budget(
    budget_id: str,
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    result = (
        supabase.table("budgets")
        .delete()
        .eq("id", budget_id)
        .eq("user_id", user["id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Budget not found.")


# ---------------------------------------------------------------------------
# Budget Line Endpoints
# ---------------------------------------------------------------------------

@router.get("/{budget_id}/lines", response_model=list[BudgetLineOut])
def list_lines(
    budget_id: str,
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    """
    Return all lines for a budget with computed actuals from transactions.
    Lines with linked categories get computed_actual filled from matching
    transactions within the budget's date range.
    """
    # Verify ownership
    budget_res = (
        supabase.table("budgets")
        .select("*")
        .eq("id", budget_id)
        .eq("user_id", user["id"])
        .execute()
    )
    if not budget_res.data:
        raise HTTPException(status_code=404, detail="Budget not found.")
    budget = budget_res.data[0]

    lines = (
        supabase.table("budget_lines")
        .select("*")
        .eq("budget_id", budget_id)
        .order("sort_order", nullsfirst=False)
        .order("created_at")
        .execute()
        .data or []
    )

    # Fetch transactions for this budget's period to compute actuals
    if lines:
        start, end = _current_period(
            budget["date_range_type"],
            budget.get("start_date"),
            budget.get("end_date"),
        )
        txns = (
            supabase.table("transactions")
            .select("id, date, category, amount")
            .eq("user_id", user["id"])
            .gte("date", start)
            .lte("date", end)
            .execute()
            .data or []
        )

        # Fetch excluded transaction IDs for all lines in this budget
        line_ids = [l["id"] for l in lines]
        exclusions = (
            supabase.table("budget_line_excluded_transactions")
            .select("budget_line_id, transaction_id")
            .in_("budget_line_id", line_ids)
            .execute()
            .data or []
        )
        excluded_by_line: dict[str, list[str]] = {}
        for ex in exclusions:
            excluded_by_line.setdefault(ex["budget_line_id"], []).append(ex["transaction_id"])

        for line in lines:
            line["excluded_transaction_ids"] = excluded_by_line.get(line["id"], [])

        _compute_actuals(lines, txns)
    else:
        for line in lines:
            line["computed_actual"] = None
            line["excluded_transaction_ids"] = []

    return lines


@router.post("/{budget_id}/lines", response_model=BudgetLineOut, status_code=status.HTTP_201_CREATED)
def create_line(
    budget_id: str,
    body: BudgetLineCreate,
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    # Verify ownership
    if not (
        supabase.table("budgets")
        .select("id")
        .eq("id", budget_id)
        .eq("user_id", user["id"])
        .execute()
        .data
    ):
        raise HTTPException(status_code=404, detail="Budget not found.")

    cats = [c.strip().lower() for c in (body.categories or []) if c.strip()]

    # Assign sort_order = max existing + 1 within the same budget + line_type
    existing = (
        supabase.table("budget_lines")
        .select("sort_order")
        .eq("budget_id", budget_id)
        .eq("line_type", body.line_type)
        .execute()
        .data or []
    )
    max_order = max((r["sort_order"] or 0 for r in existing), default=0)

    result = supabase.table("budget_lines").insert({
        "budget_id": budget_id,
        "user_id": user["id"],
        "line_type": body.line_type,
        "name": body.name.strip(),
        "categories": cats,
        "planned_amount": body.planned_amount,
        "sort_order": max_order + 1,
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create budget line.")

    line = result.data[0]
    line["computed_actual"] = None
    return line


@router.put("/{budget_id}/lines/{line_id}", response_model=BudgetLineOut)
def update_line(
    budget_id: str,
    line_id: str,
    body: BudgetLineUpdate,
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    updates = body.model_dump(exclude_none=True)
    if "categories" in updates:
        updates["categories"] = [c.strip().lower() for c in updates["categories"] if c.strip()]

    result = (
        supabase.table("budget_lines")
        .update(updates)
        .eq("id", line_id)
        .eq("budget_id", budget_id)
        .eq("user_id", user["id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Budget line not found.")

    line = result.data[0]
    line["computed_actual"] = None
    return line


@router.patch("/{budget_id}/lines/reorder", status_code=status.HTTP_204_NO_CONTENT)
def reorder_lines(
    budget_id: str,
    body: list[LineOrderItem],
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    """Bulk-update sort_order for lines in a budget. Ignores lines not owned by the user."""
    for item in body:
        supabase.table("budget_lines").update({"sort_order": item.sort_order}).eq(
            "id", item.id
        ).eq("budget_id", budget_id).eq("user_id", user["id"]).execute()


@router.delete("/{budget_id}/lines/{line_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_line(
    budget_id: str,
    line_id: str,
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    result = (
        supabase.table("budget_lines")
        .delete()
        .eq("id", line_id)
        .eq("budget_id", budget_id)
        .eq("user_id", user["id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Budget line not found.")


# ---------------------------------------------------------------------------
# Excluded Transaction Endpoints
# ---------------------------------------------------------------------------

class ExcludeTransactionBody(BaseModel):
    transaction_id: str


@router.post(
    "/{budget_id}/lines/{line_id}/excluded-transactions",
    status_code=status.HTTP_201_CREATED,
)
def exclude_transaction(
    budget_id: str,
    line_id: str,
    body: ExcludeTransactionBody,
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    """Mark a transaction as excluded from tracking for this budget line."""
    # Verify the line belongs to the user
    if not (
        supabase.table("budget_lines")
        .select("id")
        .eq("id", line_id)
        .eq("budget_id", budget_id)
        .eq("user_id", user["id"])
        .execute()
        .data
    ):
        raise HTTPException(status_code=404, detail="Budget line not found.")

    # Upsert — silently ignore if already excluded
    supabase.table("budget_line_excluded_transactions").upsert({
        "user_id": user["id"],
        "budget_line_id": line_id,
        "transaction_id": body.transaction_id,
    }, on_conflict="budget_line_id,transaction_id").execute()
    return {"ok": True}


@router.delete(
    "/{budget_id}/lines/{line_id}/excluded-transactions/{transaction_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def include_transaction(
    budget_id: str,
    line_id: str,
    transaction_id: str,
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    """Remove a transaction from the excluded list, restoring it to tracking."""
    supabase.table("budget_line_excluded_transactions").delete().eq(
        "budget_line_id", line_id
    ).eq("transaction_id", transaction_id).eq("user_id", user["id"]).execute()
