"""
tools/budgets.py — Tool for checking budget status against current month spending.
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
