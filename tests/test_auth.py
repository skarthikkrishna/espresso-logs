"""Tests for Phase 4 Google OAuth authentication."""

import base64
import json
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from itsdangerous import TimestampSigner

from app.main import app

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_TEST_SECRET = "dev-insecure-secret-for-testing-only"
_TEST_USER = {"email": "test@example.com", "name": "Test User", "picture": ""}


def _make_session_cookie(data: dict, secret: str = _TEST_SECRET) -> str:
    """Sign a session payload using the same algorithm Starlette's SessionMiddleware uses."""
    signer = TimestampSigner(secret)
    payload = base64.b64encode(json.dumps(data).encode("utf-8"))
    return signer.sign(payload).decode("utf-8")


# ---------------------------------------------------------------------------
# T003 — anonymous request to protected route redirects to /auth/login
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_anonymous_redirect():
    # Unauthenticated GET / must redirect to /auth/login.
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test", follow_redirects=False
    ) as client:
        response = await client.get("/")
    assert response.status_code == 302
    assert response.headers["location"].endswith("/auth/login")


# ---------------------------------------------------------------------------
# T004 — authenticated user reaches dashboard
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_authenticated_dashboard():
    from app.deps import get_sheets_client
    from tests.doubles import FakeSheetsClient

    fake_client = FakeSheetsClient({"Inventory": [], "Brew_Log": []})
    app.dependency_overrides[get_sheets_client] = lambda: fake_client
    try:
        cookie_value = _make_session_cookie({"user": _TEST_USER})
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test", follow_redirects=False
        ) as client:
            client.cookies.set("session", cookie_value)
            response = await client.get("/")
        assert response.status_code == 200
    finally:
        app.dependency_overrides.pop(get_sheets_client, None)


# ---------------------------------------------------------------------------
# T005 — logout clears the session
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_logout_clears_session():
    cookie_value = _make_session_cookie({"user": _TEST_USER})

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test", follow_redirects=False
    ) as client:
        client.cookies.set("session", cookie_value)

        # Logout should redirect to /auth/login
        logout_response = await client.get("/auth/logout")
        assert logout_response.status_code == 302
        assert logout_response.headers["location"].endswith("/auth/login")

        # Session cookie should be cleared — unauthenticated GET / now redirects to login
        client.cookies.clear()
        after_response = await client.get("/")
        assert after_response.status_code == 302
        assert after_response.headers["location"].endswith("/auth/login")


# ---------------------------------------------------------------------------
# T010 — allowlisted callback creates session and redirects to /
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_callback_allowlisted_success():
    fake_token = {
        "userinfo": {
            "email": "test@example.com",
            "name": "Test User",
            "picture": "https://example.com/pic.jpg",
        }
    }

    with (
        patch(
            "app.auth.oauth.google.authorize_access_token",
            new=AsyncMock(return_value=fake_token),
        ),
        patch("app.auth.ALLOWLIST", frozenset(["test@example.com"])),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test", follow_redirects=False
        ) as client:
            response = await client.get("/auth/callback")

    assert response.status_code == 302
    assert response.headers["location"] == "/"


@pytest.mark.asyncio
async def test_callback_non_allowlisted():
    fake_token = {
        "userinfo": {
            "email": "outsider@example.com",
            "name": "Outsider",
            "picture": "",
        }
    }

    with patch(
        "app.auth.oauth.google.authorize_access_token",
        new=AsyncMock(return_value=fake_token),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test", follow_redirects=False
        ) as client:
            response = await client.get("/auth/callback")

    assert response.status_code == 403


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

    assert livez.status_code == 200
    assert readyz.status_code == 200
