"""
server.py — MCP server entry point for the Personal Finance Tracker.

Transport modes (set MCP_TRANSPORT in .env):
  stdio (default): runs locally via Claude Desktop, user JWT read from .env.
  sse:             runs as an HTTP server with OAuth 2.0 — for remote access
                   from Claude Desktop / Claude mobile after EC2 deploy.

── stdio (local dev) ──────────────────────────────────────────────────────
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

── SSE (remote / EC2) ─────────────────────────────────────────────────────
Claude Desktop config:

    {
      "mcpServers": {
        "finance": { "url": "https://mcp.yourdomain.com/sse" }
      }
    }

Claude will open a browser to https://mcp.yourdomain.com/oauth/login
the first time, and refresh tokens silently thereafter.
"""

import os
import sys

from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP

import db
import auth

load_dotenv()

# ---------------------------------------------------------------------------
# Module-level user ID fallback for stdio transport.
# In SSE mode, tools resolve user_id from the OAuth access token per-request.
# In stdio mode, this is set once at startup from SUPABASE_USER_JWT.
# Declared BEFORE tool imports so `import server` in tools never raises
# AttributeError when the module is partially initialized.
# ---------------------------------------------------------------------------
_stdio_user_id: str = ""

# ---------------------------------------------------------------------------
# Tool modules — imported after _stdio_user_id is declared.
# Each module does `import server as _server` inside its _uid() helper,
# which is only called at tool-invocation time (not at import time).
# ---------------------------------------------------------------------------
import tools.transactions as transactions_tools
import tools.budgets as budgets_tools
import tools.goals as goals_tools
import tools.net_worth as net_worth_tools
import tools.liabilities as liabilities_tools

# ---------------------------------------------------------------------------
# Shared MCP instructions (same in both transport modes)
# ---------------------------------------------------------------------------
_INSTRUCTIONS = (
    "You have access to the user's personal financial data and can make changes on their behalf. "
    "Read tools: get_transactions, get_spending_summary, get_budget_status, get_savings_goals, "
    "get_accounts, get_net_worth. "
    "Write tools: set_budget, update_budget, add_savings_goal, update_goal_progress, "
    "add_liability, delete_liability, recategorize_transaction. "
    "All write tools require confirmed=True to execute — always show the preview first and "
    "ask the user to confirm before calling with confirmed=True. "
    "Always be specific with numbers and dates. "
    "If data is missing or there are no results, say so clearly."
)

# ---------------------------------------------------------------------------
# Initialize Supabase client (shared across both transport modes)
# ---------------------------------------------------------------------------
try:
    supabase = db.create_db_client()
except Exception as e:
    print(f"[finance-mcp] Supabase init error: {e}", file=sys.stderr)
    sys.exit(1)

# ---------------------------------------------------------------------------
# Transport selection
# ---------------------------------------------------------------------------
_transport = os.getenv("MCP_TRANSPORT", "stdio").lower()

if _transport == "sse":
    # ── SSE / OAuth mode ────────────────────────────────────────────────────
    from mcp.server.auth.settings import (
        AuthSettings,
        ClientRegistrationOptions,
        RevocationOptions,
    )
    import oauth_provider as _oauth_provider_module
    import oauth_login as _oauth_login

    _server_url = os.getenv("MCP_SERVER_URL", "http://localhost:8000").rstrip("/")
    if not os.getenv("MCP_SERVER_URL"):
        print(
            "[finance-mcp] WARNING: MCP_SERVER_URL not set — defaulting to http://localhost:8000",
            file=sys.stderr,
        )

    _provider = _oauth_provider_module.FinanceOAuthProvider(supabase)

    mcp = FastMCP(
        name="Personal Finance",
        instructions=_INSTRUCTIONS,
        auth_server_provider=_provider,
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
        auth=AuthSettings(
            issuer_url=_server_url,
            resource_server_url=_server_url,
            client_registration_options=ClientRegistrationOptions(
                enabled=True,
                valid_scopes=["finance"],
                default_scopes=["finance"],
            ),
            revocation_options=RevocationOptions(enabled=True),
            required_scopes=["finance"],
        ),
    )

    # Add the login form routes (not auth-protected; added last = lowest precedence).
    mcp._custom_starlette_routes.extend(_oauth_login.make_login_routes(supabase))

    print(f"[finance-mcp] SSE mode. Issuer: {_server_url}", file=sys.stderr)

else:
    # ── stdio mode (Phase 1 — unchanged behaviour) ──────────────────────────
    mcp = FastMCP(name="Personal Finance", instructions=_INSTRUCTIONS)

    try:
        _user_id = auth.get_user_id(supabase)
        _stdio_user_id = _user_id   # module-level variable read by tools/_uid()
    except Exception as e:
        print(f"[finance-mcp] Auth error: {e}", file=sys.stderr)
        print(
            "[finance-mcp] Check SUPABASE_URL, SUPABASE_SERVICE_KEY, and "
            "SUPABASE_USER_JWT in .env",
            file=sys.stderr,
        )
        sys.exit(1)

    print(f"[finance-mcp] stdio mode. User: {_stdio_user_id}", file=sys.stderr)

# ---------------------------------------------------------------------------
# Register tools (same regardless of transport)
# ---------------------------------------------------------------------------
transactions_tools.register(mcp, supabase)
budgets_tools.register(mcp, supabase)
goals_tools.register(mcp, supabase)
net_worth_tools.register(mcp, supabase)
liabilities_tools.register(mcp, supabase)

# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    mcp.run(transport="sse" if _transport == "sse" else "stdio")
