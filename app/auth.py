"""Google OAuth2 callback routes — PKCE flow with oauth_states DB storage (M5)."""

from __future__ import annotations

import base64
import datetime
import hashlib
import logging
import secrets
from typing import Any
from urllib.parse import urlencode

import sqlalchemy as sa
from authlib.integrations.httpx_client import AsyncOAuth2Client  # type: ignore[import-untyped]
from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.base import get_db
from app.models.household import OAuthState
from app.models.user import User
from app.repos.sql.household import HouseholdRepo  # noqa: F401 - preserved for test patch targets
from app.repos.sql.refresh_tokens import RefreshTokenRepo
from app.repos.sql.user import UserRepo
from app.services.auth import (
    create_access_token,
    generate_refresh_token,
    hash_token,
    set_refresh_cookie,
)

logger = logging.getLogger(__name__)

GOOGLE_AUTHORIZATION_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"
GOOGLE_SCOPE = "openid email profile"

router = APIRouter(prefix="/auth", tags=["auth"])


def _oauth_redirect_uri(request: Request) -> str:
    return settings.oauth_redirect_uri or str(request.url_for("google_callback"))


def _pkce_code_challenge(code_verifier: str) -> str:
    digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


def _build_google_authorize_url(*, request: Request, state: str, code_challenge: str) -> str:
    params = {
        "client_id": settings.google_oauth_client_id,
        "redirect_uri": _oauth_redirect_uri(request),
        "response_type": "code",
        "scope": GOOGLE_SCOPE,
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
    }
    return f"{GOOGLE_AUTHORIZATION_URL}?{urlencode(params)}"


@router.get("/google")
async def google_login(request: Request, db: AsyncSession = Depends(get_db)) -> Any:
    """Initiate Google OAuth flow with PKCE verifier stored in oauth_states table."""
    if db is None:
        logger.error("Google OAuth requires oauth_states persistence")
        return RedirectResponse(url="/login?error=oauth_failed", status_code=302)

    state = secrets.token_urlsafe(32)
    code_verifier = secrets.token_urlsafe(64)
    code_challenge = _pkce_code_challenge(code_verifier)

    db.add(
        OAuthState(
            state_hash=hash_token(state),
            pkce_verifier=code_verifier,
            expires_at=datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=5),
        )
    )

    try:
        await db.commit()
    except Exception:
        logger.warning("Failed to persist oauth_state", exc_info=True)
        await db.rollback()
        return RedirectResponse(url="/login?error=oauth_failed", status_code=302)

    authorize_url = _build_google_authorize_url(
        request=request,
        state=state,
        code_challenge=code_challenge,
    )
    return RedirectResponse(url=authorize_url, status_code=302)


@router.get("/google/callback", name="google_callback")
async def google_callback(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> RedirectResponse:
    """Handle Google OAuth callback; issue JWT + rt cookie and redirect to SPA (AC-061).

    ALLOWLIST_EMAILS is intentionally NOT checked here (AC-063).
    """
    try:
        if db is None:
            logger.error("Google OAuth callback requires oauth_states persistence")
            return RedirectResponse(url="/login?error=oauth_failed", status_code=302)

        state = request.query_params.get("state", "")
        code = request.query_params.get("code", "")
        if not state or not code:
            return RedirectResponse(url="/login?error=oauth_failed", status_code=302)

        result = await db.execute(
            sa.select(OAuthState).where(OAuthState.state_hash == hash_token(state))
        )
        oauth_state: OAuthState | None = result.scalar_one_or_none()

        if oauth_state is None:
            logger.warning("oauth_state not found for state hash")
            return RedirectResponse(url="/login?error=oauth_failed", status_code=302)

        now = datetime.datetime.now(datetime.timezone.utc)
        if oauth_state.expires_at < now:
            await db.delete(oauth_state)
            await db.commit()
            logger.warning("oauth_state expired")
            return RedirectResponse(url="/login?error=oauth_failed", status_code=302)

        pkce_verifier = oauth_state.pkce_verifier
        await db.delete(oauth_state)
        await db.flush()

        redirect_uri = _oauth_redirect_uri(request)
        async with AsyncOAuth2Client(
            client_id=settings.google_oauth_client_id,
            client_secret=settings.google_oauth_client_secret,
            redirect_uri=redirect_uri,
            scope=GOOGLE_SCOPE,
        ) as oauth_client:
            await oauth_client.fetch_token(
                GOOGLE_TOKEN_URL,
                grant_type="authorization_code",
                code=code,
                redirect_uri=redirect_uri,
                code_verifier=pkce_verifier,
            )
            userinfo_response = await oauth_client.get(GOOGLE_USERINFO_URL)
            userinfo_response.raise_for_status()
            raw_userinfo: Any = userinfo_response.json()
            userinfo: dict[str, Any] = raw_userinfo if isinstance(raw_userinfo, dict) else {}
        google_sub: str = str(userinfo.get("sub", ""))
        email: str = str(userinfo.get("email", "")).lower()
        name: str = str(userinfo.get("name", ""))
        picture: str = str(userinfo.get("picture", ""))

        if not google_sub:
            return RedirectResponse(url="/login?error=oauth_failed", status_code=302)

        # Upsert user by google_sub
        user: User | None = await UserRepo().get_by_google_sub(db, google_sub)
        if user is None:
            user = await UserRepo().create(
                db,
                username=None,
                password_hash=None,
                google_sub=google_sub,
                email=email or None,
                display_name=name or email or google_sub,
                picture_url=picture or None,
            )
        else:
            # Refresh profile fields
            await db.execute(
                sa.update(User)
                .where(User.id == user.id)
                .values(
                    email=email or user.email,
                    display_name=name or user.display_name,
                    picture_url=picture or user.picture_url,
                    last_seen_at=sa.text("NOW()"),
                )
            )
            await db.flush()
            await db.refresh(user)

        raw_rt, rt_hash = generate_refresh_token()
        expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=30)
        await RefreshTokenRepo().create(
            db, user_id=user.id, token_hash=rt_hash, expires_at=expires_at
        )
        await db.commit()

        access_token = create_access_token(user.id)
        response = RedirectResponse(url="/login?oauth_success=1", status_code=302)
        set_refresh_cookie(response, raw_rt)
        response.headers["x-access-token"] = access_token  # available for SPA pickup via JS
        return response

    except Exception:
        if db is not None:
            await db.rollback()
        logger.warning("OAuth callback error", exc_info=True)
        return RedirectResponse(url="/login?error=oauth_failed", status_code=302)


@router.get("/logout")
async def logout(request: Request) -> RedirectResponse:
    """Redirect to login (session-less; rt cookie is cleared client-side via /auth/logout POST)."""
    return RedirectResponse(url="/auth/login", status_code=302)


# ---------------------------------------------------------------------------
# Legacy redirect: /auth/login → /auth/google (supports bookmarked URLs)
# ---------------------------------------------------------------------------


@router.get("/login")
async def login_redirect(request: Request) -> Any:
    """Redirect legacy /auth/login to /auth/google."""
    return RedirectResponse(url="/auth/google", status_code=302)
