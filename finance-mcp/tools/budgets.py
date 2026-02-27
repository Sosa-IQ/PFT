"""
tools/budgets.py — Tools for checking and modifying budgets.
"""

from mcp.server.fastmcp import FastMCP
from supabase import Client
import db


def register(mcp: FastMCP, supabase: Client, user_id: str) -> None:
    """Register budget tools on the MCP server."""

    @mcp.tool()
    def get_budget_status() -> str:
        """
        Show all budgets with current month spending vs. the monthly limit.
        Highlights categories that are over or close to their limit.
        """
        budgets = db.get_budgets(supabase, user_id)
        if not budgets:
            return (
                "No budgets set up yet. "
                "Use set_budget(category, monthly_limit) to create one."
            )

        spend = db.get_current_month_spend_by_category(supabase, user_id)

        lines = ["Budget Status — Current Month:\n"]
        any_over = False

        for b in budgets:
            cat = b["category"]
            limit = float(b["monthly_limit"])
            spent = spend.get(cat, 0.0)
            remaining = limit - spent
            pct = (spent / limit * 100) if limit else 0

            # Visual progress bar (20 chars wide)
            filled = min(int(pct / 5), 20)
            bar = "█" * filled + "░" * (20 - filled)

            if pct >= 100:
                status = "OVER BUDGET"
                any_over = True
            elif pct >= 80:
                status = "⚠ near limit"
            else:
                status = "on track"

            lines.append(
                f"  {cat:<20} [{bar}] {pct:>5.0f}%  "
                f"${spent:.2f} / ${limit:.2f}  "
                f"(${remaining:+.2f})  {status}"
            )

        if any_over:
            lines.append("\nSome categories are over budget this month.")

        return "\n".join(lines)

    @mcp.tool()
    def set_budget(
        category: str,
        monthly_limit: float,
        confirmed: bool = False,
    ) -> str:
        """
        Create or update a monthly budget for a spending category.

        When confirmed=False (default), returns a preview of the change without saving.
        Set confirmed=True to apply the change.

        Args:
            category:      Spending category name (e.g. "Dining", "Groceries").
            monthly_limit: Maximum spend allowed per month in dollars.
            confirmed:     Set to True to save. Default is False (preview only).
        """
        if monthly_limit <= 0:
            return "monthly_limit must be greater than zero."

        # Check if a budget already exists for this category.
        existing = db.get_budget_by_category(supabase, user_id, category)
        action = "Update" if existing else "Create"
        old_limit_str = f"  Old limit: ${float(existing['monthly_limit']):.2f}\n" if existing else ""

        preview = (
            f"{action} budget — preview:\n"
            f"  Category:  {category}\n"
            f"{old_limit_str}"
            f"  New limit: ${monthly_limit:.2f}/month\n"
        )

        if not confirmed:
            return preview + "\nTo apply this change, call set_budget again with confirmed=True."

        db.upsert_budget(supabase, user_id, category, monthly_limit)
        return preview + "\nBudget saved."

    @mcp.tool()
    def update_budget(
        category: str,
        new_limit: float,
        confirmed: bool = False,
    ) -> str:
        """
        Update the monthly limit for an existing budget.

        Returns an error if the budget does not exist (use set_budget to create one).
        When confirmed=False (default), returns a preview without saving.

        Args:
            category:  Spending category to update (must already exist).
            new_limit: New monthly spending limit in dollars.
            confirmed: Set to True to save. Default is False (preview only).
        """
        if new_limit <= 0:
            return "new_limit must be greater than zero."

        existing = db.get_budget_by_category(supabase, user_id, category)
        if not existing:
            return (
                f"No budget found for '{category}'. "
                "Use set_budget to create one."
            )

        old_limit = float(existing["monthly_limit"])
        preview = (
            f"Update budget — preview:\n"
            f"  Category:  {category}\n"
            f"  Old limit: ${old_limit:.2f}/month\n"
            f"  New limit: ${new_limit:.2f}/month\n"
        )

        if not confirmed:
            return preview + "\nTo apply this change, call update_budget again with confirmed=True."

        db.upsert_budget(supabase, user_id, category, new_limit)
        return preview + "\nBudget updated."
