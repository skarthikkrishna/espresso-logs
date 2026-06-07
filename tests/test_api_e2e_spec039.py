"""Tests for spec-039 local-only E2E evidence seed endpoints."""

from __future__ import annotations

import re
import uuid
from unittest.mock import AsyncMock, patch

from httpx import ASGITransport, AsyncClient


def _make_test_app():
    from fastapi import FastAPI

    from app.models.base import get_db
    from app.routers import api_e2e

    test_app = FastAPI()
    test_app.include_router(api_e2e.router)
    return test_app, get_db


class _ScalarResult:
    def scalar_one(self) -> uuid.UUID:
        return uuid.UUID("10000000-0000-0000-0000-000000000039")


class TestSpec039Seed:
    """Spec-039 seed endpoints are local/test-only and metadata-only."""

    async def test_seed_returns_synthetic_ids_and_no_feedback_text(self, monkeypatch) -> None:
        """POST /spec039/seed returns IDs/booleans only, never AI feedback content."""
        from app.routers import api_e2e

        monkeypatch.setenv("APP_ENV", "local")
        test_app, get_db = _make_test_app()
        mock_db = AsyncMock()
        mock_db.execute.return_value = _ScalarResult()
        test_app.dependency_overrides[get_db] = lambda: mock_db

        with patch.object(api_e2e, "_E2E_AUTH_BYPASS", True):
            async with AsyncClient(
                transport=ASGITransport(app=test_app), base_url="http://test"
            ) as client:
                resp = await client.post("/api/e2e/spec039/seed")

        assert resp.status_code == 200
        body = resp.json()
        assert body["catalog_ids"]["locked"] == "CAT039_LOCKED"
        assert body["bag_ids"]["active"] == "BAG039_ACTIVE"
        assert body["shot_ids"]["ai_present"] == "SHOT039_AI_PRESENT"
        assert body["has_ai_feedback"]["SHOT039_AI_PRESENT"] is True
        assert "SPEC039_SYNTHETIC_AI_FEEDBACK_PRESENT" not in resp.text
        assert "SPEC039_AI_PRESENT_" not in resp.text
        statements = [str(call.args[0]) for call in mock_db.execute.await_args_list]
        brew_insert_sql = next(stmt for stmt in statements if "INSERT INTO brew_log" in stmt)
        assert re.search(
            r"'SHOT039_AI_EMPTY'.*?18\.0,\s+36\.0,\s+28,\s+4\.0,",
            brew_insert_sql,
            re.S,
        )
        assert mock_db.commit.await_count == 2

    async def test_seed_returns_404_when_bypass_disabled(self, monkeypatch) -> None:
        """POST /spec039/seed is not reachable without E2E_AUTH_BYPASS."""
        from app.routers import api_e2e

        monkeypatch.setenv("APP_ENV", "local")
        test_app, get_db = _make_test_app()
        mock_db = AsyncMock()
        test_app.dependency_overrides[get_db] = lambda: mock_db

        with patch.object(api_e2e, "_E2E_AUTH_BYPASS", False):
            async with AsyncClient(
                transport=ASGITransport(app=test_app), base_url="http://test"
            ) as client:
                resp = await client.post("/api/e2e/spec039/seed")

        assert resp.status_code == 404
        mock_db.execute.assert_not_awaited()
        mock_db.commit.assert_not_awaited()

    async def test_seed_returns_404_in_production_env(self, monkeypatch) -> None:
        """POST /spec039/seed is blocked outside local/test even when bypass is patched on."""
        from app.routers import api_e2e

        monkeypatch.setenv("APP_ENV", "production")
        test_app, get_db = _make_test_app()
        mock_db = AsyncMock()
        test_app.dependency_overrides[get_db] = lambda: mock_db

        with patch.object(api_e2e, "_E2E_AUTH_BYPASS", True):
            async with AsyncClient(
                transport=ASGITransport(app=test_app), base_url="http://test"
            ) as client:
                resp = await client.post("/api/e2e/spec039/seed")

        assert resp.status_code == 404
        mock_db.execute.assert_not_awaited()
        mock_db.commit.assert_not_awaited()

    async def test_seed_returns_503_when_database_unavailable(self, monkeypatch) -> None:
        """POST /spec039/seed requires local Postgres and fails closed otherwise."""
        from app.routers import api_e2e

        monkeypatch.setenv("APP_ENV", "local")
        test_app, get_db = _make_test_app()
        test_app.dependency_overrides[get_db] = lambda: None

        with patch.object(api_e2e, "_E2E_AUTH_BYPASS", True):
            async with AsyncClient(
                transport=ASGITransport(app=test_app), base_url="http://test"
            ) as client:
                resp = await client.post("/api/e2e/spec039/seed")

        assert resp.status_code == 503
        assert resp.json()["detail"] == "Database unavailable"

    async def test_cleanup_uses_only_spec039_and_pw_test_prefixes(self, monkeypatch) -> None:
        """DELETE /spec039/cleanup scopes cleanup to synthetic prefixes and E2E household."""
        from app.routers import api_e2e

        monkeypatch.setenv("APP_ENV", "local")
        test_app, get_db = _make_test_app()
        mock_db = AsyncMock()
        test_app.dependency_overrides[get_db] = lambda: mock_db

        with patch.object(api_e2e, "_E2E_AUTH_BYPASS", True):
            async with AsyncClient(
                transport=ASGITransport(app=test_app), base_url="http://test"
            ) as client:
                resp = await client.delete("/api/e2e/spec039/cleanup")

        assert resp.status_code == 204
        executed_sql = "\n".join(str(call.args[0]) for call in mock_db.execute.await_args_list)
        assert "DELETE FROM brew_log" in executed_sql
        assert "DELETE FROM inventory_bags" in executed_sql
        assert "DELETE FROM catalog" in executed_sql
        assert "DELETE FROM hardware" in executed_sql
        statements = [str(call.args[0]) for call in mock_db.execute.await_args_list]
        brew_delete_index = next(
            index
            for index, statement in enumerate(statements)
            if "DELETE FROM brew_log" in statement
        )
        bag_delete_index = next(
            index
            for index, statement in enumerate(statements)
            if "DELETE FROM inventory_bags" in statement
        )
        assert brew_delete_index < bag_delete_index
        brew_delete_sql = statements[brew_delete_index]
        assert "bag_id IN (" in brew_delete_sql
        assert "FROM inventory_bags" in brew_delete_sql
        assert "catalog_id IN (" in brew_delete_sql
        cleanup_params = mock_db.execute.await_args_list[1].args[1]
        assert cleanup_params["seed_prefix"] == "SPEC039_%"
        assert cleanup_params["pw_prefix"] == "PW_TEST_SPEC039_%"
        assert cleanup_params["hid"] == api_e2e._E2E_HOUSEHOLD_ID
        mock_db.commit.assert_awaited_once()

    async def test_e2e_llm_dependency_is_hermetic_even_with_provider_keys(
        self, monkeypatch
    ) -> None:
        """E2E_AUTH_BYPASS local/test mode must never construct provider-backed LLM clients."""
        import app.deps as deps
        from app.config import settings

        monkeypatch.setenv("APP_ENV", "local")
        monkeypatch.setattr(deps, "_E2E_AUTH_BYPASS", True)
        monkeypatch.setattr(settings, "anthropic_api_key", "would-be-live-anthropic")
        monkeypatch.setattr(settings, "llm_api_key", "would-be-live-gemini")

        with patch(
            "app.services.inference.get_llm_client",
            side_effect=AssertionError("provider factory must not run in local E2E"),
        ):
            client = deps.get_llm_client()

        result = await client.complete("synthetic prompt")
        assert result == "SPEC039 fake AI feedback — local E2E only."
