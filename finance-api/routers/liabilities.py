"""
routers/liabilities.py — CRUD for manually-tracked debts and loans.

Endpoints:
    GET    /liabilities                  → List all liabilities
    POST   /liabilities                  → Add a liability
    PUT    /liabilities/{liability_id}   → Update a liability
    DELETE /liabilities/{liability_id}   → Delete a liability
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from supabase import Client

from middleware.auth import get_current_user, get_supabase_client

router = APIRouter(prefix="/liabilities", tags=["liabilities"])


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class LiabilityCreate(BaseModel):
    name: str = Field(..., min_length=1)
    balance: float = Field(..., ge=0)
    apr: Optional[float] = Field(None, ge=0, le=100, description="Annual percentage rate (0–100)")
    type: Optional[str] = Field(None, description="e.g. credit_card, student_loan, mortgage")
    minimum_payment: Optional[float] = Field(None, ge=0)


class LiabilityUpdate(BaseModel):
    name: Optional[str] = None
    balance: Optional[float] = Field(None, ge=0)
    apr: Optional[float] = Field(None, ge=0, le=100)
    type: Optional[str] = None
    minimum_payment: Optional[float] = Field(None, ge=0)


class Liability(BaseModel):
    id: str
    name: str
    balance: float
    apr: Optional[float] = None
    type: Optional[str] = None
    minimum_payment: Optional[float] = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/", response_model=list[Liability])
def list_liabilities(
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    """Return all liabilities for the authenticated user, highest balance first."""
    return (
        supabase.table("liabilities")
        .select("id, name, balance, apr, type, minimum_payment")
        .eq("user_id", user["id"])
        .order("balance", desc=True)
        .execute()
        .data
        or []
    )


@router.post("/", response_model=Liability, status_code=status.HTTP_201_CREATED)
def create_liability(
    body: LiabilityCreate,
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    """Add a new liability (debt, loan, credit card balance, etc.)."""
    result = (
        supabase.table("liabilities")
        .insert({
            "user_id": user["id"],
            "name": body.name,
            "balance": body.balance,
            "apr": body.apr,
            "type": body.type,
            "minimum_payment": body.minimum_payment,
        })
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create liability",
        )

    return result.data[0]


@router.put("/{liability_id}", response_model=Liability)
def update_liability(
    liability_id: str,
    body: LiabilityUpdate,
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    """Update one or more fields of an existing liability."""
    updates = body.model_dump(exclude_none=True)

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    result = (
        supabase.table("liabilities")
        .update(updates)
        .eq("id", liability_id)
        .eq("user_id", user["id"])
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Liability '{liability_id}' not found",
        )

    return result.data[0]


@router.delete("/{liability_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_liability(
    liability_id: str,
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    """Delete a liability."""
    result = (
        supabase.table("liabilities")
        .delete()
        .eq("id", liability_id)
        .eq("user_id", user["id"])
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Liability '{liability_id}' not found",
        )
