"""
routers/budgets.py — CRUD for budgets and budget lines.

A budget is a named plan with a date range.
Each budget contains income and expense lines.

Lines can optionally link to one or more transaction categories.
When categories are linked, computed_actual is calculated from matching
transactions within the budget's date range (for progress tracking).

Endpoints:
    GET    /budgets/                        → List all budgets
    POST   /budgets/                        → Create a budget
    GET    /budgets/{id}                    → Get a budget
    PUT    /budgets/{id}                    → Update a budget
    DELETE /budgets/{id}                    → Delete a budget
    GET    /budgets/{id}/lines              → List lines with computed actuals
    POST   /budgets/{id}/lines              → Add a line
    PUT    /budgets/{id}/lines/{line_id}    → Update a line
    DELETE /budgets/{id}/lines/{line_id}    → Delete a line
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
    """Mutate each line dict in-place, setting computed_actual from transactions."""
    for line in lines:
        cats = line.get("categories") or []
        cats_lower = {c.strip().lower() for c in cats if c}
        if not cats_lower:
            line["computed_actual"] = None
            continue
        if line["line_type"] == "expense":
            # Positive amounts = debits (expenses)
            total = sum(
                t["amount"] for t in transactions
                if (t.get("category") or "").lower() in cats_lower and t["amount"] > 0
            )
        else:
            # Negative amounts = credits (income) — take absolute value
            total = abs(sum(
                t["amount"] for t in transactions
                if (t.get("category") or "").lower() in cats_lower and t["amount"] < 0
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


class BudgetLineCreate(BaseModel):
    line_type: Literal["income", "expense"]
    name: str = Field(..., min_length=1)
    categories: Optional[list[str]] = None  # links to tracked transaction categories
    planned_amount: float = Field(..., ge=0)


class BudgetLineUpdate(BaseModel):
    name: Optional[str] = None
    categories: Optional[list[str]] = None
    planned_amount: Optional[float] = None


class BudgetLineOut(BaseModel):
    id: str
    budget_id: str
    line_type: str
    name: str
    categories: list[str] = []
    planned_amount: float
    computed_actual: Optional[float] = None  # auto-calculated from transactions


# ---------------------------------------------------------------------------
# Budget Endpoints
# ---------------------------------------------------------------------------

@router.get("/", response_model=list[BudgetOut])
def list_budgets(
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    """Return all budgets for the authenticated user, newest first."""
    return (
        supabase.table("budgets")
        .select("*")
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
        .execute()
        .data or []
    )


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
            .select("category, amount")
            .eq("user_id", user["id"])
            .gte("date", start)
            .lte("date", end)
            .execute()
            .data or []
        )
        _compute_actuals(lines, txns)
    else:
        for line in lines:
            line["computed_actual"] = None

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
    result = supabase.table("budget_lines").insert({
        "budget_id": budget_id,
        "user_id": user["id"],
        "line_type": body.line_type,
        "name": body.name.strip(),
        "categories": cats,
        "planned_amount": body.planned_amount,
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
