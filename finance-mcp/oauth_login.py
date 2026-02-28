"""
oauth_login.py — Starlette routes for the OAuth 2.0 login form.

Two routes are exposed (added to mcp._custom_starlette_routes in server.py):

  GET  /oauth/login?rid={request_id}
       Renders an HTML login form. `rid` identifies the pending OAuth request
       stored in oauth_pending_requests.

  POST /oauth/login
       Validates the user's credentials via Supabase Auth, issues an
       authorization code, marks the pending request expired, and redirects
       the client back to its redirect_uri with ?code=...&state=...
"""

import secrets
from datetime import datetime, timedelta, timezone

from starlette.requests import Request
from starlette.responses import HTMLResponse, RedirectResponse
from starlette.routing import Route
from supabase import Client

from mcp.server.auth.provider import construct_redirect_uri

import db

AUTH_CODE_LIFETIME = 300  # 5 minutes — must match oauth_provider.py


# ---------------------------------------------------------------------------
# HTML helpers
# ---------------------------------------------------------------------------

def _login_page(rid: str, error: str = "") -> str:
    """Return the full HTML for the login form, with an optional error message."""
    error_block = (
        f'<div class="error">{error}</div>' if error else ""
    )
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sign in — Personal Finance</title>
  <style>
    *, *::before, *::after {{ box-sizing: border-box; }}
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f5f5f5;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
    }}
    .card {{
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 4px 24px rgba(0,0,0,.08);
      padding: 2.5rem;
      width: 100%;
      max-width: 380px;
    }}
    h1 {{
      font-size: 1.25rem;
      font-weight: 600;
      margin: 0 0 .25rem;
      color: #111;
    }}
    .subtitle {{
      font-size: .875rem;
      color: #666;
      margin: 0 0 1.5rem;
    }}
    label {{
      display: block;
      font-size: .8125rem;
      font-weight: 500;
      color: #333;
      margin-bottom: .375rem;
    }}
    input {{
      width: 100%;
      padding: .625rem .75rem;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: .9375rem;
      outline: none;
      margin-bottom: 1rem;
      transition: border-color .15s;
    }}
    input:focus {{ border-color: #2563eb; }}
    button {{
      width: 100%;
      padding: .6875rem;
      background: #2563eb;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: .9375rem;
      font-weight: 500;
      cursor: pointer;
      transition: background .15s;
    }}
    button:hover {{ background: #1d4ed8; }}
    .error {{
      background: #fef2f2;
      border: 1px solid #fca5a5;
      color: #b91c1c;
      border-radius: 8px;
      padding: .625rem .75rem;
      font-size: .8125rem;
      margin-bottom: 1rem;
    }}
  </style>
</head>
<body>
  <div class="card">
    <h1>Personal Finance</h1>
    <p class="subtitle">Sign in to connect Claude to your financial data.</p>
    {error_block}
    <form method="POST" action="/oauth/login">
      <input type="hidden" name="rid" value="{rid}">
      <label for="email">Email</label>
      <input type="email" id="email" name="email" autocomplete="email" required>
      <label for="password">Password</label>
      <input type="password" id="password" name="password"
             autocomplete="current-password" required>
      <button type="submit">Sign in</button>
    </form>
  </div>
</body>
</html>"""


# ---------------------------------------------------------------------------
# Route handlers
# ---------------------------------------------------------------------------

def make_login_routes(supabase: Client) -> list[Route]:
    """
    Return the two Starlette Route objects for the OAuth login form.
    Call this after creating the FastMCP instance and extend
    mcp._custom_starlette_routes with the result.
    """

    async def get_login(request: Request) -> HTMLResponse:
        rid = request.query_params.get("rid", "")
        if not rid:
            return HTMLResponse("Missing authorization request ID.", status_code=400)
        pending = db.get_pending_request(supabase, rid)
        if not pending:
            return HTMLResponse(
                "Authorization request expired or not found. "
                "Please restart the connection from Claude.",
                status_code=400,
            )
        return HTMLResponse(_login_page(rid))

    async def post_login(request: Request) -> HTMLResponse | RedirectResponse:
        form = await request.form()
        rid = str(form.get("rid", ""))
        email = str(form.get("email", ""))
        password = str(form.get("password", ""))

        if not rid:
            return HTMLResponse("Missing authorization request ID.", status_code=400)

        # Reload the pending request (re-checks expiry).
        pending = db.get_pending_request(supabase, rid)
        if not pending:
            return HTMLResponse(
                _login_page(rid, "Authorization request expired. Please try again."),
                status_code=400,
            )

        # Validate credentials via Supabase Auth.
        try:
            response = supabase.auth.sign_in_with_password(
                {"email": email, "password": password}
            )
            user = response.user
            if not user:
                raise ValueError("No user in response")
        except Exception:
            # Return 200 so the browser stays on the form (not a redirect).
            return HTMLResponse(
                _login_page(rid, "Invalid email or password."),
                status_code=200,
            )

        # Issue an authorization code (160 bits of entropy, per RFC 6749 §10.10).
        code = secrets.token_urlsafe(20)
        expires_at = (datetime.now(timezone.utc) + timedelta(seconds=AUTH_CODE_LIFETIME)).isoformat()

        db.save_auth_code(supabase, {
            "code": code,
            "client_id": pending["client_id"],
            "user_id": str(user.id),
            "redirect_uri": pending["redirect_uri"],
            "code_challenge": pending["code_challenge"],
            "scopes": pending.get("scopes") or [],
            "expires_at": expires_at,
        })

        # Mark the pending request consumed so it cannot be replayed.
        db.expire_pending_request(supabase, rid)

        # Build redirect URI and send the client back with the code + state.
        redirect_url = construct_redirect_uri(
            pending["redirect_uri"],
            code=code,
            state=pending.get("state"),
        )
        return RedirectResponse(redirect_url, status_code=302)

    return [
        Route("/oauth/login", endpoint=get_login, methods=["GET"]),
        Route("/oauth/login", endpoint=post_login, methods=["POST"]),
    ]
