"""
middleware/auth.py — Supabase JWT verification for every protected route.

Usage (in any router):
    from middleware.auth import get_current_user
    from fastapi import Depends

    @router.get("/something")
    def my_route(user: dict = Depends(get_current_user)):
        user_id = user["id"]
        ...

The caller must send:
    Authorization: Bearer <supabase-user-jwt>
"""

import os
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# HTTPBearer parses the "Authorization: Bearer <token>" header automatically.
bearer_scheme = HTTPBearer()


def _get_supabase() -> Client:
    """Return a Supabase service-role client (used only to verify JWTs)."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")
    return create_client(url, key)


# Create the Supabase client once at import time — it's stateless and safe to reuse.
_supabase: Client = _get_supabase()


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
) -> dict:
    """
    Dependency that verifies a Supabase JWT and returns the authenticated user.

    Raises HTTP 401 if the token is missing, expired, or invalid.
    Returns a dict with at least: {"id": "<uuid>", "email": "<email>"}
    """
    token = credentials.credentials

    try:
        # Supabase's get_user() validates the JWT signature and expiry.
        response = _supabase.auth.get_user(token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not response or not response.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = response.user
    return {"id": str(user.id), "email": user.email}


def get_supabase_client() -> Client:
    """Dependency that returns the shared Supabase service-role client."""
    return _supabase
