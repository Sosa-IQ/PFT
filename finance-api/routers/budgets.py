"""
routers/budgets.py — CRUD for monthly spending budgets.

Endpoints:
    GET    /budgets              → List all budgets
    POST   /budgets              → Create a budget
    PUT    /budgets/{category}   → Update a budget's monthly limit
    DELETE /budgets/{category}   → Delete a budget
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from supabase import Client

from middleware.auth import get_current_user, get_supabase_client

router = APIRouter(prefix="/budgets", tags=["budgets"])


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class BudgetBase(BaseModel):
    monthly_limit: float = Field(..., gt=0, description="Monthly spending limit in USD")


class BudgetCreate(BudgetBase):
    category: str = Field(..., min_length=1)


class Budget(BudgetBase):
    category: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/", response_model=list[Budget])
def list_budgets(
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    """Return all budgets for the authenticated user."""
    return (
        supabase.table("budgets")
        .select("category, monthly_limit")
        .eq("user_id", user["id"])
        .order("category")
        .execute()
        .data
        or []
    )


@router.post("/", response_model=Budget, status_code=status.HTTP_201_CREATED)
def create_budget(
    body: BudgetCreate,
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    """
    Create a new monthly budget for a category.
    Returns 409 if a budget for that category already exists.
    """
    result = (
        supabase.table("budgets")
        .insert({
            "user_id": user["id"],
            "category": body.category,
            "monthly_limit": body.monthly_limit,
        })
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A budget for '{body.category}' already exists. Use PUT to update it.",
        )

    return result.data[0]


@router.put("/{category}", response_model=Budget)
def update_budget(
    category: str,
    body: BudgetBase,
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    """Update the monthly limit for an existing budget."""
    result = (
        supabase.table("budgets")
        .update({"monthly_limit": body.monthly_limit})
        .eq("user_id", user["id"])
        .eq("category", category)
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No budget found for category '{category}'",
        )

    return result.data[0]


@router.delete("/{category}", status_code=status.HTTP_204_NO_CONTENT)
def delete_budget(
    category: str,
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    """Delete a budget by category."""
    result = (
        supabase.table("budgets")
        .delete()
        .eq("user_id", user["id"])
        .eq("category", category)
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No budget found for category '{category}'",
        )
