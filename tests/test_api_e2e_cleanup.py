"""Tests for the E2E-only cleanup router (api_e2e.py)."""

from __future__ import annotations

import json
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

from httpx import ASGITransport, AsyncClient


class TestApiE2eCleanup:
    """Covers all branches in app/routers/api_e2e.py."""

    async def test_cleanup_deletes_bag_and_catalog(self) -> None:
        """DELETE /api/e2e/cleanup deletes bag then catalog when both IDs provided."""
        from fastapi import FastAPI
        from app.routers import api_e2e
        from app.deps import get_catalog_repo, get_inventory_repo

        test_app = FastAPI()
        test_app.include_router(api_e2e.router)

        mock_catalog = MagicMock()
        mock_inventory = MagicMock()

        test_app.dependency_overrides[get_catalog_repo] = lambda: mock_catalog
        test_app.dependency_overrides[get_inventory_repo] = lambda: mock_inventory

        bag_id = str(uuid.uuid4())
        catalog_id = str(uuid.uuid4())

        async with AsyncClient(
            transport=ASGITransport(app=test_app), base_url="http://test"
        ) as client:
            resp = await client.request(
                "DELETE",
                "/api/e2e/cleanup",
                content=json.dumps({"catalog_id": catalog_id, "bag_id": bag_id}),
                headers={"Content-Type": "application/json"},
            )

        assert resp.status_code == 204
        mock_inventory.delete_by_pk.assert_called_once_with("Bag_ID", bag_id)
        mock_catalog.delete_by_pk.assert_called_once_with("Catalog_ID", catalog_id)

    async def test_cleanup_skips_missing_ids(self) -> None:
        """DELETE /api/e2e/cleanup with no IDs is a no-op (204)."""
        from fastapi import FastAPI
        from app.routers import api_e2e
        from app.deps import get_catalog_repo, get_inventory_repo

        test_app = FastAPI()
        test_app.include_router(api_e2e.router)

        mock_catalog = MagicMock()
        mock_inventory = MagicMock()
        test_app.dependency_overrides[get_catalog_repo] = lambda: mock_catalog
        test_app.dependency_overrides[get_inventory_repo] = lambda: mock_inventory

        async with AsyncClient(
            transport=ASGITransport(app=test_app), base_url="http://test"
        ) as client:
            resp = await client.request(
                "DELETE",
                "/api/e2e/cleanup",
                content=json.dumps({}),
                headers={"Content-Type": "application/json"},
            )

        assert resp.status_code == 204
        mock_inventory.delete_by_pk.assert_not_called()
        mock_catalog.delete_by_pk.assert_not_called()

    async def test_cleanup_does_not_reset_household_by_default(self, monkeypatch) -> None:
        """Synthetic household reset is opt-in so cleanup can be scoped."""
        from fastapi import FastAPI
        from app.routers import api_e2e
        from app.deps import get_catalog_repo, get_inventory_repo
        from app.models.base import get_db

        test_app = FastAPI()
        test_app.include_router(api_e2e.router)

        mock_catalog = MagicMock()
        mock_inventory = MagicMock()
        mock_db = AsyncMock()
        test_app.dependency_overrides[get_catalog_repo] = lambda: mock_catalog
        test_app.dependency_overrides[get_inventory_repo] = lambda: mock_inventory
        test_app.dependency_overrides[get_db] = lambda: mock_db
        monkeypatch.setenv("APP_ENV", "local")

        with patch.object(api_e2e, "_E2E_AUTH_BYPASS", True):
            async with AsyncClient(
                transport=ASGITransport(app=test_app), base_url="http://test"
            ) as client:
                resp = await client.request(
                    "DELETE",
                    "/api/e2e/cleanup",
                    content=json.dumps({}),
                    headers={"Content-Type": "application/json"},
                )

        assert resp.status_code == 204
        mock_db.execute.assert_not_awaited()
        mock_db.commit.assert_not_awaited()

    async def test_cleanup_resets_e2e_synthetic_household_state_when_requested(
        self, monkeypatch
    ) -> None:
        """E2E cleanup can clear active household and synthetic membership rows."""
        from fastapi import FastAPI
        from app.routers import api_e2e
        from app.deps import get_catalog_repo, get_inventory_repo
        from app.models.base import get_db

        test_app = FastAPI()
        test_app.include_router(api_e2e.router)

        mock_catalog = MagicMock()
        mock_inventory = MagicMock()
        mock_db = AsyncMock()
        test_app.dependency_overrides[get_catalog_repo] = lambda: mock_catalog
        test_app.dependency_overrides[get_inventory_repo] = lambda: mock_inventory
        test_app.dependency_overrides[get_db] = lambda: mock_db
        monkeypatch.setenv("APP_ENV", "local")

        with patch.object(api_e2e, "_E2E_AUTH_BYPASS", True):
            async with AsyncClient(
                transport=ASGITransport(app=test_app), base_url="http://test"
            ) as client:
                resp = await client.request(
                    "DELETE",
                    "/api/e2e/cleanup",
                    content=json.dumps({"reset_household": True}),
                    headers={"Content-Type": "application/json"},
                )

        assert resp.status_code == 204
        executed = [str(call.args[0]) for call in mock_db.execute.await_args_list]
        assert any("UPDATE users SET active_household_id = NULL" in stmt for stmt in executed)
        assert any("DELETE FROM household_members" in stmt for stmt in executed)
        assert any("DELETE FROM households" in stmt for stmt in executed)
        mock_db.commit.assert_awaited_once()
        expected_params = {"uid": api_e2e._E2E_USER_ID, "hid": api_e2e._E2E_HOUSEHOLD_ID}
        for call in mock_db.execute.await_args_list:
            assert call.args[1] == expected_params

    async def test_cleanup_household_reset_is_guarded_outside_e2e_bypass(self, monkeypatch) -> None:
        """Synthetic household reset is skipped unless E2E bypass is active in a safe env."""
        from fastapi import FastAPI
        from app.routers import api_e2e
        from app.deps import get_catalog_repo, get_inventory_repo
        from app.models.base import get_db

        test_app = FastAPI()
        test_app.include_router(api_e2e.router)

        mock_catalog = MagicMock()
        mock_inventory = MagicMock()
        mock_db = AsyncMock()
        test_app.dependency_overrides[get_catalog_repo] = lambda: mock_catalog
        test_app.dependency_overrides[get_inventory_repo] = lambda: mock_inventory
        test_app.dependency_overrides[get_db] = lambda: mock_db
        monkeypatch.setenv("APP_ENV", "local")

        with patch.object(api_e2e, "_E2E_AUTH_BYPASS", False):
            async with AsyncClient(
                transport=ASGITransport(app=test_app), base_url="http://test"
            ) as client:
                resp = await client.request(
                    "DELETE",
                    "/api/e2e/cleanup",
                    content=json.dumps({"reset_household": True}),
                    headers={"Content-Type": "application/json"},
                )

        assert resp.status_code == 204
        mock_db.execute.assert_not_awaited()
        mock_db.commit.assert_not_awaited()

    async def test_cleanup_household_reset_is_guarded_outside_safe_env(self, monkeypatch) -> None:
        """Synthetic household reset is skipped when APP_ENV is not local/test."""
        from fastapi import FastAPI
        from app.routers import api_e2e
        from app.deps import get_catalog_repo, get_inventory_repo
        from app.models.base import get_db

        test_app = FastAPI()
        test_app.include_router(api_e2e.router)

        mock_catalog = MagicMock()
        mock_inventory = MagicMock()
        mock_db = AsyncMock()
        test_app.dependency_overrides[get_catalog_repo] = lambda: mock_catalog
        test_app.dependency_overrides[get_inventory_repo] = lambda: mock_inventory
        test_app.dependency_overrides[get_db] = lambda: mock_db
        monkeypatch.setenv("APP_ENV", "production")

        with patch.object(api_e2e, "_E2E_AUTH_BYPASS", True):
            async with AsyncClient(
                transport=ASGITransport(app=test_app), base_url="http://test"
            ) as client:
                resp = await client.request(
                    "DELETE",
                    "/api/e2e/cleanup",
                    content=json.dumps({"reset_household": True}),
                    headers={"Content-Type": "application/json"},
                )

        assert resp.status_code == 204
        mock_db.execute.assert_not_awaited()
        mock_db.commit.assert_not_awaited()
