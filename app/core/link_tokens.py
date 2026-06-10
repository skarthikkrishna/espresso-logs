from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.config import settings


def _fernet_key_material() -> list[bytes]:
    raw_keys = settings.link_token_fernet_keys
    if raw_keys:
        keys = [key.strip().encode("utf-8") for key in raw_keys.split(",") if key.strip()]
        if not keys:
            raise RuntimeError("LINK_TOKEN_FERNET_KEYS must contain at least one Fernet key")
        for key in keys:
            Fernet(key)
        return keys

    if settings.is_production:
        raise RuntimeError("LINK_TOKEN_FERNET_KEYS is required in production")

    seed = settings.jwt_secret or settings.session_secret
    if not seed:
        raise RuntimeError(
            "JWT_SECRET or SESSION_SECRET is required for local link-token encryption"
        )
    return [base64.urlsafe_b64encode(hashlib.sha256(seed.encode("utf-8")).digest())]


def encrypt_display_token(raw_token: str) -> str:
    """Encrypt a bearer link token for authorized admin copy/display."""

    return Fernet(_fernet_key_material()[0]).encrypt(raw_token.encode("utf-8")).decode("utf-8")


def decrypt_display_token(ciphertext: str | None) -> str | None:
    """Return the raw token for authorized display, or None when unavailable."""

    if not ciphertext:
        return None
    try:
        for key in _fernet_key_material():
            try:
                return Fernet(key).decrypt(ciphertext.encode("utf-8")).decode("utf-8")
            except InvalidToken:
                continue
    except RuntimeError:
        return None
    return None
