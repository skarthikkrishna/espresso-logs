"""Core authentication service — password hashing, JWT, and refresh token lifecycle.

All cryptographic operations for M5 password-based auth live here.
Depends on settings.jwt_secret (min 32 chars) and settings.access_token_expire_seconds.
"""

from __future__ import annotations

import base64
import datetime
import hashlib
import secrets
import uuid

from fastapi import HTTPException, Response
from jose import JWTError, jwt  # type: ignore[import-untyped]
from passlib.context import CryptContext  # type: ignore[import-untyped]

from app.config import settings

# ---------------------------------------------------------------------------
# Password hashing context — argon2id with explicit parameters (AC-015)
# ---------------------------------------------------------------------------

pwd_context = CryptContext(
    schemes=["argon2"],
    argon2__memory_cost=19456,
    argon2__time_cost=2,
    argon2__parallelism=1,
    deprecated="auto",
)

# Timing-oracle defence (MF-003): pre-hashed constant used in login code paths
# when the username does not exist. Calling pwd_context.verify(candidate, DUMMY_HASH)
# ensures the response time matches a real password check, preventing user enumeration.
DUMMY_HASH: str = pwd_context.hash(secrets.token_hex(16))

_ALGORITHM = "HS256"


# ---------------------------------------------------------------------------
# Password helpers
# ---------------------------------------------------------------------------


def hash_password(password: str) -> str:
    """Hash a plaintext password with argon2id.

    Raises ValueError if the encoded password exceeds 1024 bytes — prevents
    DoS via bcrypt/argon2 length amplification attacks.
    """
    if len(password.encode()) > 1024:
        raise ValueError("Password must not exceed 1024 bytes")
    return str(pwd_context.hash(password))


def verify_password(plain: str, hashed: str) -> bool:
    """Return True if *plain* matches the stored *hashed* argon2id digest."""
    return bool(pwd_context.verify(plain, hashed))


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------


def create_access_token(user_id: uuid.UUID) -> str:
    """Create a signed HS256 JWT access token for *user_id*.

    Raises RuntimeError if jwt_secret is shorter than 32 characters.
    """
    secret = settings.jwt_secret
    if len(secret) < 32:
        raise RuntimeError("jwt_secret must be at least 32 characters to issue tokens")
    now = datetime.datetime.now(datetime.timezone.utc)
    expire = now + datetime.timedelta(seconds=settings.access_token_expire_seconds)
    payload = {
        "sub": str(user_id),
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    return str(jwt.encode(payload, secret, algorithm=_ALGORITHM))


def decode_access_token(token: str) -> uuid.UUID:
    """Decode and validate a JWT access token, returning the user_id UUID.

    Raises HTTPException(401) on any decode error, including expired tokens.
    """
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[_ALGORITHM])
        sub: str | None = payload.get("sub")
        if not sub:
            raise JWTError("missing sub claim")
        return uuid.UUID(sub)
    except (JWTError, ValueError) as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired token") from exc


# ---------------------------------------------------------------------------
# Refresh token helpers
# ---------------------------------------------------------------------------


def generate_refresh_token() -> tuple[str, str]:
    """Generate a new refresh token pair.

    Returns ``(raw_token, token_hash)`` where:
    - *raw_token* is a URL-safe base64-encoded 32-byte random value (sent to client)
    - *token_hash* is the SHA-256 hex digest of raw_token (stored in DB)
    """
    raw = base64.urlsafe_b64encode(secrets.token_bytes(32)).decode()
    token_hash = hashlib.sha256(raw.encode()).hexdigest()
    return raw, token_hash


def hash_token(raw: str) -> str:
    """Return the SHA-256 hex digest of *raw*.

    Reused for invitation tokens and guest tokens — only hashes are stored in DB.
    """
    return hashlib.sha256(raw.encode()).hexdigest()


# ---------------------------------------------------------------------------
# Cookie helpers
# ---------------------------------------------------------------------------


def set_refresh_cookie(response: Response, raw_token: str) -> None:
    """Set the ``rt`` HttpOnly refresh token cookie on *response*."""
    response.set_cookie(
        key="rt",
        value=raw_token,
        httponly=True,
        samesite="strict",
        secure=True,
        path="/auth",
        max_age=2592000,  # 30 days
    )


def clear_refresh_cookie(response: Response) -> None:
    """Clear the ``rt`` refresh token cookie (Max-Age=0)."""
    response.set_cookie(
        key="rt",
        value="",
        httponly=True,
        samesite="strict",
        secure=True,
        path="/auth",
        max_age=0,
    )
