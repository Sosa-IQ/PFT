"""
server.py — MCP server entry point for the Personal Finance Tracker.

Phase 1: runs locally via stdio transport (Claude Desktop).
Phase 5: switch to SSE transport for remote access from Claude mobile.

Usage:
    python server.py

Claude Desktop config (~/.config/claude/claude_desktop_config.json on Linux,
~/Library/Application Support/Claude/claude_desktop_config.json on Mac):

    {
      "mcpServers": {
        "finance": {
          "command": "python",
          "args": ["/absolute/path/to/finance-mcp/server.py"]
        }
      }
    }
"""

import sys
from mcp.server.fastmcp import FastMCP
from dotenv import load_dotenv

import db
import auth
import tools.transactions as transactions_tools
import tools.budgets as budgets_tools
import tools.goals as goals_tools
import tools.net_worth as net_worth_tools
import tools.liabilities as liabilities_tools

load_dotenv()

# ---------------------------------------------------------------------------
# Initialize
# ---------------------------------------------------------------------------

mcp = FastMCP(
    name="Personal Finance",
    instructions=(
        "You have access to the user's personal financial data and can make changes on their behalf. "
        "Read tools: get_transactions, get_spending_summary, get_budget_status, get_savings_goals, get_accounts, get_net_worth. "
        "Write tools: set_budget, update_budget, add_savings_goal, update_goal_progress, "
        "add_liability, delete_liability, recategorize_transaction. "
        "All write tools require confirmed=True to execute — always show the preview first and "
        "ask the user to confirm before calling with confirmed=True. "
        "Always be specific with numbers and dates. "
        "If data is missing or there are no results, say so clearly."
    ),
)

# Connect to Supabase and resolve the current user.
# This happens once at server startup — all tool calls share this context.
try:
    supabase = db.create_db_client()
    user_id = auth.get_user_id(supabase)
except Exception as e:
    print(f"[finance-mcp] Startup error: {e}", file=sys.stderr)
    print(
        "[finance-mcp] Check your .env file — SUPABASE_URL, SUPABASE_SERVICE_KEY, "
        "and SUPABASE_USER_JWT must all be set.",
        file=sys.stderr,
    )
    sys.exit(1)

print(f"[finance-mcp] Connected. User: {user_id}", file=sys.stderr)

# ---------------------------------------------------------------------------
# Register tools
# ---------------------------------------------------------------------------

transactions_tools.register(mcp, supabase, user_id)
budgets_tools.register(mcp, supabase, user_id)
goals_tools.register(mcp, supabase, user_id)
net_worth_tools.register(mcp, supabase, user_id)
liabilities_tools.register(mcp, supabase, user_id)

# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    # stdio is the default transport for local use with Claude Desktop.
    # For Phase 5 (remote), change to:
    #   mcp.run(transport="sse", host="0.0.0.0", port=8000)
    mcp.run(transport="stdio")
