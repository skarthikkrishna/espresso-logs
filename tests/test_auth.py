"""Tests for M5 JWT-based auth and Google OAuth callback."""

from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


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
async def test_callback_success_redirects_to_spa():
    """Successful OAuth callback redirects to /login?oauth_success=1 and sets rt cookie."""
    import uuid
    from unittest.mock import AsyncMock, MagicMock

    from app.main import app
    from app.models.base import get_db

    fake_token = {
        "userinfo": {
            "sub": "google-123",
            "email": "test@example.com",
            "name": "Test User",
            "picture": "https://example.com/pic.jpg",
        }
    }

    fake_user = MagicMock()
    fake_user.id = uuid.UUID("00000000-0000-0000-0000-000000000099")
    fake_user.email = "test@example.com"
    fake_user.display_name = "Test User"
    fake_user.picture_url = None

    mock_db = AsyncMock()

    async def _fake_db_dep():
        yield mock_db

    mock_user_repo = MagicMock()
    mock_user_repo.return_value.get_by_google_sub = AsyncMock(return_value=None)
    mock_user_repo.return_value.create = AsyncMock(return_value=fake_user)

    mock_household_repo = MagicMock()
    mock_household_repo.return_value.get_memberships_for_user = AsyncMock(return_value=[])
    mock_household_repo.return_value.seed_default_household = AsyncMock()

    mock_rt_repo = MagicMock()
    mock_rt_repo.return_value.create = AsyncMock()

    app.dependency_overrides[get_db] = _fake_db_dep
    try:
        with (
            patch(
                "app.auth.oauth.google.authorize_access_token",
                new=AsyncMock(return_value=fake_token),
            ),
            patch("app.auth.UserRepo", mock_user_repo),
            patch("app.auth.HouseholdRepo", mock_household_repo),
            patch("app.auth.RefreshTokenRepo", mock_rt_repo),
        ):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test", follow_redirects=False
            ) as client:
                response = await client.get("/auth/google/callback")
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 302
    assert "oauth_success=1" in response.headers.get("location", "")


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
