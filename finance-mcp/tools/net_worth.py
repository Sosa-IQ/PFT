"""
tools/net_worth.py — Tool for calculating the user's current net worth.
"""

from mcp.server.fastmcp import FastMCP
from supabase import Client
import db

# Plaid account types whose current_balance represents money owed, not money held.
DEBT_ACCOUNT_TYPES = {"credit", "loan"}


def register(mcp: FastMCP, supabase: Client, user_id: str) -> None:
    """Register net worth tools on the MCP server."""

    @mcp.tool()
    def get_net_worth() -> str:
        """
        Calculate net worth: total asset balances minus total debt.
        Assets = depository/investment/etc accounts.
        Debt = Plaid credit/loan accounts + manually-tracked liabilities.
        """
        accounts = db.get_accounts(supabase, user_id)
        liabilities = db.get_liabilities(supabase, user_id)

        if not accounts and not liabilities:
            return (
                "No accounts or liabilities found. "
                "Connect a bank account via Plaid and add any debts manually."
            )

        # Split Plaid accounts into assets vs debt by account type.
        asset_accounts = [a for a in accounts if a.get("account_type") not in DEBT_ACCOUNT_TYPES]
        debt_accounts  = [a for a in accounts if a.get("account_type") in DEBT_ACCOUNT_TYPES]

        lines = ["Net Worth Summary:\n"]

        # ── Assets ────────────────────────────────────────────────────────────
        total_assets = 0.0
        lines.append("  Assets:")
        if asset_accounts:
            for a in asset_accounts:
                balance = float(a.get("current_balance") or 0)
                total_assets += balance
                institution = a.get("institution_name") or "Unknown bank"
                name = a.get("account_name") or a.get("account_type") or "Account"
                lines.append(f"    {institution} — {name:<25} ${balance:>10.2f}")
        else:
            lines.append("    No asset accounts linked.")

        lines.append(f"\n    {'Total assets':<30} ${total_assets:>10.2f}")

        # ── Liabilities ───────────────────────────────────────────────────────
        total_debt = 0.0
        lines.append("\n  Liabilities:")

        # Plaid credit/loan accounts (balances represent money owed).
        if debt_accounts:
            lines.append("    From bank (Plaid):")
            for a in debt_accounts:
                balance = float(a.get("current_balance") or 0)
                total_debt += balance
                institution = a.get("institution_name") or "Unknown bank"
                name = a.get("account_name") or a.get("account_type") or "Account"
                lines.append(f"      {institution} — {name:<23} ${balance:>10.2f}")

        # Manually-tracked liabilities.
        if liabilities:
            lines.append("    Manual entries:")
            for l in liabilities:
                balance = float(l.get("balance") or 0)
                total_debt += balance
                name = l.get("name", "Unknown")
                debt_type = l.get("type") or ""
                apr = l.get("apr")
                apr_str = f"  APR {apr}%" if apr else ""
                lines.append(
                    f"      {name:<30} ${balance:>10.2f}  {debt_type}{apr_str}"
                )

        if not debt_accounts and not liabilities:
            lines.append("    No liabilities recorded.")

        lines.append(f"\n    {'Total liabilities':<30} ${total_debt:>10.2f}")

        # ── Net worth ─────────────────────────────────────────────────────────
        net_worth = total_assets - total_debt
        sign = "+" if net_worth >= 0 else ""
        lines.append(f"\n  {'NET WORTH':<30} {sign}${net_worth:>10.2f}")

        return "\n".join(lines)
