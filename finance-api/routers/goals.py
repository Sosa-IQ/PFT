"""
routers/goals.py — CRUD for savings goals.

Endpoints:
    GET    /goals           → List all goals
    POST   /goals           → Create a goal
    PUT    /goals/{goal_id} → Update a goal (amount, deadline, name)
    DELETE /goals/{goal_id} → Delete a goal
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from supabase import Client

from middleware.auth import get_current_user, get_supabase_client

router = APIRouter(prefix="/goals", tags=["goals"])


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class GoalCreate(BaseModel):
    name: str = Field(..., min_length=1)
    target_amount: float = Field(..., gt=0)
    current_amount: float = Field(0.0, ge=0)
    deadline: Optional[str] = Field(None, description="Target date (YYYY-MM-DD)")


class GoalUpdate(BaseModel):
    name: Optional[str] = None
    target_amount: Optional[float] = Field(None, gt=0)
    current_amount: Optional[float] = Field(None, ge=0)
    deadline: Optional[str] = None


class Goal(BaseModel):
    id: str
    name: str
    target_amount: float
    current_amount: float
    deadline: Optional[str] = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/", response_model=list[Goal])
def list_goals(
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    """Return all savings goals for the authenticated user, ordered by deadline."""
    return (
        supabase.table("savings_goals")
        .select("id, name, target_amount, current_amount, deadline")
        .eq("user_id", user["id"])
        .order("deadline", desc=False, nullsfirst=False)
        .execute()
        .data
        or []
    )


@router.post("/", response_model=Goal, status_code=status.HTTP_201_CREATED)
def create_goal(
    body: GoalCreate,
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    """Create a new savings goal."""
    result = (
        supabase.table("savings_goals")
        .insert({
            "user_id": user["id"],
            "name": body.name,
            "target_amount": body.target_amount,
            "current_amount": body.current_amount,
            "deadline": body.deadline,
        })
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create goal",
        )

    return result.data[0]


@router.put("/{goal_id}", response_model=Goal)
def update_goal(
    goal_id: str,
    body: GoalUpdate,
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    """Update one or more fields of an existing savings goal."""
    # Only include fields that were actually provided in the request.
    updates = body.model_dump(exclude_none=True)

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    result = (
        supabase.table("savings_goals")
        .update(updates)
        .eq("id", goal_id)
        .eq("user_id", user["id"])  # ensures users can't update each other's goals
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Goal '{goal_id}' not found",
        )

    return result.data[0]


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(
    goal_id: str,
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    """Delete a savings goal."""
    result = (
        supabase.table("savings_goals")
        .delete()
        .eq("id", goal_id)
        .eq("user_id", user["id"])
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Goal '{goal_id}' not found",
        )
