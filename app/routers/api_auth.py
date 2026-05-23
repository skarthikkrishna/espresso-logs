"""M5 JSON auth endpoints — register, login, refresh, logout, me, admin reset-password.

All rate-limited via slowapi.  JWT access tokens are short-lived (default 15 min);
refresh tokens are HttpOnly SameSite=Strict cookies with a 30-day lifetime.
"""

from __future__ import annotations

import datetime
import re
import uuid

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response
from pydantic import BaseModel, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import current_user, require_admin
from app.models.base import get_db
from app.models.household import HouseholdMember
from app.models.user import User
from app.rate_limit import limiter
from app.repos.sql.household import HouseholdRepo
from app.repos.sql.refresh_tokens import RefreshTokenRepo
from app.repos.sql.user import UserRepo
from app.services.auth import (
    DUMMY_HASH,
    clear_refresh_cookie,
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_token,
    set_refresh_cookie,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])

_USERNAME_RE = re.compile(r"^[a-zA-Z0-9_-]+$")


# ---------------------------------------------------------------------------
# Request / response schemas
# ---------------------------------------------------------------------------


class RegisterRequest(BaseModel):
    username: str
    password: str
    display_name: str | None = None

    @field_validator("username")
    @classmethod
    def _validate_username(cls, v: str) -> str:
        if not (3 <= len(v) <= 32):
            raise ValueError("Username must be 3–32 characters")
        if not _USERNAME_RE.match(v):
            raise ValueError("Username may only contain letters, digits, _ and -")
        if v[0] in "-_" or v[-1] in "-_":
            raise ValueError("Username must not start or end with - or _")
        return v

    @field_validator("password")
    @classmethod
    def _validate_password(cls, v: str) -> str:
        if len(v) < 12:
            raise ValueError("Password must be at least 12 characters")
        if len(v.encode()) > 1024:
            raise ValueError("Password must not exceed 1024 bytes")
        return v


class LoginRequest(BaseModel):
    username: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str | None = None


class AdminPasswordResetRequest(BaseModel):
    username: str
    new_password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: uuid.UUID
    username: str | None
    display_name: str
    email: str | None
    picture_url: str | None


class RegisterOut(TokenOut):
    user: UserOut


class MeOut(BaseModel):
    id: uuid.UUID
    username: str | None
    display_name: str
    email: str | None
    picture_url: str | None
    household_id: uuid.UUID | None = None
    role: str | None = None


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------


async def seed_default_household_if_needed(db: AsyncSession, user: User) -> None:
    """Create a 'Home' household for *user* if they have no memberships (AC-090)."""
    memberships = await HouseholdRepo().get_memberships_for_user(db, user.id)
    if not memberships:
        await HouseholdRepo().seed_default_household(db, user.id)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/register", response_model=RegisterOut, status_code=201)
@limiter.limit("5/minute")
async def register(
    request: Request,
    response: Response,
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> RegisterOut:
    """Register a new user account with username + password (AC-010 to AC-016)."""
    display_name = body.display_name or body.username

    existing = await UserRepo().get_by_username(db, body.username)
    if existing is not None:
        raise HTTPException(status_code=409, detail="Username already taken")

    pwd_hash = hash_password(body.password)
    user = await UserRepo().create(
        db,
        username=body.username,
        password_hash=pwd_hash,
        google_sub=None,
        email=None,
        display_name=display_name,
        picture_url=None,
    )
    await seed_default_household_if_needed(db, user)

    raw_rt, rt_hash = generate_refresh_token()
    expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=30)
    await RefreshTokenRepo().create(db, user_id=user.id, token_hash=rt_hash, expires_at=expires_at)
    await db.commit()

    access_token = create_access_token(user.id)
    set_refresh_cookie(response, raw_rt)

    return RegisterOut(
        access_token=access_token,
        user=UserOut(
            id=user.id,
            username=user.username,
            display_name=user.display_name,
            email=user.email,
            picture_url=user.picture_url,
        ),
    )


@router.post("/login", response_model=TokenOut)
@limiter.limit("10/minute")
async def login(
    request: Request,
    response: Response,
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenOut:
    """Authenticate with username + password, return JWT + set rt cookie (AC-020 to AC-026)."""
    user = await UserRepo().get_by_username(db, body.username)

    if user is None:
        # Timing oracle defence: perform dummy hash comparison even when user not found
        verify_password(body.password, DUMMY_HASH)
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Lockout check (AC-023)
    now = datetime.datetime.now(datetime.timezone.utc)
    if user.locked_until is not None and user.locked_until > now:
        raise HTTPException(
            status_code=429,
            detail="Too many failed attempts. Account locked temporarily.",
        )

    if not verify_password(body.password, user.password_hash or ""):
        await UserRepo().increment_login_attempts(db, user.id)
        await db.commit()
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Successful authentication
    await UserRepo().reset_login_state(db, user.id)
    await seed_default_household_if_needed(db, user)

    raw_rt, rt_hash = generate_refresh_token()
    expires_at = now + datetime.timedelta(days=30)
    await RefreshTokenRepo().create(db, user_id=user.id, token_hash=rt_hash, expires_at=expires_at)
    await db.commit()

    access_token = create_access_token(user.id)
    set_refresh_cookie(response, raw_rt)
    return TokenOut(access_token=access_token)


@router.post("/refresh", response_model=TokenOut)
@limiter.limit("20/minute")
async def refresh_token(
    request: Request,
    response: Response,
    body: RefreshRequest = RefreshRequest(),
    rt: str | None = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
) -> TokenOut:
    """Rotate a refresh token and issue a new access token (AC-030 to AC-034)."""
    raw = rt or (body.refresh_token if body else None)
    if not raw:
        raise HTTPException(status_code=401, detail="Refresh token missing")

    token_hash = hash_token(raw)
    stored = await RefreshTokenRepo().rotate(db, token_hash)
    if stored is None:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    now = datetime.datetime.now(datetime.timezone.utc)
    new_raw, new_hash = generate_refresh_token()
    new_expires = now + datetime.timedelta(days=30)
    await RefreshTokenRepo().create(
        db, user_id=stored.user_id, token_hash=new_hash, expires_at=new_expires
    )
    await db.commit()

    access_token = create_access_token(stored.user_id)
    set_refresh_cookie(response, new_raw)
    return TokenOut(access_token=access_token)


@router.post("/logout")
async def logout(
    response: Response,
    rt: str | None = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    """Revoke the refresh token (best-effort) and clear the rt cookie (AC-040 to AC-042)."""
    if rt and db is not None:
        try:
            stored = await RefreshTokenRepo().get_by_hash(db, hash_token(rt))
            if stored and not stored.revoked:
                await RefreshTokenRepo().revoke(db, stored.id)
                await db.commit()
        except Exception:
            pass
    clear_refresh_cookie(response)
    return {}


@router.get("/me", response_model=MeOut)
async def get_me(
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> MeOut:
    """Return the authenticated user's profile and household info (AC-050 to AC-051)."""
    household_id: uuid.UUID | None = None
    role: str | None = None
    if db is not None:
        memberships = await HouseholdRepo().get_memberships_for_user(db, user.id)
        if memberships:
            m = memberships[0]
            household_id = m.household_id
            role = m.role
    return MeOut(
        id=user.id,
        username=user.username,
        display_name=user.display_name,
        email=user.email,
        picture_url=user.picture_url,
        household_id=household_id,
        role=role,
    )


@router.post("/admin/reset-password")
async def admin_reset_password(
    body: AdminPasswordResetRequest,
    caller_membership: HouseholdMember = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    """Allow an admin to reset another user's password within the same household (US-012)."""
    if len(body.new_password) < 12:
        raise HTTPException(status_code=422, detail="Password must be at least 12 characters")
    if len(body.new_password.encode()) > 1024:
        raise HTTPException(status_code=422, detail="Password must not exceed 1024 bytes")

    target = await UserRepo().get_by_username(db, body.username)
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")

    household_repo = HouseholdRepo()
    shared_membership = await household_repo.get_member(
        db,
        caller_membership.household_id,
        target.id,
    )
    if shared_membership is None:
        raise HTTPException(status_code=404, detail="User not found")

    new_hash = hash_password(body.new_password)
    await UserRepo().update_password_hash(db, target.id, new_hash)
    await db.commit()
    return {"ok": True}
