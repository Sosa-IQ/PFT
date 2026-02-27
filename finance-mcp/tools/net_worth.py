"""
tools/net_worth.py — Tool for calculating the user's current net worth.
"""

from mcp.server.fastmcp import FastMCP
from supabase import Client
import db


def register(mcp: FastMCP, supabase: Client, user_id: str) -> None:
    """Register net worth tools on the MCP server."""

    @mcp.tool()
    def get_net_worth() -> str:
        """
        Calculate net worth: total account balances (assets) minus total liabilities.
        Shows a breakdown of each account and each debt.
        """
        accounts = db.get_accounts(supabase, user_id)
        liabilities = db.get_liabilities(supabase, user_id)

        if not accounts and not liabilities:
            return (
                "No accounts or liabilities found. "
                "Connect a bank account via Plaid and add any debts manually."
            )

        lines = ["Net Worth Summary:\n"]

        # Assets
        total_assets = 0.0
        lines.append("  Assets (bank accounts):")
        if accounts:
            for a in accounts:
                balance = float(a.get("current_balance") or 0)
                total_assets += balance
                institution = a.get("institution_name") or "Unknown bank"
                name = a.get("account_name") or a.get("account_type") or "Account"
                lines.append(f"    {institution} — {name:<25} ${balance:>10.2f}")
        else:
            lines.append("    No linked accounts.")

        lines.append(f"\n    {'Total assets':<30} ${total_assets:>10.2f}")

        # Liabilities
        total_liabilities = 0.0
        lines.append("\n  Liabilities (debts):")
        if liabilities:
            for l in liabilities:
                balance = float(l.get("balance") or 0)
                total_liabilities += balance
                name = l.get("name", "Unknown")
                debt_type = l.get("type") or ""
                apr = l.get("apr")
                apr_str = f"  APR {apr}%" if apr else ""
                lines.append(
                    f"    {name:<30} ${balance:>10.2f}  {debt_type}{apr_str}"
                )
        else:
            lines.append("    No liabilities recorded.")

        lines.append(f"\n    {'Total liabilities':<30} ${total_liabilities:>10.2f}")

        # Net worth
        net_worth = total_assets - total_liabilities
        sign = "+" if net_worth >= 0 else ""
        lines.append(f"\n  {'NET WORTH':<30} {sign}${net_worth:>10.2f}")

        return "\n".join(lines)
