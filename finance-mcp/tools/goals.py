"""
tools/goals.py — Tools for viewing and modifying savings goals.
"""

from datetime import date, timedelta
from mcp.server.fastmcp import FastMCP
from supabase import Client
import db


def _uid() -> str:
    """
    Resolve the current user ID.
    In SSE mode: reads from the OAuth access token in the request context.
    In stdio mode: falls back to server._stdio_user_id set at startup.
    """
    from mcp.server.auth.middleware.auth_context import get_access_token
    tok = get_access_token()
    if tok and tok.resource:
        return tok.resource
    import server as _server  # noqa: PLC0415
    return _server._stdio_user_id


def register(mcp: FastMCP, supabase: Client) -> None:
    """Register savings goal tools on the MCP server."""

    @mcp.tool()
    def get_savings_goals() -> str:
        """
        List all savings goals with current progress, percentage complete,
        and projected completion date where a deadline is set.
        """
        goals = db.get_savings_goals(supabase, _uid())
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
                    daily_needed = remaining / days_left
                    lines.append(
                        f"    Deadline: {g['deadline']}  ({days_left} days left)  "
                        f"Need ${daily_needed:.2f}/day to reach goal."
                    )
            else:
                lines.append(f"    No deadline set.  ${remaining:.2f} remaining.")

            lines.append("")  # blank line between goals

        return "\n".join(lines)

    @mcp.tool()
    def add_savings_goal(
        name: str,
        target_amount: float,
        deadline: str = "",
        confirmed: bool = False,
    ) -> str:
        """
        Create a new savings goal.

        When confirmed=False (default), returns a preview without saving.
        Set confirmed=True to create the goal.

        Args:
            name:          A short descriptive name (e.g. "Vacation", "Emergency Fund").
            target_amount: Dollar amount to reach.
            deadline:      Optional target date in YYYY-MM-DD format. Leave blank for no deadline.
            confirmed:     Set to True to save. Default is False (preview only).
        """
        if target_amount <= 0:
            return "target_amount must be greater than zero."

        resolved_deadline: str | None = None
        if deadline:
            try:
                date.fromisoformat(deadline)
                resolved_deadline = deadline
            except ValueError:
                return f"Invalid deadline '{deadline}'. Use YYYY-MM-DD format."

        uid = _uid()
        existing = db.get_goal_by_name(supabase, uid, name)
        if existing:
            return (
                f"A savings goal named '{name}' already exists "
                f"(${float(existing['current_amount']):.2f} / ${float(existing['target_amount']):.2f}). "
                "Use update_goal_progress to update it."
            )

        deadline_str = f"  Deadline:  {resolved_deadline}\n" if resolved_deadline else "  Deadline:  None\n"
        preview = (
            f"Add savings goal — preview:\n"
            f"  Name:      {name}\n"
            f"  Target:    ${target_amount:.2f}\n"
            f"{deadline_str}"
        )

        if not confirmed:
            return preview + "\nTo create this goal, call add_savings_goal again with confirmed=True."

        db.insert_savings_goal(supabase, uid, name, target_amount, resolved_deadline)
        return preview + "\nSavings goal created."

    @mcp.tool()
    def update_goal_progress(
        name: str,
        current_amount: float,
        confirmed: bool = False,
    ) -> str:
        """
        Update how much has been saved toward a goal.

        When confirmed=False (default), returns a preview without saving.
        Set confirmed=True to apply the update.

        Args:
            name:           Name of the existing savings goal to update.
            current_amount: New total amount saved so far in dollars.
            confirmed:      Set to True to save. Default is False (preview only).
        """
        if current_amount < 0:
            return "current_amount cannot be negative."

        uid = _uid()
        goal = db.get_goal_by_name(supabase, uid, name)
        if not goal:
            return (
                f"No savings goal named '{name}' found. "
                "Use get_savings_goals to see existing goals."
            )

        target = float(goal["target_amount"])
        old_amount = float(goal["current_amount"])
        pct = (current_amount / target * 100) if target else 0
        delta = current_amount - old_amount
        delta_str = f"+${delta:.2f}" if delta >= 0 else f"-${abs(delta):.2f}"

        preview = (
            f"Update goal progress — preview:\n"
            f"  Goal:       {name}\n"
            f"  Was:        ${old_amount:.2f}\n"
            f"  Now:        ${current_amount:.2f}  ({delta_str})  {pct:.0f}% of ${target:.2f}\n"
        )
        if current_amount >= target:
            preview += "  ** Goal reached! **\n"

        if not confirmed:
            return preview + "\nTo apply this change, call update_goal_progress again with confirmed=True."

        db.update_goal_current_amount(supabase, uid, name, current_amount)
        return preview + "\nGoal progress updated."
