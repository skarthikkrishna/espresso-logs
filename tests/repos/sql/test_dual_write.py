"""Dual-write wrapper tests for the M5 contract."""

from __future__ import annotations

import logging
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.deps import _DualWriteBrewLogRepo, _DualWriteCatalogRepo


async def test_catalog_upsert_propagates_postgres_failure(caplog: pytest.LogCaptureFixture) -> None:
    """Catalog writes must fail loudly once Sheets writes are disabled in M5."""
    sheets_mock = MagicMock()
    sql_mock = AsyncMock()
    sql_mock.upsert.side_effect = Exception("connection refused")
    sql_mock._db.rollback = AsyncMock()

    wrapper = _DualWriteCatalogRepo(sheets=sheets_mock, sql=sql_mock)

    with (
        patch("app.deps.settings.use_postgres", True),
        caplog.at_level(logging.WARNING, logger="app.deps.dual_write"),
        pytest.raises(Exception, match="connection refused"),
    ):
        await wrapper.upsert({"Roaster": "X", "Bean_Name": "Y"})

    sheets_mock.upsert.assert_not_called()
    sql_mock.upsert.assert_awaited_once()
    sql_mock._db.rollback.assert_awaited_once()
    assert "Postgres write failed" in caplog.text


async def test_missing_sql_repo_raises_for_catalog_write() -> None:
    """When USE_POSTGRES=true, writes must not silently succeed without SQL."""
    wrapper = _DualWriteCatalogRepo(sheets=MagicMock(), sql=None)

    with (
        patch("app.deps.settings.use_postgres", True),
        pytest.raises(RuntimeError, match="SQL repo unavailable"),
    ):
        await wrapper.upsert({"Roaster": "A", "Bean_Name": "B"})


async def test_missing_sql_repo_raises_for_catalog_read() -> None:
    """Reads in Postgres mode must not fall back to the archive workbook."""
    sheets_mock = MagicMock()
    wrapper = _DualWriteCatalogRepo(sheets=sheets_mock, sql=None)

    with (
        patch("app.deps.settings.use_postgres", True),
        pytest.raises(RuntimeError, match="SQL repo unavailable"),
    ):
        await wrapper.list()

    sheets_mock.list.assert_not_called()


async def test_catalog_reads_use_sql_when_postgres_enabled() -> None:
    sheets_mock = MagicMock()
    sql_mock = AsyncMock()
    sql_mock.list.return_value = [{"Roaster": "From SQL"}]

    wrapper = _DualWriteCatalogRepo(sheets=sheets_mock, sql=sql_mock)

    with patch("app.deps.settings.use_postgres", True):
        result = await wrapper.list()

    assert result == [{"Roaster": "From SQL"}]
    sql_mock.list.assert_awaited_once()
    sheets_mock.list.assert_not_called()


async def test_catalog_reads_use_sheets_when_postgres_disabled() -> None:
    sheets_mock = MagicMock()
    sheets_mock.list.return_value = [{"Roaster": "From Sheets"}]
    sql_mock = AsyncMock()

    wrapper = _DualWriteCatalogRepo(sheets=sheets_mock, sql=sql_mock)

    with patch("app.deps.settings.use_postgres", False):
        result = await wrapper.list()

    assert result == [{"Roaster": "From Sheets"}]
    sheets_mock.list.assert_called_once()
    sql_mock.list.assert_not_called()


async def test_brew_log_add_missing_sql_raises() -> None:
    wrapper = _DualWriteBrewLogRepo(sheets=MagicMock(), sql=None)

    with (
        patch("app.deps.settings.use_postgres", True),
        pytest.raises(RuntimeError, match="SQL repo unavailable"),
    ):
        await wrapper.add({"Dose_In_g": "18.0", "User_Notes": "Test"})
