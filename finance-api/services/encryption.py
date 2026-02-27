"""
services/encryption.py — Fernet symmetric encryption for Plaid access tokens.

Why we encrypt: Plaid access tokens grant access to a user's full bank history.
Storing them encrypted at rest means a database breach alone is not enough to
compromise bank data — the attacker would also need the ENCRYPTION_KEY.

Setup:
    Generate a key once and store it in your .env as ENCRYPTION_KEY:
        python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

    The same key must be used for all encrypt/decrypt operations, so never rotate
    it without first decrypting all stored tokens with the old key.
"""

import os
from cryptography.fernet import Fernet
from dotenv import load_dotenv

load_dotenv()


def _get_fernet() -> Fernet:
    key = os.getenv("ENCRYPTION_KEY")
    if not key:
        raise RuntimeError(
            "ENCRYPTION_KEY must be set in .env. "
            "Generate one with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
        )
    return Fernet(key.encode())


def encrypt(value: str) -> str:
    """Encrypt a plaintext string. Returns a URL-safe base64-encoded string."""
    return _get_fernet().encrypt(value.encode()).decode()


def decrypt(value: str) -> str:
    """Decrypt a previously encrypted string back to plaintext."""
    return _get_fernet().decrypt(value.encode()).decode()
