"""
routers/categories.py — Category management.

Endpoints:
    GET  /categories/                           → All categories with transaction counts
    POST /categories/                           → Create a custom (zero-transaction) category
    DELETE /categories/{name}                   → Delete a custom category (must have 0 transactions)
    PATCH /categories/transactions/{tx_id}      → Recategorize a transaction (with bulk options)
    GET  /categories/history                    → Recent category changes (for undo)
    POST /categories/history/{log_id}/undo      → Revert a change batch
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from supabase import Client

from middleware.auth import get_current_user, get_supabase_client

router = APIRouter(prefix="/categories", tags=["categories"])


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class Category(BaseModel):
    name: str
    transaction_count: int
    # True when the category was explicitly created by the user and lives in the
    # categories table — it will persist even if all transactions are moved away.
    is_custom: bool
    # Color key from the frontend palette (e.g. 'purple', 'green'). Null if not set.
    color: Optional[str] = None


class CreateCategoryRequest(BaseModel):
    name: str
    color: Optional[str] = None


class UpdateCategoryRequest(BaseModel):
    color: Optional[str] = None
    new_name: Optional[str] = None  # when provided, rename the category


class RecategorizeRequest(BaseModel):
    new_category: str
    # Apply the change to every transaction from the same merchant_name
    apply_to_same_merchant: bool = False
    # Apply the change to every transaction currently tagged with the same old category
    apply_to_old_category: bool = False


class RecategorizeResult(BaseModel):
    log_id: str
    affected_count: int
    description: str


class ChangeLog(BaseModel):
    id: str
    changed_at: str
    description: str
    affected_count: int


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/", response_model=list[Category])
def list_categories(
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    """
    Return all categories merged from two sources:
    1. Explicitly-created custom categories (categories table) — even with 0 transactions.
    2. Categories present on at least one transaction (transactions table).
    Results are sorted alphabetically.
    """
    user_id = user["id"]

    # 1. Custom categories (may have 0 transactions) — fetch name + color
    custom_rows = (
        supabase.table("categories")
        .select("name, color")
        .eq("user_id", user_id)
        .execute()
        .data or []
    )
    custom_names = {row["name"] for row in custom_rows}
    # Build a name → color lookup for the merge step
    custom_colors: dict[str, Optional[str]] = {row["name"]: row.get("color") for row in custom_rows}

    # 2. Transaction categories with per-category counts.
    # We fetch only the category column to keep the payload small.
    tx_rows = (
        supabase.table("transactions")
        .select("category")
        .eq("user_id", user_id)
        .not_.is_("category", "null")
        .execute()
        .data or []
    )
    tx_counts: dict[str, int] = {}
    for row in tx_rows:
        cat = (row.get("category") or "").strip()
        if cat:
            tx_counts[cat] = tx_counts.get(cat, 0) + 1

    # 3. Merge and return sorted
    all_names = custom_names | set(tx_counts.keys())
    return sorted(
        [
            Category(
                name=name,
                transaction_count=tx_counts.get(name, 0),
                is_custom=name in custom_names,
                color=custom_colors.get(name),
            )
            for name in all_names
        ],
        key=lambda c: c.name.lower(),
    )


@router.post("/", response_model=Category, status_code=201)
def create_category(
    body: CreateCategoryRequest,
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    """Create a custom category. Fails with 409 if the name already exists (case-insensitive)."""
    user_id = user["id"]
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Category name cannot be empty.")

    existing = (
        supabase.table("categories")
        .select("name")
        .eq("user_id", user_id)
        .ilike("name", name)
        .execute()
        .data
    )
    if existing:
        raise HTTPException(status_code=409, detail=f"Category '{name}' already exists.")

    insert_data: dict = {"user_id": user_id, "name": name}
    if body.color:
        insert_data["color"] = body.color
    supabase.table("categories").insert(insert_data).execute()

    # Count current transaction uses (likely 0 for a brand-new custom category)
    tx_rows = (
        supabase.table("transactions")
        .select("id")
        .eq("user_id", user_id)
        .ilike("category", name)
        .execute()
        .data or []
    )
    return Category(name=name, transaction_count=len(tx_rows), is_custom=True, color=body.color)


@router.delete("/history/all", status_code=204)
def clear_history(
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    """Delete all category change history for the user."""
    supabase.table("category_change_log").delete().eq("user_id", user["id"]).execute()


@router.delete("/{name}", status_code=204)
def delete_category(
    name: str,
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    """
    Delete a custom category from the categories table.
    Fails if any transaction still uses this category — recategorize them first.
    """
    user_id = user["id"]

    tx_rows = (
        supabase.table("transactions")
        .select("id")
        .eq("user_id", user_id)
        .ilike("category", name)
        .limit(1)
        .execute()
        .data or []
    )
    if tx_rows:
        raise HTTPException(
            status_code=409,
            detail=f"'{name}' is still used by transactions. Recategorize them first.",
        )

    supabase.table("categories").delete().eq("user_id", user_id).ilike("name", name).execute()


@router.patch("/{name}", response_model=Category)
def update_category(
    name: str,
    body: UpdateCategoryRequest,
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    """
    Update a category's color and/or name.
    - Color: upserts so Plaid-derived categories get a row.
    - Rename (new_name): updates the categories table row and all transactions
      that use the old name. Fails with 409 if the new name is taken.
    """
    user_id = user["id"]
    final_name = name

    if body.new_name:
        new_name = body.new_name.strip()
        if not new_name:
            raise HTTPException(status_code=400, detail="Category name cannot be empty.")

        if new_name.lower() != name.lower():
            # Conflict check — case-insensitive
            conflict = (
                supabase.table("categories")
                .select("name")
                .eq("user_id", user_id)
                .ilike("name", new_name)
                .execute()
                .data
            )
            if conflict:
                raise HTTPException(status_code=409, detail=f"Category '{new_name}' already exists.")

        # Update (or insert) the categories table row with the new name + color
        row = (
            supabase.table("categories")
            .select("name")
            .eq("user_id", user_id)
            .ilike("name", name)
            .execute()
            .data
        )
        if row:
            supabase.table("categories").update(
                {"name": new_name, "color": body.color}
            ).eq("user_id", user_id).ilike("name", name).execute()
        else:
            supabase.table("categories").insert(
                {"user_id": user_id, "name": new_name, "color": body.color}
            ).execute()

        # Update all transactions that used the old category name
        supabase.table("transactions").update(
            {"category": new_name}
        ).eq("user_id", user_id).ilike("category", name).execute()

        final_name = new_name
    else:
        # Color-only update — upsert so Plaid-derived categories get a row
        supabase.table("categories").upsert(
            {"user_id": user_id, "name": name, "color": body.color},
            on_conflict="user_id,name",
        ).execute()

    tx_rows = (
        supabase.table("transactions")
        .select("id")
        .eq("user_id", user_id)
        .ilike("category", final_name)
        .execute()
        .data or []
    )
    return Category(
        name=final_name,
        transaction_count=len(tx_rows),
        is_custom=True,
        color=body.color,
    )


@router.patch("/transactions/{transaction_id}", response_model=RecategorizeResult)
def recategorize_transaction(
    transaction_id: str,
    body: RecategorizeRequest,
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    """
    Change a transaction's category and optionally apply the change to:
    - Every transaction from the same merchant (apply_to_same_merchant)
    - Every transaction currently in the same old category (apply_to_old_category)

    A log entry is created so the change can be undone via /categories/history/{id}/undo.
    """
    user_id = user["id"]
    new_cat = body.new_category.strip()
    if not new_cat:
        raise HTTPException(status_code=400, detail="new_category cannot be empty.")

    # Fetch the target transaction to get its current category and merchant
    rows = (
        supabase.table("transactions")
        .select("id, category, merchant_name")
        .eq("id", transaction_id)
        .eq("user_id", user_id)
        .execute()
        .data
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Transaction not found.")

    target = rows[0]
    old_cat: Optional[str] = target.get("category")
    merchant: Optional[str] = target.get("merchant_name")

    # Build the full set of (transaction_id → old_category) to update.
    # Using a dict deduplicates if multiple options match the same transaction.
    ids_to_update: dict[str, Optional[str]] = {transaction_id: old_cat}

    if body.apply_to_same_merchant and merchant:
        merchant_rows = (
            supabase.table("transactions")
            .select("id, category")
            .eq("user_id", user_id)
            .eq("merchant_name", merchant)
            .execute()
            .data or []
        )
        for row in merchant_rows:
            ids_to_update[row["id"]] = row.get("category")

    if body.apply_to_old_category and old_cat:
        cat_rows = (
            supabase.table("transactions")
            .select("id, category")
            .eq("user_id", user_id)
            .ilike("category", old_cat)
            .execute()
            .data or []
        )
        for row in cat_rows:
            ids_to_update[row["id"]] = row.get("category")

    ids_list = list(ids_to_update.keys())

    # Apply the update in one query
    supabase.table("transactions").update({"category": new_cat}).in_("id", ids_list).execute()

    # Build a human-readable description for the log
    if body.apply_to_same_merchant and merchant and body.apply_to_old_category and old_cat:
        scope = f"all '{merchant}' transactions + all '{old_cat}' transactions"
    elif body.apply_to_same_merchant and merchant:
        scope = f"all '{merchant}' transactions"
    elif body.apply_to_old_category and old_cat:
        scope = f"all '{old_cat}' transactions"
    else:
        scope = "1 transaction"
    old_label = f"'{old_cat}'" if old_cat else "uncategorized"
    description = (
        f"Changed {len(ids_list)} transaction(s) ({scope}) "
        f"from {old_label} to '{new_cat}'"
    )

    # Persist the change so it can be undone
    changes = [
        {"transaction_id": tid, "old_category": oc, "new_category": new_cat}
        for tid, oc in ids_to_update.items()
    ]
    log_row = (
        supabase.table("category_change_log")
        .insert({"user_id": user_id, "description": description, "changes": changes})
        .execute()
        .data[0]
    )

    return RecategorizeResult(
        log_id=log_row["id"],
        affected_count=len(ids_list),
        description=description,
    )


@router.get("/history", response_model=list[ChangeLog])
def list_history(
    limit: int = Query(20, ge=1, le=100),
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    """Return recent category changes for the user, newest first."""
    rows = (
        supabase.table("category_change_log")
        .select("id, changed_at, description, changes")
        .eq("user_id", user["id"])
        .order("changed_at", desc=True)
        .limit(limit)
        .execute()
        .data or []
    )
    return [
        ChangeLog(
            id=row["id"],
            changed_at=row["changed_at"],
            description=row["description"],
            affected_count=len(row.get("changes") or []),
        )
        for row in rows
    ]


@router.post("/history/{log_id}/undo", status_code=200)
def undo_change(
    log_id: str,
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    """
    Revert all transaction category changes from a logged operation.
    The log entry is deleted afterward so the same operation can't be undone twice.
    """
    user_id = user["id"]

    rows = (
        supabase.table("category_change_log")
        .select("id, changes")
        .eq("id", log_id)
        .eq("user_id", user_id)
        .execute()
        .data
    )
    if not rows:
        raise HTTPException(status_code=404, detail="History entry not found.")

    changes: list[dict] = rows[0]["changes"] or []

    # Group transaction IDs by their old_category so we can batch the UPDATE calls
    by_old_cat: dict[Optional[str], list[str]] = {}
    for change in changes:
        old = change.get("old_category")  # may be None (was uncategorized)
        tid = change["transaction_id"]
        if old not in by_old_cat:
            by_old_cat[old] = []
        by_old_cat[old].append(tid)

    for old_cat, ids in by_old_cat.items():
        supabase.table("transactions").update({"category": old_cat}).in_("id", ids).execute()

    # Remove the log entry so it can't be double-undone
    supabase.table("category_change_log").delete().eq("id", log_id).execute()

    return {"undone": len(changes)}
