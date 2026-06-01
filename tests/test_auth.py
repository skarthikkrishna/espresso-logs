"""Tests for M5 JWT-based auth and Google OAuth callback."""

import base64
import datetime
import hashlib
import uuid
from typing import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock, patch
from urllib.parse import parse_qs, urlparse

import pytest
from httpx import ASGITransport, AsyncClient
from starlette.middleware.sessions import SessionMiddleware

from app.main import app
from app.models.base import get_db
from app.models.household import OAuthState
from app.services.auth import hash_token


def _mock_async_oauth_client(*, userinfo: dict[str, str]) -> tuple[MagicMock, AsyncMock]:
    mock_oauth_client = AsyncMock()
    mock_oauth_client.fetch_token = AsyncMock()

    mock_userinfo_response = MagicMock()
    mock_userinfo_response.json.return_value = userinfo
    mock_userinfo_response.raise_for_status = MagicMock()
    mock_oauth_client.get = AsyncMock(return_value=mock_userinfo_response)

    mock_client_class = MagicMock()
    mock_client_class.return_value.__aenter__ = AsyncMock(return_value=mock_oauth_client)
    mock_client_class.return_value.__aexit__ = AsyncMock(return_value=False)
    return mock_client_class, mock_oauth_client


def _make_oauth_state(
    *,
    pkce_verifier: str = "stored-pkce-verifier",
    expires_at: datetime.datetime | None = None,
) -> MagicMock:
    oauth_state = MagicMock(spec=OAuthState)
    oauth_state.pkce_verifier = pkce_verifier
    oauth_state.expires_at = expires_at or (
        datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=10)
    )
    return oauth_state


def _make_scalar_result(value: OAuthState | None) -> MagicMock:
    result = MagicMock()
    result.scalar_one_or_none.return_value = value
    return result


# ---------------------------------------------------------------------------
# T011 — public routes (/livez, /readyz) accessible without auth
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_public_routes_no_auth():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test", follow_redirects=False
    ) as client:
        livez = await client.get("/livez")
        readyz = await client.get("/readyz")
        health = await client.get("/health")

    assert livez.status_code == 200
    assert readyz.status_code == 200
    assert health.status_code == 200


# ---------------------------------------------------------------------------
# T003 — SPA catch-all serves index (or placeholder) without requiring auth
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_spa_catchall_no_auth_required():
    """GET / now serves the SPA without server-side auth (auth is client-side in React)."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test", follow_redirects=False
    ) as client:
        response = await client.get("/")
    # Should be 200 (SPA placeholder or built index.html), not a redirect
    assert response.status_code == 200


# ---------------------------------------------------------------------------
# T010 — OAuth callback success redirects to /login?oauth_success=1
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_callback_success_redirects_to_spa() -> None:
    """Successful OAuth callback redirects to /login?oauth_success=1 and sets rt cookie."""
    fake_user = MagicMock()
    fake_user.id = uuid.UUID("00000000-0000-0000-0000-000000000099")
    fake_user.email = "test@example.com"
    fake_user.display_name = "Test User"
    fake_user.picture_url = None

    fake_oauth_state = MagicMock(spec=OAuthState)
    fake_oauth_state.pkce_verifier = "stored-pkce-verifier"
    fake_oauth_state.expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
        minutes=10
    )

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = fake_oauth_state

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mock_result)
    mock_db.delete = AsyncMock()
    mock_db.flush = AsyncMock()
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    async def _fake_db_dep() -> AsyncGenerator[AsyncMock, None]:
        yield mock_db

    mock_user_repo = MagicMock()
    mock_user_repo.return_value.get_by_google_sub = AsyncMock(return_value=None)
    mock_user_repo.return_value.create = AsyncMock(return_value=fake_user)

    mock_household_repo = MagicMock()
    mock_household_repo.return_value.get_memberships_for_user = AsyncMock(return_value=[])
    mock_household_repo.return_value.seed_default_household = AsyncMock()

    mock_rt_repo = MagicMock()
    mock_rt_repo.return_value.create = AsyncMock()

    mock_client_class, mock_oauth_client = _mock_async_oauth_client(
        userinfo={
            "sub": "google-123",
            "email": "test@example.com",
            "name": "Test User",
            "picture": "https://example.com/pic.jpg",
        }
    )

    app.dependency_overrides[get_db] = _fake_db_dep
    try:
        with (
            patch("app.auth.AsyncOAuth2Client", mock_client_class),
            patch("app.auth.UserRepo", mock_user_repo),
            patch("app.auth.HouseholdRepo", mock_household_repo),
            patch("app.auth.RefreshTokenRepo", mock_rt_repo),
            patch("app.auth.settings.google_oauth_client_id", "google-client-id"),
            patch("app.auth.settings.google_oauth_client_secret", "google-client-secret"),
            patch("app.auth.settings.oauth_redirect_uri", None),
        ):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test", follow_redirects=False
            ) as client:
                response = await client.get(
                    "/auth/google/callback?state=test-state&code=test-code",
                    follow_redirects=False,
                )
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 302
    assert "oauth_success=1" in response.headers.get("location", "")
    mock_oauth_client.fetch_token.assert_awaited_once()
    fetch_call = mock_oauth_client.fetch_token.await_args
    assert fetch_call.args == ("https://oauth2.googleapis.com/token",)
    assert fetch_call.kwargs["code"] == "test-code"
    assert fetch_call.kwargs["code_verifier"] == "stored-pkce-verifier"
    assert fetch_call.kwargs["grant_type"] == "authorization_code"
    assert fetch_call.kwargs["redirect_uri"].startswith("http://test/auth/google/callback")
    mock_oauth_client.get.assert_awaited_once_with(
        "https://openidconnect.googleapis.com/v1/userinfo"
    )


class TestGoogleCallbackNegativePaths:
    @pytest.mark.asyncio
    async def test_callback_missing_state_param(self) -> None:
        mock_db = AsyncMock()

        async def _fake_db_dep() -> AsyncGenerator[AsyncMock, None]:
            yield mock_db

        app.dependency_overrides[get_db] = _fake_db_dep
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app),
                base_url="http://test",
                follow_redirects=False,
            ) as client:
                response = await client.get("/auth/google/callback?code=test-code")
        finally:
            app.dependency_overrides.pop(get_db, None)

        assert response.status_code == 302
        assert response.headers.get("location") == "/login?error=oauth_failed"
        mock_db.execute.assert_not_called()

    @pytest.mark.asyncio
    async def test_callback_missing_code_param(self) -> None:
        mock_db = AsyncMock()

        async def _fake_db_dep() -> AsyncGenerator[AsyncMock, None]:
            yield mock_db

        app.dependency_overrides[get_db] = _fake_db_dep
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app),
                base_url="http://test",
                follow_redirects=False,
            ) as client:
                response = await client.get("/auth/google/callback?state=test-state")
        finally:
            app.dependency_overrides.pop(get_db, None)

        assert response.status_code == 302
        assert response.headers.get("location") == "/login?error=oauth_failed"
        mock_db.execute.assert_not_called()

    @pytest.mark.asyncio
    async def test_callback_expired_or_missing_state_in_db(self) -> None:
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=_make_scalar_result(None))

        async def _fake_db_dep() -> AsyncGenerator[AsyncMock, None]:
            yield mock_db

        app.dependency_overrides[get_db] = _fake_db_dep
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app),
                base_url="http://test",
                follow_redirects=False,
            ) as client:
                response = await client.get(
                    "/auth/google/callback?state=missing-state&code=test-code"
                )
        finally:
            app.dependency_overrides.pop(get_db, None)

        assert response.status_code == 302
        assert response.headers.get("location") == "/login?error=oauth_failed"
        mock_db.delete.assert_not_called()

    @pytest.mark.asyncio
    async def test_callback_state_deleted_after_use(self) -> None:
        fake_user = MagicMock()
        fake_user.id = uuid.UUID("00000000-0000-0000-0000-000000000199")
        fake_user.email = "test@example.com"
        fake_user.display_name = "Test User"
        fake_user.picture_url = None
        oauth_state = _make_oauth_state(pkce_verifier="single-use-verifier")
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(
            side_effect=[_make_scalar_result(oauth_state), _make_scalar_result(None)]
        )
        mock_db.delete = AsyncMock()
        mock_db.flush = AsyncMock()
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()

        async def _fake_db_dep() -> AsyncGenerator[AsyncMock, None]:
            yield mock_db

        mock_user_repo = MagicMock()
        mock_user_repo.return_value.get_by_google_sub = AsyncMock(return_value=None)
        mock_user_repo.return_value.create = AsyncMock(return_value=fake_user)

        mock_rt_repo = MagicMock()
        mock_rt_repo.return_value.create = AsyncMock()

        mock_client_class, _ = _mock_async_oauth_client(
            userinfo={
                "sub": "google-123",
                "email": "test@example.com",
                "name": "Test User",
                "picture": "https://example.com/pic.jpg",
            }
        )

        app.dependency_overrides[get_db] = _fake_db_dep
        try:
            with (
                patch("app.auth.AsyncOAuth2Client", mock_client_class),
                patch("app.auth.UserRepo", mock_user_repo),
                patch("app.auth.RefreshTokenRepo", mock_rt_repo),
                patch("app.auth.settings.google_oauth_client_id", "google-client-id"),
                patch("app.auth.settings.google_oauth_client_secret", "google-client-secret"),
                patch("app.auth.settings.oauth_redirect_uri", None),
            ):
                async with AsyncClient(
                    transport=ASGITransport(app=app),
                    base_url="http://test",
                    follow_redirects=False,
                ) as client:
                    first_response = await client.get(
                        "/auth/google/callback?state=test-state&code=test-code"
                    )
                    second_response = await client.get(
                        "/auth/google/callback?state=test-state&code=test-code"
                    )
        finally:
            app.dependency_overrides.pop(get_db, None)

        assert first_response.status_code == 302
        assert first_response.headers.get("location") == "/login?oauth_success=1"
        assert second_response.status_code == 302
        assert second_response.headers.get("location") == "/login?error=oauth_failed"
        mock_db.delete.assert_awaited_once_with(oauth_state)

    @pytest.mark.asyncio
    async def test_callback_missing_sub_in_userinfo(self) -> None:
        oauth_state = _make_oauth_state()
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=_make_scalar_result(oauth_state))
        mock_db.delete = AsyncMock()
        mock_db.flush = AsyncMock()
        mock_db.commit = AsyncMock()

        async def _fake_db_dep() -> AsyncGenerator[AsyncMock, None]:
            yield mock_db

        mock_client_class, _ = _mock_async_oauth_client(
            userinfo={
                "email": "test@example.com",
                "name": "Test User",
                "picture": "https://example.com/pic.jpg",
            }
        )

        app.dependency_overrides[get_db] = _fake_db_dep
        try:
            with (
                patch("app.auth.AsyncOAuth2Client", mock_client_class),
                patch("app.auth.settings.google_oauth_client_id", "google-client-id"),
                patch("app.auth.settings.google_oauth_client_secret", "google-client-secret"),
                patch("app.auth.settings.oauth_redirect_uri", None),
            ):
                async with AsyncClient(
                    transport=ASGITransport(app=app),
                    base_url="http://test",
                    follow_redirects=False,
                ) as client:
                    response = await client.get(
                        "/auth/google/callback?state=test-state&code=test-code"
                    )
        finally:
            app.dependency_overrides.pop(get_db, None)

        assert response.status_code == 302
        assert response.headers.get("location") == "/login?error=oauth_failed"


# ---------------------------------------------------------------------------
# T_OAUTH_INITIATE — manual Google authorize redirect + PKCE persistence
# ---------------------------------------------------------------------------


async def test_oauth_initiate_redirects_to_google_authorize_url() -> None:
    raw_state = "raw-state-token"
    raw_code_verifier = "raw-code-verifier"

    mock_db = AsyncMock()
    mock_db.add = MagicMock()
    mock_db.commit = AsyncMock()
    mock_db.rollback = AsyncMock()

    async def _fake_db_dep() -> AsyncGenerator[AsyncMock, None]:
        yield mock_db

    expected_code_challenge = (
        base64.urlsafe_b64encode(hashlib.sha256(raw_code_verifier.encode("ascii")).digest())
        .rstrip(b"=")
        .decode("ascii")
    )

    app.dependency_overrides[get_db] = _fake_db_dep
    try:
        with (
            patch("app.auth.secrets.token_urlsafe", side_effect=[raw_state, raw_code_verifier]),
            patch("app.auth.settings.google_oauth_client_id", "google-client-id"),
        ):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test", follow_redirects=False
            ) as client:
                response = await client.get("/auth/google", follow_redirects=False)
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 302
    location = response.headers["location"]
    assert location.startswith("https://accounts.google.com/o/oauth2/v2/auth")

    query = parse_qs(urlparse(location).query)
    assert query["client_id"] == ["google-client-id"]
    assert query["response_type"] == ["code"]
    assert query["scope"] == ["openid email profile"]
    assert query["state"] == [raw_state]
    assert query["code_challenge"] == [expected_code_challenge]
    assert query["code_challenge_method"] == ["S256"]


async def test_oauth_initiate_persists_hashed_state_and_raw_verifier() -> None:
    raw_state = "state-for-db"
    raw_code_verifier = "verifier-for-db"

    mock_db = AsyncMock()
    mock_db.add = MagicMock()
    mock_db.commit = AsyncMock()
    mock_db.rollback = AsyncMock()

    async def _fake_db_dep() -> AsyncGenerator[AsyncMock, None]:
        yield mock_db

    app.dependency_overrides[get_db] = _fake_db_dep
    try:
        with patch("app.auth.secrets.token_urlsafe", side_effect=[raw_state, raw_code_verifier]):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test", follow_redirects=False
            ) as client:
                response = await client.get("/auth/google", follow_redirects=False)
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 302
    stored_oauth_state = mock_db.add.call_args.args[0]
    assert isinstance(stored_oauth_state, OAuthState)
    assert stored_oauth_state.state_hash == hash_token(raw_state)
    assert stored_oauth_state.state_hash != raw_state
    assert stored_oauth_state.pkce_verifier == raw_code_verifier


async def test_oauth_initiate_fails_closed_if_db_commit_raises() -> None:
    mock_db = AsyncMock()
    mock_db.add = MagicMock()
    mock_db.commit = AsyncMock(side_effect=RuntimeError("boom"))
    mock_db.rollback = AsyncMock()

    async def _fake_db_dep() -> AsyncGenerator[AsyncMock, None]:
        yield mock_db

    app.dependency_overrides[get_db] = _fake_db_dep
    try:
        with patch("app.auth.secrets.token_urlsafe", side_effect=["raw-state", "raw-verifier"]):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test", follow_redirects=False
            ) as client:
                response = await client.get("/auth/google", follow_redirects=False)
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 302
    assert response.headers.get("location") == "/login?error=oauth_failed"
    mock_db.rollback.assert_awaited_once()


def test_oauth_no_session_middleware() -> None:
    middleware_classes = [middleware.cls for middleware in app.user_middleware]
    assert SessionMiddleware not in middleware_classes


# ---------------------------------------------------------------------------
# T005 — GET /auth/logout redirects to /auth/login (legacy redirect kept)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_logout_redirects():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test", follow_redirects=False
    ) as client:
        response = await client.get("/auth/logout")
    assert response.status_code == 302
    assert "/auth/login" in response.headers.get("location", "")


# ---------------------------------------------------------------------------
# T012 — POST /auth/logout clears rt cookie
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_post_logout_clears_rt_cookie():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test", follow_redirects=False
    ) as client:
        response = await client.post("/auth/logout")
    assert response.status_code == 200
    # The rt cookie should be cleared (Max-Age=0)
    set_cookie = response.headers.get("set-cookie", "")
    assert "rt=" in set_cookie
    assert "Max-Age=0" in set_cookie
