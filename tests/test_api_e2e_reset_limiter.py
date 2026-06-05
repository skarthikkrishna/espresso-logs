"""Tests for POST /api/e2e/reset-limiter endpoint."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from httpx import ASGITransport, AsyncClient


def _make_test_app():
    from fastapi import FastAPI

    from app.routers import api_e2e

    test_app = FastAPI()
    test_app.include_router(api_e2e.router)
    return test_app


class TestE2eResetLimiter:
    """POST /api/e2e/reset-limiter — gating and reset behaviour."""

    async def test_reset_limiter_returns_404_when_bypass_disabled(self, monkeypatch) -> None:
        """Returns 404 when E2E_AUTH_BYPASS is not set."""
        from app.routers import api_e2e

        monkeypatch.setenv("APP_ENV", "local")
        test_app = _make_test_app()

        with patch.object(api_e2e, "_E2E_AUTH_BYPASS", False):
            async with AsyncClient(
                transport=ASGITransport(app=test_app), base_url="http://test"
            ) as client:
                resp = await client.post("/api/e2e/reset-limiter")

        assert resp.status_code == 404

    async def test_reset_limiter_returns_404_in_production_env(self, monkeypatch) -> None:
        """Returns 404 when APP_ENV=production, even with bypass flag set."""
        from app.routers import api_e2e

        monkeypatch.setenv("APP_ENV", "production")
        test_app = _make_test_app()

        with patch.object(api_e2e, "_E2E_AUTH_BYPASS", True):
            async with AsyncClient(
                transport=ASGITransport(app=test_app), base_url="http://test"
            ) as client:
                resp = await client.post("/api/e2e/reset-limiter")

        assert resp.status_code == 404

    async def test_reset_limiter_returns_204_in_local_env(self, monkeypatch) -> None:
        """Returns 204 when E2E_AUTH_BYPASS=1 and APP_ENV=local."""
        from app.routers import api_e2e

        monkeypatch.setenv("APP_ENV", "local")
        test_app = _make_test_app()

        mock_storage = MagicMock()
        with (
            patch.object(api_e2e, "_E2E_AUTH_BYPASS", True),
            patch.object(api_e2e.limiter, "_storage", mock_storage),
        ):
            async with AsyncClient(
                transport=ASGITransport(app=test_app), base_url="http://test"
            ) as client:
                resp = await client.post("/api/e2e/reset-limiter")

        assert resp.status_code == 204

    async def test_reset_limiter_returns_204_in_test_env(self, monkeypatch) -> None:
        """Returns 204 when APP_ENV=test (not just local)."""
        from app.routers import api_e2e

        monkeypatch.setenv("APP_ENV", "test")
        test_app = _make_test_app()

        mock_storage = MagicMock()
        with (
            patch.object(api_e2e, "_E2E_AUTH_BYPASS", True),
            patch.object(api_e2e.limiter, "_storage", mock_storage),
        ):
            async with AsyncClient(
                transport=ASGITransport(app=test_app), base_url="http://test"
            ) as client:
                resp = await client.post("/api/e2e/reset-limiter")

        assert resp.status_code == 204

    async def test_reset_limiter_calls_storage_reset(self, monkeypatch) -> None:
        """limiter._storage.reset() is called exactly once on success."""
        from app.routers import api_e2e

        monkeypatch.setenv("APP_ENV", "local")
        test_app = _make_test_app()

        mock_storage = MagicMock()
        with (
            patch.object(api_e2e, "_E2E_AUTH_BYPASS", True),
            patch.object(api_e2e.limiter, "_storage", mock_storage),
        ):
            async with AsyncClient(
                transport=ASGITransport(app=test_app), base_url="http://test"
            ) as client:
                await client.post("/api/e2e/reset-limiter")

        mock_storage.reset.assert_called_once()

    async def test_reset_limiter_does_not_call_reset_when_blocked(self, monkeypatch) -> None:
        """limiter._storage.reset() is NOT called when guard rejects the request."""
        from app.routers import api_e2e

        monkeypatch.setenv("APP_ENV", "production")
        test_app = _make_test_app()

        mock_storage = MagicMock()
        with (
            patch.object(api_e2e, "_E2E_AUTH_BYPASS", True),
            patch.object(api_e2e.limiter, "_storage", mock_storage),
        ):
            async with AsyncClient(
                transport=ASGITransport(app=test_app), base_url="http://test"
            ) as client:
                await client.post("/api/e2e/reset-limiter")

        mock_storage.reset.assert_not_called()
