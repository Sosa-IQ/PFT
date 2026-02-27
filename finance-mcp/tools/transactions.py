"""
tools/transactions.py — Tools for querying transactions, spending summaries, and recategorizing.
"""

from datetime import date
from mcp.server.fastmcp import FastMCP
from supabase import Client
import db


def register(mcp: FastMCP, supabase: Client, user_id: str) -> None:
    """Register transaction tools on the MCP server."""

    @mcp.tool()
    def get_transactions(
        category: str = "",
        start_date: str = "",
        end_date: str = "",
        limit: int = 20,
    ) -> str:
        """
        List recent transactions, optionally filtered by category and date range.

        Args:
            category:   Filter by category name (e.g. "Dining", "Groceries"). Leave blank for all.
            start_date: Earliest date to include, YYYY-MM-DD format. Leave blank for no lower bound.
            end_date:   Latest date to include, YYYY-MM-DD format. Leave blank for today.
            limit:      Maximum number of transactions to return (default 20, max 200).
        """
        limit = min(max(1, limit), 200)
        rows = db.get_transactions(
            supabase,
            user_id,
            category=category or None,
            start_date=start_date or None,
            end_date=end_date or None,
            limit=limit,
        )

        if not rows:
            return "No transactions found for the given filters."

        lines = ["Transactions:\n"]
        for t in rows:
            sign = "-" if t["amount"] > 0 else "+"  # debit vs credit
            merchant = t.get("merchant_name") or "Unknown"
            cat = t.get("category") or "Uncategorized"
            account = t.get("account_name") or "Unknown account"
            note = f"  [{t['note']}]" if t.get("note") else ""
            recurring = " (recurring)" if t.get("is_recurring") else ""
            lines.append(
                f"  {t['date']}  {sign}${abs(t['amount']):.2f}  "
                f"{merchant}  [{cat}]  ({account}){note}{recurring}"
            )

        return "\n".join(lines)

    @mcp.tool()
    def get_spending_summary(
        start_date: str = "",
        end_date: str = "",
        group_by: str = "category",
    ) -> str:
        """
        Show total spending grouped by category or month.

        Args:
            start_date: Start of the period, YYYY-MM-DD. Defaults to the 1st of this month.
            end_date:   End of the period, YYYY-MM-DD. Defaults to today.
            group_by:   Either "category" (default) or "month".
        """
        today = date.today()
        resolved_start = start_date or today.replace(day=1).isoformat()
        resolved_end = end_date or today.isoformat()

        if group_by not in ("category", "month"):
            return "group_by must be 'category' or 'month'."

        if group_by == "category":
            totals = db.get_spending_by_category(
                supabase, user_id, resolved_start, resolved_end
            )
        else:
            totals = db.get_spending_by_month(
                supabase, user_id, resolved_start, resolved_end
            )

        if not totals:
            return f"No spending data found between {resolved_start} and {resolved_end}."

        grand_total = sum(totals.values())
        label = "category" if group_by == "category" else "month"
        lines = [
            f"Spending Summary ({resolved_start} → {resolved_end})",
            f"Grouped by {label}:\n",
        ]
        for key, amount in totals.items():
            pct = (amount / grand_total * 100) if grand_total else 0
            lines.append(f"  {key:<25} ${amount:>9.2f}  ({pct:.0f}%)")

        lines.append(f"\n  {'Total':<25} ${grand_total:>9.2f}")
        return "\n".join(lines)

    @mcp.tool()
    def recategorize_transaction(
        transaction_id: str,
        new_category: str,
        confirmed: bool = False,
    ) -> str:
        """
        Change the category of a single transaction.

        Useful for fixing miscategorised transactions so budgets and
        spending summaries reflect the correct categories.

        When confirmed=False (default), returns a preview without saving.
        Set confirmed=True to apply the change.

        Args:
            transaction_id: The UUID of the transaction to update.
                            Use get_transactions to find transaction IDs.
            new_category:   The corrected category name (e.g. "Groceries", "Utilities").
            confirmed:      Set to True to save. Default is False (preview only).
        """
        if not transaction_id or not new_category:
            return "Both transaction_id and new_category are required."

        txn = db.get_transaction_by_id(supabase, user_id, transaction_id)
        if not txn:
            return (
                f"No transaction found with id '{transaction_id}'. "
                "Use get_transactions to find the correct id."
            )

        old_category = txn.get("category") or "Uncategorized"
        merchant = txn.get("merchant_name") or "Unknown"
        amount = float(txn.get("amount", 0))
        txn_date = txn.get("date", "")

        preview = (
            f"Recategorize transaction — preview:\n"
            f"  Date:         {txn_date}\n"
            f"  Merchant:     {merchant}\n"
            f"  Amount:       ${amount:.2f}\n"
            f"  Old category: {old_category}\n"
            f"  New category: {new_category}\n"
        )

        if not confirmed:
            return preview + "\nTo apply this change, call recategorize_transaction again with confirmed=True."

        result = db.update_transaction_category(supabase, user_id, transaction_id, new_category)
        if not result:
            return "Transaction update failed — it may have been deleted."

        return preview + "\nTransaction recategorized."
