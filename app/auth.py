"""Google OAuth2 callback routes — PKCE flow with oauth_states DB storage (M5).

PKCE verifiers are stored in the ``oauth_states`` table (not SessionMiddleware)
so SessionMiddleware can be removed in US-3.5 (MF-001).
"""

from __future__ import annotations

import datetime
import logging
import secrets
from typing import Any

import sqlalchemy as sa
from authlib.integrations.starlette_client import OAuth  # type: ignore[import-untyped]
from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import get_db
from app.models.household import OAuthState
from app.models.user import User
from app.repos.sql.household import HouseholdRepo
from app.repos.sql.refresh_tokens import RefreshTokenRepo
from app.repos.sql.user import UserRepo
from app.services.auth import (
    create_access_token,
    generate_refresh_token,
    hash_token,
    set_refresh_cookie,
)
from app.config import settings

logger = logging.getLogger(__name__)

oauth = OAuth()
oauth.register(
    name="google",
    client_id=settings.google_oauth_client_id,
    client_secret=settings.google_oauth_client_secret,
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile", "code_challenge_method": "S256"},
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/google")
async def google_login(request: Request, db: AsyncSession = Depends(get_db)) -> Any:
    """Initiate Google OAuth flow with PKCE verifier stored in oauth_states table.

    State and PKCE verifier are persisted in the DB (not request.session) so
    SessionMiddleware is not required (MF-001).
    """
    pkce_verifier = secrets.token_urlsafe(64)
    state = secrets.token_urlsafe(32)

    state_hash = hash_token(state)
    expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=5)

    if db is not None:
        oauth_state = OAuthState(
            state_hash=state_hash,
            pkce_verifier=pkce_verifier,
            expires_at=expires_at,
        )
        db.add(oauth_state)
        try:
            await db.commit()
        except Exception:
            logger.warning(
                "Failed to persist oauth_state — falling through without PKCE", exc_info=True
            )

    redirect_uri = settings.oauth_redirect_uri or str(request.url_for("google_callback"))
    return await oauth.google.authorize_redirect(
        request,
        redirect_uri,
        state=state,
        code_verifier=pkce_verifier,
    )


@router.get("/google/callback", name="google_callback")
async def google_callback(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> RedirectResponse:
    """Handle Google OAuth callback; issue JWT + rt cookie and redirect to SPA (AC-061).

    ALLOWLIST_EMAILS is intentionally NOT checked here (AC-063).
    """
    try:
        state = request.query_params.get("state", "")
        pkce_verifier: str | None = None

        if db is not None and state:
            state_hash = hash_token(state)
            result = await db.execute(
                sa.select(OAuthState).where(OAuthState.state_hash == state_hash)
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

        token = await oauth.google.authorize_access_token(
            request,
            code_verifier=pkce_verifier,
        )
        userinfo: dict[str, Any] = token.get("userinfo") or {}
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

        # Seed default household if first login (AC-090)
        memberships = await HouseholdRepo().get_memberships_for_user(db, user.id)
        if not memberships:
            await HouseholdRepo().seed_default_household(db, user.id)

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
