"""US-4.5 — Rate limit boundary tests.

Verifies that the register, login, and refresh endpoints enforce their
per-minute rate limits correctly using slowapi.
"""

from __future__ import annotations

import uuid
from typing import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.models.base import get_db
from app.rate_limit import limiter


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def reset_limiter_between_tests() -> None:
    """Reset the in-memory rate limiter before and after each test."""
    limiter._storage.reset()
    yield
    limiter._storage.reset()


@pytest.fixture
def mock_db() -> AsyncMock:
    return AsyncMock()


@pytest.fixture
async def rate_client(mock_db: AsyncMock) -> AsyncGenerator:
    """HTTP client with DB override, no auth dep overrides (raw app)."""

    async def _fake_db() -> AsyncGenerator:
        yield mock_db

    app.dependency_overrides[get_db] = _fake_db
    try:
        yield mock_db
    finally:
        app.dependency_overrides.pop(get_db, None)


# ---------------------------------------------------------------------------
# US-4.5 — Register: 5/minute
# ---------------------------------------------------------------------------


async def test_register_rate_limit_5_per_minute(rate_client: AsyncMock) -> None:
    """POST /auth/register: 6th request within one minute returns 429 (US-4.5)."""
    mock_db = rate_client

    # Use a dedicated IP to isolate from other tests
    headers = {"X-Forwarded-For": "10.0.5.1"}
    payload = {"username": "ratereguser", "password": "ValidPass!234"}

    responses = []
    with (
        patch("app.routers.api_auth.UserRepo") as MockUserRepo,
        patch("app.routers.api_auth.HouseholdRepo") as MockHHRepo,
        patch("app.routers.api_auth.RefreshTokenRepo") as MockRtRepo,
    ):
        fake_user = MagicMock()
        fake_user.id = uuid.uuid4()
        fake_user.username = "ratereguser"
        fake_user.display_name = "Rate Reg User"
        fake_user.email = "ratereg@example.com"
        fake_user.picture_url = ""
        fake_user.is_admin = False
        MockUserRepo.return_value.get_by_username = AsyncMock(return_value=None)
        MockUserRepo.return_value.create = AsyncMock(return_value=fake_user)
        MockHHRepo.return_value.get_memberships_for_user = AsyncMock(return_value=[])
        MockHHRepo.return_value.seed_default_household = AsyncMock()
        MockRtRepo.return_value.create = AsyncMock()
        mock_db.commit = AsyncMock()

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            for _ in range(6):
                resp = await client.post("/auth/register", json=payload, headers=headers)
                responses.append(resp.status_code)

    # First 5 must not be 429; 6th must be 429
    assert all(s != 429 for s in responses[:5]), f"Early rate limit hit: {responses[:5]}"
    assert responses[5] == 429, f"Expected 429 on 6th request, got {responses[5]}"


# ---------------------------------------------------------------------------
# US-4.5 — Login: 10/minute
# ---------------------------------------------------------------------------


async def test_login_rate_limit_10_per_minute(rate_client: AsyncMock) -> None:
    """POST /auth/login: 11th request within one minute returns 429 (US-4.5)."""
    with patch("app.routers.api_auth.UserRepo") as MockUserRepo:
        MockUserRepo.return_value.get_by_username = AsyncMock(return_value=None)

        payload = {"username": "rateloginuser", "password": "WrongPass1!"}
        headers = {"X-Forwarded-For": "10.0.5.2"}

        responses = []
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            for _ in range(11):
                resp = await client.post("/auth/login", json=payload, headers=headers)
                responses.append(resp.status_code)

    # First 10 must not be 429; 11th must be 429
    assert all(s != 429 for s in responses[:10]), f"Early rate limit: {responses[:10]}"
    assert responses[10] == 429, f"Expected 429 on 11th request, got {responses[10]}"


# ---------------------------------------------------------------------------
# US-4.5 — Refresh: 20/minute
# ---------------------------------------------------------------------------


async def test_refresh_rate_limit_20_per_minute(rate_client: AsyncMock) -> None:
    """POST /auth/refresh: 21st request within one minute returns 429 (US-4.5)."""
    mock_db = rate_client

    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = None
    mock_db.execute = AsyncMock(return_value=result_mock)

    headers = {"X-Forwarded-For": "10.0.5.3"}

    responses = []
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        for _ in range(21):
            resp = await client.post(
                "/auth/refresh",
                headers=headers,
                cookies={"refresh_token": "fake-rt"},
            )
            responses.append(resp.status_code)

    # First 20 must not be 429; 21st must be 429
    assert all(s != 429 for s in responses[:20]), f"Early rate limit: {responses[:20]}"
    assert responses[20] == 429, f"Expected 429 on 21st request, got {responses[20]}"
