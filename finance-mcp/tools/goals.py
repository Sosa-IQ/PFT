"""
tools/goals.py — Tool for viewing savings goals and projected completion.
"""

from datetime import date, timedelta
from mcp.server.fastmcp import FastMCP
from supabase import Client
import db


def register(mcp: FastMCP, supabase: Client, user_id: str) -> None:
    """Register savings goal tools on the MCP server."""

    @mcp.tool()
    def get_savings_goals() -> str:
        """
        List all savings goals with current progress, percentage complete,
        and projected completion date where a deadline is set.
        """
        goals = db.get_savings_goals(supabase, user_id)
        if not goals:
            return (
                "No savings goals yet. "
                "Use add_savings_goal(name, target, deadline) to create one."
            )

        today = date.today()
        lines = ["Savings Goals:\n"]

        for g in goals:
            name = g["name"]
            target = float(g["target_amount"])
            current = float(g["current_amount"])
            remaining = target - current
            pct = (current / target * 100) if target else 0

            # Visual progress bar (20 chars wide)
            filled = min(int(pct / 5), 20)
            bar = "█" * filled + "░" * (20 - filled)

            lines.append(f"  {name}")
            lines.append(f"    [{bar}] {pct:.0f}%  ${current:.2f} / ${target:.2f}")

            if g.get("deadline"):
                deadline = date.fromisoformat(g["deadline"])
                days_left = (deadline - today).days

                if current >= target:
                    lines.append(f"    Goal reached!")
                elif days_left <= 0:
                    lines.append(
                        f"    Deadline passed ({g['deadline']}).  "
                        f"Still need ${remaining:.2f}."
                    )
                else:
                    # How much needs to be saved per day to hit the deadline
                    daily_needed = remaining / days_left
                    lines.append(
                        f"    Deadline: {g['deadline']}  ({days_left} days left)  "
                        f"Need ${daily_needed:.2f}/day to reach goal."
                    )
            else:
                lines.append(f"    No deadline set.  ${remaining:.2f} remaining.")

            lines.append("")  # blank line between goals

        return "\n".join(lines)
