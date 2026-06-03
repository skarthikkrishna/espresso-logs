"""Tests for POST /api/e2e/session endpoint."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

from httpx import ASGITransport, AsyncClient


def _make_test_app():
    from fastapi import FastAPI

    from app.models.base import get_db
    from app.routers import api_e2e

    test_app = FastAPI()
    test_app.include_router(api_e2e.router)
    return test_app, get_db


class TestE2eSession:
    """POST /api/e2e/session — gating, token response, and cookie correctness."""

    async def test_session_returns_404_when_bypass_disabled(self, monkeypatch) -> None:
        """Returns 404 when E2E_AUTH_BYPASS is not set."""
        from app.routers import api_e2e

        monkeypatch.setenv("APP_ENV", "local")
        test_app, get_db = _make_test_app()
        mock_db = AsyncMock()
        test_app.dependency_overrides[get_db] = lambda: mock_db

        with patch.object(api_e2e, "_E2E_AUTH_BYPASS", False):
            async with AsyncClient(
                transport=ASGITransport(app=test_app), base_url="http://test"
            ) as client:
                resp = await client.post("/api/e2e/session")

        assert resp.status_code == 404
        mock_db.commit.assert_not_awaited()

    async def test_session_returns_404_in_production_env(self, monkeypatch) -> None:
        """Returns 404 when APP_ENV=production, even with bypass flag set."""
        from app.routers import api_e2e

        monkeypatch.setenv("APP_ENV", "production")
        test_app, get_db = _make_test_app()
        mock_db = AsyncMock()
        test_app.dependency_overrides[get_db] = lambda: mock_db

        with patch.object(api_e2e, "_E2E_AUTH_BYPASS", True):
            async with AsyncClient(
                transport=ASGITransport(app=test_app), base_url="http://test"
            ) as client:
                resp = await client.post("/api/e2e/session")

        assert resp.status_code == 404
        mock_db.commit.assert_not_awaited()

    async def test_session_returns_503_when_db_none(self, monkeypatch) -> None:
        """Returns 503 when DB session is None."""
        from app.routers import api_e2e

        monkeypatch.setenv("APP_ENV", "local")
        test_app, get_db = _make_test_app()
        test_app.dependency_overrides[get_db] = lambda: None

        with patch.object(api_e2e, "_E2E_AUTH_BYPASS", True):
            async with AsyncClient(
                transport=ASGITransport(app=test_app), base_url="http://test"
            ) as client:
                resp = await client.post("/api/e2e/session")

        assert resp.status_code == 503
        assert resp.json()["detail"] == "Database unavailable"

    async def test_session_returns_access_token_and_token_type(self, monkeypatch) -> None:
        """Returns 200 with access_token and token_type='bearer'."""
        from app.routers import api_e2e

        monkeypatch.setenv("APP_ENV", "local")
        test_app, get_db = _make_test_app()
        mock_db = AsyncMock()
        test_app.dependency_overrides[get_db] = lambda: mock_db

        mock_rt_repo = MagicMock()
        mock_rt_repo.create = AsyncMock()

        with (
            patch.object(api_e2e, "_E2E_AUTH_BYPASS", True),
            patch("app.routers.api_e2e.RefreshTokenRepo", return_value=mock_rt_repo),
            patch("app.routers.api_e2e.create_access_token", return_value="test-access-token"),
            patch(
                "app.routers.api_e2e.generate_refresh_token",
                return_value=("raw-token", "hashed-token"),
            ),
            patch("app.routers.api_e2e.set_refresh_cookie") as mock_set_cookie,
        ):
            async with AsyncClient(
                transport=ASGITransport(app=test_app), base_url="http://test"
            ) as client:
                resp = await client.post("/api/e2e/session")

        assert resp.status_code == 200
        body = resp.json()
        assert body["access_token"] == "test-access-token"
        assert body["token_type"] == "bearer"
        mock_set_cookie.assert_called_once()
        mock_db.commit.assert_awaited_once()

    async def test_session_creates_refresh_token_for_e2e_user(self, monkeypatch) -> None:
        """Creates a refresh token row for _E2E_USER_ID."""
        from app.routers import api_e2e

        monkeypatch.setenv("APP_ENV", "local")
        test_app, get_db = _make_test_app()
        mock_db = AsyncMock()
        test_app.dependency_overrides[get_db] = lambda: mock_db

        mock_rt_repo = MagicMock()
        mock_rt_repo.create = AsyncMock()

        with (
            patch.object(api_e2e, "_E2E_AUTH_BYPASS", True),
            patch("app.routers.api_e2e.RefreshTokenRepo", return_value=mock_rt_repo),
            patch("app.routers.api_e2e.create_access_token", return_value="tok"),
            patch(
                "app.routers.api_e2e.generate_refresh_token",
                return_value=("raw", "hashed"),
            ),
            patch("app.routers.api_e2e.set_refresh_cookie"),
        ):
            async with AsyncClient(
                transport=ASGITransport(app=test_app), base_url="http://test"
            ) as client:
                await client.post("/api/e2e/session")

        mock_rt_repo.create.assert_awaited_once()
        call_kwargs = mock_rt_repo.create.await_args.kwargs
        assert call_kwargs["user_id"] == api_e2e._E2E_USER_ID
        assert call_kwargs["token_hash"] == "hashed"

    async def test_session_sets_rt_cookie_on_response(self, monkeypatch) -> None:
        """set_refresh_cookie is called with the raw refresh token."""
        from app.routers import api_e2e

        monkeypatch.setenv("APP_ENV", "local")
        test_app, get_db = _make_test_app()
        mock_db = AsyncMock()
        test_app.dependency_overrides[get_db] = lambda: mock_db

        mock_rt_repo = MagicMock()
        mock_rt_repo.create = AsyncMock()

        with (
            patch.object(api_e2e, "_E2E_AUTH_BYPASS", True),
            patch("app.routers.api_e2e.RefreshTokenRepo", return_value=mock_rt_repo),
            patch("app.routers.api_e2e.create_access_token", return_value="tok"),
            patch(
                "app.routers.api_e2e.generate_refresh_token",
                return_value=("my-raw-token", "my-hash"),
            ),
            patch("app.routers.api_e2e.set_refresh_cookie") as mock_set_cookie,
        ):
            async with AsyncClient(
                transport=ASGITransport(app=test_app), base_url="http://test"
            ) as client:
                await client.post("/api/e2e/session")

        _, call_args, _ = mock_set_cookie.mock_calls[0]
        assert call_args[1] == "my-raw-token"

    async def test_session_accessible_in_test_env(self, monkeypatch) -> None:
        """Returns 200 when APP_ENV=test (not just local)."""
        from app.routers import api_e2e

        monkeypatch.setenv("APP_ENV", "test")
        test_app, get_db = _make_test_app()
        mock_db = AsyncMock()
        test_app.dependency_overrides[get_db] = lambda: mock_db

        mock_rt_repo = MagicMock()
        mock_rt_repo.create = AsyncMock()

        with (
            patch.object(api_e2e, "_E2E_AUTH_BYPASS", True),
            patch("app.routers.api_e2e.RefreshTokenRepo", return_value=mock_rt_repo),
            patch("app.routers.api_e2e.create_access_token", return_value="tok"),
            patch(
                "app.routers.api_e2e.generate_refresh_token",
                return_value=("raw", "hash"),
            ),
            patch("app.routers.api_e2e.set_refresh_cookie"),
        ):
            async with AsyncClient(
                transport=ASGITransport(app=test_app), base_url="http://test"
            ) as client:
                resp = await client.post("/api/e2e/session")

        assert resp.status_code == 200
