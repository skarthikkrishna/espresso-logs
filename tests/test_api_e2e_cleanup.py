"""Tests for the E2E-only cleanup router (api_e2e.py)."""

from __future__ import annotations

import json
import uuid
from unittest.mock import MagicMock

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
