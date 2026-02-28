"""
oauth_provider.py — OAuthAuthorizationServerProvider implementation for the
Personal Finance MCP server.

All state is stored in Supabase. Raw tokens are never persisted — only their
SHA-256 hashes. The `resource` field of AccessToken carries the user_id so
MCP tool functions can read it via get_access_token().resource.
"""

import hashlib
import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from pydantic import AnyUrl

from mcp.server.auth.provider import (
    AccessToken,
    AuthorizationCode,
    AuthorizationParams,
    OAuthAuthorizationServerProvider,
    RefreshToken,
    TokenError,
)
from mcp.shared.auth import OAuthClientInformationFull, OAuthToken
from supabase import Client

import db

# ---------------------------------------------------------------------------
# Token lifetime constants (seconds)
# ---------------------------------------------------------------------------

ACCESS_TOKEN_LIFETIME = 3600            # 1 hour
REFRESH_TOKEN_LIFETIME = 30 * 24 * 3600  # 30 days
AUTH_CODE_LIFETIME = 300                # 5 minutes (used by oauth_login.py too)
PENDING_REQUEST_LIFETIME = 600          # 10 minutes


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _sha256(token: str) -> str:
    """Return the hex-encoded SHA-256 hash of a token string."""
    return hashlib.sha256(token.encode()).hexdigest()


def _utc_plus(seconds: int) -> datetime:
    """Return a timezone-aware UTC datetime `seconds` from now."""
    return datetime.now(timezone.utc) + timedelta(seconds=seconds)


# ---------------------------------------------------------------------------
# Extended types — SDK comment: "it's OK to add fields to subclasses"
# ---------------------------------------------------------------------------

class FinanceAuthCode(AuthorizationCode):
    """AuthorizationCode extended with the authenticated user_id."""
    user_id: str


# ---------------------------------------------------------------------------
# Provider
# ---------------------------------------------------------------------------

class FinanceOAuthProvider:
    """
    OAuth 2.0 authorization server backed by Supabase.
    Implements the OAuthAuthorizationServerProvider protocol.
    """

    def __init__(self, supabase: Client) -> None:
        self._sb = supabase
        self._server_url = os.getenv("MCP_SERVER_URL", "http://localhost:8000").rstrip("/")

    # ------------------------------------------------------------------
    # Client registry
    # ------------------------------------------------------------------

    async def get_client(self, client_id: str) -> OAuthClientInformationFull | None:
        row = db.get_oauth_client(self._sb, client_id)
        if not row:
            return None
        return OAuthClientInformationFull(
            client_id=row["client_id"],
            client_secret=None,          # never return the hash as the secret
            redirect_uris=[AnyUrl(uri) for uri in (row.get("redirect_uris") or [])],
            grant_types=row.get("grant_types") or ["authorization_code", "refresh_token"],
            client_name=row.get("client_name"),
            scope=row.get("scope"),
        )

    async def register_client(self, client_info: OAuthClientInformationFull) -> None:
        secret_hash = _sha256(client_info.client_secret) if client_info.client_secret else None
        db.save_oauth_client(self._sb, {
            "client_id": client_info.client_id,
            "client_secret_hash": secret_hash,
            "redirect_uris": [str(uri) for uri in (client_info.redirect_uris or [])],
            "grant_types": client_info.grant_types or ["authorization_code", "refresh_token"],
            "client_name": client_info.client_name,
            "scope": client_info.scope,
        })

    # ------------------------------------------------------------------
    # Authorization — redirect to our login form
    # ------------------------------------------------------------------

    async def authorize(
        self,
        client: OAuthClientInformationFull,
        params: AuthorizationParams,
    ) -> str:
        """
        Store the authorization request and redirect to the login form.
        The login form (oauth_login.py) will issue the actual auth code after
        the user signs in with their Supabase credentials.
        """
        rid = str(uuid.uuid4())
        db.save_pending_request(self._sb, {
            "id": rid,
            "client_id": client.client_id,
            "redirect_uri": str(params.redirect_uri),
            "code_challenge": params.code_challenge,
            "state": params.state,
            "scopes": params.scopes or [],
            "expires_at": _utc_plus(PENDING_REQUEST_LIFETIME).isoformat(),
        })
        return f"{self._server_url}/oauth/login?rid={rid}"

    async def load_authorization_code(
        self,
        client: OAuthClientInformationFull,
        authorization_code: str,
    ) -> FinanceAuthCode | None:
        row = db.get_auth_code(self._sb, authorization_code)
        if not row or row["client_id"] != client.client_id:
            return None
        return FinanceAuthCode(
            code=row["code"],
            scopes=row.get("scopes") or [],
            expires_at=datetime.fromisoformat(
                row["expires_at"].replace("Z", "+00:00")
            ).timestamp(),
            client_id=row["client_id"],
            code_challenge=row["code_challenge"],
            redirect_uri=AnyUrl(row["redirect_uri"]),
            redirect_uri_provided_explicitly=True,
            user_id=row["user_id"],
        )

    async def exchange_authorization_code(
        self,
        client: OAuthClientInformationFull,
        authorization_code: FinanceAuthCode,
    ) -> OAuthToken:
        # Mark code used before issuing tokens (prevents replay attacks).
        db.mark_auth_code_used(self._sb, authorization_code.code)

        access_token = secrets.token_urlsafe(32)   # 256 bits
        refresh_token = secrets.token_urlsafe(32)
        at_expires = _utc_plus(ACCESS_TOKEN_LIFETIME)
        rt_expires = _utc_plus(REFRESH_TOKEN_LIFETIME)

        db.save_mcp_session(self._sb, {
            "user_id": authorization_code.user_id,
            "client_id": client.client_id,
            "access_token_hash": _sha256(access_token),
            "refresh_token_hash": _sha256(refresh_token),
            "scopes": authorization_code.scopes,
            "access_token_expires_at": at_expires.isoformat(),
            "refresh_token_expires_at": rt_expires.isoformat(),
        })

        scope_str = " ".join(authorization_code.scopes) if authorization_code.scopes else None
        return OAuthToken(
            access_token=access_token,
            token_type="Bearer",
            expires_in=ACCESS_TOKEN_LIFETIME,
            scope=scope_str,
            refresh_token=refresh_token,
        )

    # ------------------------------------------------------------------
    # Refresh token flow
    # ------------------------------------------------------------------

    async def load_refresh_token(
        self,
        client: OAuthClientInformationFull,
        refresh_token: str,
    ) -> RefreshToken | None:
        session = db.get_session_by_refresh_token_hash(self._sb, _sha256(refresh_token))
        if not session or session["client_id"] != client.client_id:
            return None
        rt_expires = datetime.fromisoformat(
            session["refresh_token_expires_at"].replace("Z", "+00:00")
        )
        return RefreshToken(
            token=refresh_token,       # pass raw token through for exchange step
            client_id=session["client_id"],
            scopes=session.get("scopes") or [],
            expires_at=int(rt_expires.timestamp()),
        )

    async def exchange_refresh_token(
        self,
        client: OAuthClientInformationFull,
        refresh_token: RefreshToken,
        scopes: list[str],
    ) -> OAuthToken:
        """Rotate both tokens: delete old hashes, issue new ones."""
        session = db.get_session_by_refresh_token_hash(self._sb, _sha256(refresh_token.token))
        if not session or session["client_id"] != client.client_id:
            raise TokenError(
                error="invalid_grant",
                error_description="Refresh token not found or expired.",
            )

        new_at = secrets.token_urlsafe(32)
        new_rt = secrets.token_urlsafe(32)
        at_expires = _utc_plus(ACCESS_TOKEN_LIFETIME)
        rt_expires = _utc_plus(REFRESH_TOKEN_LIFETIME)

        db.update_mcp_session_tokens(
            self._sb,
            session["id"],
            new_access_hash=_sha256(new_at),
            new_refresh_hash=_sha256(new_rt),
            access_expires_at=at_expires.isoformat(),
            refresh_expires_at=rt_expires.isoformat(),
        )

        effective_scopes = scopes or session.get("scopes") or []
        scope_str = " ".join(effective_scopes) if effective_scopes else None
        return OAuthToken(
            access_token=new_at,
            token_type="Bearer",
            expires_in=ACCESS_TOKEN_LIFETIME,
            scope=scope_str,
            refresh_token=new_rt,
        )

    # ------------------------------------------------------------------
    # Access token verification (called on every MCP request)
    # ------------------------------------------------------------------

    async def load_access_token(self, token: str) -> AccessToken | None:
        session = db.get_session_by_access_token_hash(self._sb, _sha256(token))
        if not session:
            return None
        at_expires = datetime.fromisoformat(
            session["access_token_expires_at"].replace("Z", "+00:00")
        )
        return AccessToken(
            token=token,
            client_id=session["client_id"],
            scopes=session.get("scopes") or [],
            expires_at=int(at_expires.timestamp()),
            resource=session["user_id"],   # read by tools via get_access_token().resource
        )

    # ------------------------------------------------------------------
    # Revocation
    # ------------------------------------------------------------------

    async def revoke_token(self, token: AccessToken | RefreshToken) -> None:
        """Delete the entire session regardless of which token is provided."""
        token_hash = _sha256(token.token)
        if isinstance(token, AccessToken):
            db.delete_session_by_access_hash(self._sb, token_hash)
        else:
            db.delete_session_by_refresh_hash(self._sb, token_hash)
