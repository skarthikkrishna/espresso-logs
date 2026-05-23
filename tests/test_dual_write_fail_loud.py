from __future__ import annotations

from collections.abc import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.deps import _DualWriteBrewLogRepo, _DualWriteCatalogRepo, get_sheets_client
from app.main import app
from app.models.base import get_db
from app.repos.sql.brew_log import SqlBrewLogRepo
from tests.doubles import FakeSheetsClient

_POST_BREW_BODY = {
    "bag_id": "BAG-TEST-01",
    "dose_in_g": 18.0,
    "yield_out_g": 36.0,
    "time_sec": 28.0,
    "grind_setting": "12",
    "shot_eligibility": "Good Espresso",
}

_POST_CATALOG_BODY = {
    "roaster": "Test Roaster",
    "bean_name": "Test Bean",
    "roast_level": "Medium",
    "product_url": "https://example.com/bean",
}


async def _db_none() -> AsyncGenerator[None, None]:
    yield None


async def test_dual_write_surfaces_postgres_failure() -> None:
    """A Postgres write failure must not be silently swallowed when SQL mirror is active."""
    sheets = MagicMock()
    sql = AsyncMock()
    sql.add.side_effect = Exception("simulated PG failure")
    sql._db.rollback = AsyncMock()
    repo = _DualWriteBrewLogRepo(sheets=sheets, sql=sql)
    row = {"Shot_ID": "SH-FAIL-001", "Date": "2026-05-15"}

    with (
        patch("app.deps.settings.use_postgres", True),
        pytest.raises(Exception, match="simulated PG failure"),
    ):
        await repo.add(row)

    sheets.add.assert_not_called()
    sql._db.rollback.assert_awaited_once()


async def test_dual_write_postgres_none_raises_in_postgres_mode() -> None:
    """When USE_POSTGRES=true, missing SQL must fail loudly instead of silently no-oping."""
    sheets = MagicMock()
    repo = _DualWriteBrewLogRepo(sheets=sheets, sql=None)
    row = {"Shot_ID": "SH-NO-SQL-001", "Date": "2026-05-15"}

    with (
        patch("app.deps.settings.use_postgres", True),
        pytest.raises(RuntimeError, match="SQL repo unavailable"),
    ):
        await repo.add(row)

    sheets.add.assert_not_called()


async def test_catalog_read_raises_when_sql_missing_in_postgres_mode() -> None:
    """Reads must fail loudly too; falling back to archive Sheets would mask stale data."""
    sheets = MagicMock()
    repo = _DualWriteCatalogRepo(sheets=sheets, sql=None)

    with (
        patch("app.deps.settings.use_postgres", True),
        pytest.raises(RuntimeError, match="SQL repo unavailable"),
    ):
        await repo.get("CAT100")

    sheets.get.assert_not_called()


async def test_post_brew_log_surfaces_sql_failure_as_http_500() -> None:
    """A Postgres write failure must surface to the caller as HTTP 500, not silent 201."""
    fake = FakeSheetsClient({"Brew_Log": [], "Inventory": [], "Catalog": [], "Hardware": []})
    app.dependency_overrides[get_sheets_client] = lambda: fake

    try:
        with (
            patch("app.config.settings.use_postgres", True),
            patch.object(SqlBrewLogRepo, "list_existing_ids", AsyncMock(return_value=[])),
            patch.object(SqlBrewLogRepo, "add", AsyncMock(side_effect=Exception("PG down"))),
        ):
            async with AsyncClient(
                transport=ASGITransport(app=app, raise_app_exceptions=False),
                base_url="http://test",
            ) as client:
                response = await client.post("/api/brew-log", json=_POST_BREW_BODY)
    finally:
        app.dependency_overrides.pop(get_sheets_client, None)

    assert response.status_code == 500


async def test_post_catalog_surfaces_missing_sql_as_http_500() -> None:
    """POST /api/catalog must not return 201 when get_db yielded None in Postgres mode."""
    fake = FakeSheetsClient({"Brew_Log": [], "Inventory": [], "Catalog": [], "Hardware": []})
    app.dependency_overrides[get_sheets_client] = lambda: fake
    app.dependency_overrides[get_db] = _db_none

    try:
        with patch("app.config.settings.use_postgres", True):
            async with AsyncClient(
                transport=ASGITransport(app=app, raise_app_exceptions=False),
                base_url="http://test",
            ) as client:
                response = await client.post("/api/catalog", json=_POST_CATALOG_BODY)
    finally:
        app.dependency_overrides.pop(get_sheets_client, None)
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 500


async def test_add_many_surfaces_postgres_failure() -> None:
    """A Postgres batch-write failure in add_many() must not be silently swallowed."""
    sheets = MagicMock()
    sql = AsyncMock()
    sql.add.side_effect = Exception("simulated PG batch failure")
    sql._db.rollback = AsyncMock()
    repo = _DualWriteBrewLogRepo(sheets=sheets, sql=sql)
    rows = [
        {"Shot_ID": "SH-BATCH-001", "Date": "2026-05-15"},
        {"Shot_ID": "SH-BATCH-002", "Date": "2026-05-16"},
    ]

    with (
        patch("app.deps.settings.use_postgres", True),
        pytest.raises(Exception, match="simulated PG batch failure"),
    ):
        await repo.add_many(rows)

    sheets.add_many.assert_not_called()
    sql._db.rollback.assert_awaited_once()


async def test_add_many_postgres_none_raises_in_postgres_mode() -> None:
    """Batch writes must also fail loudly when SQL is missing in Postgres mode."""
    sheets = MagicMock()
    repo = _DualWriteBrewLogRepo(sheets=sheets, sql=None)
    rows = [{"Shot_ID": "SH-NO-SQL-001", "Date": "2026-05-15"}]

    with (
        patch("app.deps.settings.use_postgres", True),
        pytest.raises(RuntimeError, match="SQL repo unavailable"),
    ):
        await repo.add_many(rows)

    sheets.add_many.assert_not_called()
