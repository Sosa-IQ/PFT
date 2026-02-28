"""
tools/net_worth.py — Tools for viewing accounts and calculating net worth.
"""

from mcp.server.fastmcp import FastMCP
from supabase import Client
import db

# Plaid account types whose current_balance represents money owed, not money held.
DEBT_ACCOUNT_TYPES = {"credit", "loan"}


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
    """Register net worth and accounts tools on the MCP server."""

    @mcp.tool()
    def get_accounts() -> str:
        """
        List all linked bank accounts and manually-tracked liabilities.
        Each entry shows the account name, current balance, and whether
        it is an asset (money you own) or debt (money you owe).
        """
        uid = _uid()
        accounts = db.get_accounts(supabase, uid)
        liabilities = db.get_liabilities(supabase, uid)

        if not accounts and not liabilities:
            return (
                "No accounts or liabilities found. "
                "Connect a bank account via Plaid in the web app settings."
            )

        lines = ["Accounts:\n"]

        # ── Bank accounts (from Plaid) ─────────────────────────────────────
        if accounts:
            for a in accounts:
                balance = float(a.get("current_balance") or 0)
                name = a.get("account_name") or a.get("account_type") or "Account"
                institution = a.get("institution_name") or "Unknown bank"
                acct_type = (a.get("account_type") or "").lower()
                classification = "DEBT" if acct_type in DEBT_ACCOUNT_TYPES else "ASSET"
                lines.append(
                    f"  [{classification}]  {institution} — {name:<25}  ${balance:>10.2f}"
                )
        else:
            lines.append("  No bank accounts linked yet.")

        # ── Manual liabilities ─────────────────────────────────────────────
        if liabilities:
            lines.append("")
            lines.append("  Manual liabilities:")
            for l in liabilities:
                balance = float(l.get("balance") or 0)
                name = l.get("name", "Unknown")
                debt_type = f"  ({l['type']})" if l.get("type") else ""
                apr = l.get("apr")
                apr_str = f"  APR {apr}%" if apr else ""
                lines.append(
                    f"  [DEBT]  {name:<35}  ${balance:>10.2f}{debt_type}{apr_str}"
                )

        return "\n".join(lines)

    @mcp.tool()
    def get_net_worth() -> str:
        """
        Calculate net worth: total asset balances minus total debt.
        Assets = depository/investment/etc accounts.
        Debt = Plaid credit/loan accounts + manually-tracked liabilities.
        """
        uid = _uid()
        accounts = db.get_accounts(supabase, uid)
        liabilities = db.get_liabilities(supabase, uid)

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

        if debt_accounts:
            lines.append("    From bank (Plaid):")
            for a in debt_accounts:
                balance = float(a.get("current_balance") or 0)
                total_debt += balance
                institution = a.get("institution_name") or "Unknown bank"
                name = a.get("account_name") or a.get("account_type") or "Account"
                lines.append(f"      {institution} — {name:<23} ${balance:>10.2f}")

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
