"""Tests for the NFR-D8 startup setup guard."""

from __future__ import annotations

import uuid
from collections.abc import AsyncGenerator, Generator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app import setup_guard
from app.main import app
from app.models.base import get_db
from app.rate_limit import limiter


@pytest.fixture(autouse=True)
def reset_setup_guard_and_limiter() -> Generator[None, None, None]:
    """Reset mutable guard and limiter state between tests."""
    setup_guard.clear_setup_required()
    limiter._storage.reset()
    yield
    setup_guard.clear_setup_required()
    limiter._storage.reset()


@pytest.fixture
def mock_db() -> AsyncMock:
    """Return a mocked async DB session for register-path tests."""
    db = AsyncMock()
    db.commit = AsyncMock()
    return db


def _fake_user() -> MagicMock:
    user = MagicMock()
    user.id = uuid.uuid4()
    user.username = "setup-user"
    user.display_name = "Setup User"
    user.email = None
    user.picture_url = None
    return user


async def test_setup_guard_blocks_api_when_active() -> None:
    setup_guard.SETUP_REQUIRED = True

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/hardware")

    assert response.status_code == 503
    assert response.json() == {"detail": "Initial setup required", "setup_required": True}


async def test_setup_guard_allows_register_when_active(mock_db: AsyncMock) -> None:
    setup_guard.SETUP_REQUIRED = True
    user = _fake_user()

    async def _fake_db() -> AsyncGenerator[AsyncMock, None]:
        yield mock_db

    app.dependency_overrides[get_db] = _fake_db

    try:
        with (
            patch("app.routers.api_auth.UserRepo") as mock_user_repo,
            patch("app.routers.api_auth.RefreshTokenRepo") as mock_rt_repo,
        ):
            mock_user_repo.return_value.get_by_username = AsyncMock(return_value=None)
            mock_user_repo.return_value.create = AsyncMock(return_value=user)
            mock_rt_repo.return_value.create = AsyncMock()

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.post(
                    "/auth/register",
                    json={"username": "setup-user", "password": "ValidPass!234"},
                    headers={"X-Forwarded-For": "10.0.8.1"},
                )
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 201
    assert response.json()["token_type"] == "bearer"


async def test_setup_guard_allows_static_when_active() -> None:
    setup_guard.SETUP_REQUIRED = True

    async with AsyncClient(
        transport=ASGITransport(app=app, raise_app_exceptions=False),
        base_url="http://test",
    ) as client:
        response = await client.get("/static/spa/")

    assert response.status_code != 503


async def test_setup_guard_clears_after_register(mock_db: AsyncMock) -> None:
    setup_guard.SETUP_REQUIRED = True
    user = _fake_user()

    async def _fake_db() -> AsyncGenerator[AsyncMock, None]:
        yield mock_db

    app.dependency_overrides[get_db] = _fake_db

    try:
        with (
            patch("app.routers.api_auth.UserRepo") as mock_user_repo,
            patch("app.routers.api_auth.RefreshTokenRepo") as mock_rt_repo,
        ):
            mock_user_repo.return_value.get_by_username = AsyncMock(return_value=None)
            mock_user_repo.return_value.create = AsyncMock(return_value=user)
            mock_rt_repo.return_value.create = AsyncMock()

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.post(
                    "/auth/register",
                    json={"username": "setup-user", "password": "ValidPass!234"},
                    headers={"X-Forwarded-For": "10.0.8.2"},
                )
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 201
    assert setup_guard.SETUP_REQUIRED is False


async def test_check_and_set_setup_required_with_zero_users() -> None:
    result = MagicMock()
    result.scalar_one.return_value = 0
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=result)

    await setup_guard.check_and_set_setup_required(mock_db)

    assert setup_guard.SETUP_REQUIRED is True


async def test_check_and_set_setup_required_with_existing_users() -> None:
    result = MagicMock()
    result.scalar_one.return_value = 2
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=result)

    await setup_guard.check_and_set_setup_required(mock_db)

    assert setup_guard.SETUP_REQUIRED is False
