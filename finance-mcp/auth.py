"""
auth.py — Resolve the authenticated user's ID from a Supabase JWT.

Phase 1: the JWT is stored in SUPABASE_USER_JWT in the .env file.
Phase 5: this will be extracted from the SSE request Authorization header instead.
"""

import os
from supabase import Client


def get_user_id(supabase: Client) -> str:
    """
    Validate the Supabase JWT from the environment and return the user's UUID.
    Raises ValueError if the JWT is missing or invalid.
    """
    jwt = os.getenv("SUPABASE_USER_JWT")
    if not jwt:
        raise ValueError(
            "SUPABASE_USER_JWT is not set. "
            "Copy .env.example to .env and add your token."
        )

    # get_user() validates the JWT against Supabase Auth and returns the user record.
    response = supabase.auth.get_user(jwt)
    if not response or not response.user:
        raise ValueError("Invalid or expired JWT — could not resolve user.")

    return response.user.id
