"""
tools/liabilities.py — Tools for adding and removing manually-tracked liabilities.
"""

from mcp.server.fastmcp import FastMCP
from supabase import Client
import db

# Recognised liability types — used for validation and display.
VALID_TYPES = {"credit_card", "loan", "mortgage", "student_loan", "medical", "other"}


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
    """Register liability write tools on the MCP server."""

    @mcp.tool()
    def add_liability(
        name: str,
        balance: float,
        liability_type: str = "",
        apr: float = 0.0,
        minimum_payment: float = 0.0,
        confirmed: bool = False,
    ) -> str:
        """
        Add a manually-tracked liability (debt) such as a credit card, loan, or mortgage.

        When confirmed=False (default), returns a preview without saving.
        Set confirmed=True to save the liability.

        Args:
            name:            A short descriptive name (e.g. "Car Loan", "Student Loan").
            balance:         Current amount owed in dollars.
            liability_type:  One of: credit_card, loan, mortgage, student_loan, medical, other.
                             Leave blank to omit.
            apr:             Annual percentage rate as a number (e.g. 6.5 for 6.5%). Leave 0 to omit.
            minimum_payment: Minimum monthly payment in dollars. Leave 0 to omit.
            confirmed:       Set to True to save. Default is False (preview only).
        """
        if balance <= 0:
            return "balance must be greater than zero."

        if liability_type and liability_type not in VALID_TYPES:
            return (
                f"Invalid liability_type '{liability_type}'. "
                f"Choose one of: {', '.join(sorted(VALID_TYPES))}."
            )

        uid = _uid()
        existing = db.get_liability_by_name(supabase, uid, name)
        if existing:
            return (
                f"A liability named '{name}' already exists "
                f"(balance: ${float(existing['balance']):.2f}). "
                "Use delete_liability to remove it first, or choose a different name."
            )

        resolved_apr: float | None = apr if apr > 0 else None
        resolved_payment: float | None = minimum_payment if minimum_payment > 0 else None

        lines = [
            "Add liability — preview:",
            f"  Name:     {name}",
            f"  Balance:  ${balance:.2f}",
        ]
        if liability_type:
            lines.append(f"  Type:     {liability_type}")
        if resolved_apr is not None:
            lines.append(f"  APR:      {resolved_apr}%")
        if resolved_payment is not None:
            lines.append(f"  Min pay:  ${resolved_payment:.2f}/month")

        preview = "\n".join(lines) + "\n"

        if not confirmed:
            return preview + "\nTo save this liability, call add_liability again with confirmed=True."

        db.insert_liability(
            supabase,
            uid,
            name=name,
            balance=balance,
            apr=resolved_apr,
            liability_type=liability_type or None,
            minimum_payment=resolved_payment,
        )
        return preview + "\nLiability saved."

    @mcp.tool()
    def delete_liability(
        name: str,
        confirmed: bool = False,
    ) -> str:
        """
        Delete a manually-tracked liability by name.

        This is permanent — the record cannot be recovered after deletion.
        When confirmed=False (default), returns a preview without deleting.
        Set confirmed=True to delete.

        Args:
            name:      Name of the liability to delete (must match exactly).
            confirmed: Set to True to confirm deletion. Default is False (preview only).
        """
        uid = _uid()
        existing = db.get_liability_by_name(supabase, uid, name)
        if not existing:
            return (
                f"No liability named '{name}' found. "
                "Use get_net_worth to see existing liabilities."
            )

        balance = float(existing["balance"])
        preview = (
            f"Delete liability — preview:\n"
            f"  Name:    {name}\n"
            f"  Balance: ${balance:.2f}\n"
            f"  ** This action cannot be undone. **\n"
        )

        if not confirmed:
            return preview + "\nTo delete, call delete_liability again with confirmed=True."

        deleted = db.delete_liability_by_name(supabase, uid, name)
        if deleted == 0:
            return f"Liability '{name}' was not found — it may have already been deleted."

        return preview + "\nLiability deleted."
