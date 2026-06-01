"""Tests for use_postgres read path in all 5 DualWrite repo wrappers.

Covers:
  1. use_postgres=True + sql not None → SQL repo read method called
  2. use_postgres=False              → Sheets repo read method called (regression guard)
  3. use_postgres=True + sql=None    → RuntimeError (fail loud; Sheets is archive-only)
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.deps import (
    _DualWriteBrewLogRepo,
    _DualWriteCatalogRepo,
    _DualWriteHardwareRepo,
    _DualWriteInventoryRepo,
    _DualWriteMaintenanceRepo,
)
from app.repos.sql.hardware import SqlHardwareRepo

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_CATALOG_ROW: dict[str, Any] = {"Catalog_ID": "CAT001", "Roaster": "Test", "Bean_Name": "Blend"}
_BAG_ROW: dict[str, Any] = {"Bag_ID": "BAG001", "Beans": "Test Blend", "Status": "Active"}
_SHOT_ROW: dict[str, Any] = {"Shot_ID": "SH-20260514-01", "Bag_ID": "BAG001"}
_HW_ROW: dict[str, Any] = {"Hardware_ID": "HW001", "Name": "Breville", "Category": "Machine"}
_MAINT_ROW: dict[str, Any] = {"Maintenance_ID": "MNT001", "Hardware_ID": "HW001"}


def _make_sheets_catalog(rows: list[dict[str, Any]] = [_CATALOG_ROW]) -> MagicMock:
    m = MagicMock()
    m.list.return_value = rows
    m.get.return_value = rows[0] if rows else None
    m._fetch_all.return_value = rows
    return m


def _make_sql_catalog(rows: list[dict[str, Any]] = [_CATALOG_ROW]) -> AsyncMock:
    m = AsyncMock()
    m.list.return_value = rows
    m.get.return_value = rows[0] if rows else None
    m._fetch_all.return_value = rows
    return m


# ---------------------------------------------------------------------------
# _DualWriteCatalogRepo
# ---------------------------------------------------------------------------


class TestDualWriteCatalogRepoReads:
    async def test_list_uses_sql_when_use_postgres_true(self) -> None:
        sheets = _make_sheets_catalog()
        sql = _make_sql_catalog()
        wrapper = _DualWriteCatalogRepo(sheets=sheets, sql=sql)

        with patch("app.deps.settings") as mock_settings:
            mock_settings.use_postgres = True
            result = await wrapper.list()

        sql.list.assert_awaited_once()
        sheets.list.assert_not_called()
        assert result == [_CATALOG_ROW]

    async def test_list_uses_sheets_when_use_postgres_false(self) -> None:
        sheets = _make_sheets_catalog()
        sql = _make_sql_catalog()
        wrapper = _DualWriteCatalogRepo(sheets=sheets, sql=sql)

        with patch("app.deps.settings") as mock_settings:
            mock_settings.use_postgres = False
            result = await wrapper.list()

        sheets.list.assert_called_once()
        sql.list.assert_not_called()
        assert result == [_CATALOG_ROW]

    async def test_list_raises_when_sql_none(self) -> None:
        sheets = _make_sheets_catalog()
        wrapper = _DualWriteCatalogRepo(sheets=sheets, sql=None)

        with patch("app.deps.settings") as mock_settings:
            mock_settings.use_postgres = True
            with pytest.raises(RuntimeError, match="SQL repo unavailable"):
                await wrapper.list()

        sheets.list.assert_not_called()

    async def test_get_uses_sql_when_use_postgres_true(self) -> None:
        sheets = _make_sheets_catalog()
        sql = _make_sql_catalog()
        wrapper = _DualWriteCatalogRepo(sheets=sheets, sql=sql)

        with patch("app.deps.settings") as mock_settings:
            mock_settings.use_postgres = True
            result = await wrapper.get("CAT001")

        sql.get.assert_awaited_once_with("CAT001")
        sheets.get.assert_not_called()
        assert result == _CATALOG_ROW

    async def test_get_raises_when_sql_none(self) -> None:
        sheets = _make_sheets_catalog()
        wrapper = _DualWriteCatalogRepo(sheets=sheets, sql=None)

        with patch("app.deps.settings") as mock_settings:
            mock_settings.use_postgres = True
            with pytest.raises(RuntimeError, match="SQL repo unavailable"):
                await wrapper.get("CAT001")

        sheets.get.assert_not_called()

    async def test_fetch_all_uses_sql_when_use_postgres_true(self) -> None:
        sheets = _make_sheets_catalog()
        sql = _make_sql_catalog()
        wrapper = _DualWriteCatalogRepo(sheets=sheets, sql=sql)

        with patch("app.deps.settings") as mock_settings:
            mock_settings.use_postgres = True
            result = await wrapper._fetch_all()

        sql._fetch_all.assert_awaited_once()
        assert result == [_CATALOG_ROW]


# ---------------------------------------------------------------------------
# _DualWriteBrewLogRepo
# ---------------------------------------------------------------------------


class TestDualWriteBrewLogRepoReads:
    def _make_sheets(self) -> MagicMock:
        m = MagicMock()
        m.list.return_value = [_SHOT_ROW]
        m.list_recent.return_value = [_SHOT_ROW]
        m.list_for_bag.return_value = [_SHOT_ROW]
        m.list_existing_ids.return_value = ["SH-20260514-01"]
        m.get.return_value = _SHOT_ROW
        return m

    def _make_sql(self) -> AsyncMock:
        m = AsyncMock()
        m.list.return_value = [_SHOT_ROW]
        m.list_recent.return_value = [_SHOT_ROW]
        m.list_for_bag.return_value = [_SHOT_ROW]
        m.list_existing_ids.return_value = ["SH-20260514-01"]
        m.get.return_value = _SHOT_ROW
        return m

    async def test_list_recent_uses_sql(self) -> None:
        sheets = self._make_sheets()
        sql = self._make_sql()
        wrapper = _DualWriteBrewLogRepo(sheets=sheets, sql=sql)

        with patch("app.deps.settings") as mock_settings:
            mock_settings.use_postgres = True
            await wrapper.list_recent(5)

        sql.list_recent.assert_awaited_once_with(5)
        sheets.list_recent.assert_not_called()

    async def test_list_recent_uses_sheets_when_postgres_false(self) -> None:
        sheets = self._make_sheets()
        sql = self._make_sql()
        wrapper = _DualWriteBrewLogRepo(sheets=sheets, sql=sql)

        with patch("app.deps.settings") as mock_settings:
            mock_settings.use_postgres = False
            await wrapper.list_recent(5)

        sheets.list_recent.assert_called_once_with(5)
        sql.list_recent.assert_not_called()

    async def test_list_recent_raises_when_sql_none(self) -> None:
        sheets = self._make_sheets()
        wrapper = _DualWriteBrewLogRepo(sheets=sheets, sql=None)

        with patch("app.deps.settings") as mock_settings:
            mock_settings.use_postgres = True
            with pytest.raises(RuntimeError, match="SQL repo unavailable"):
                await wrapper.list_recent(5)

        sheets.list_recent.assert_not_called()

    async def test_list_existing_ids_uses_sql(self) -> None:
        sheets = self._make_sheets()
        sql = self._make_sql()
        wrapper = _DualWriteBrewLogRepo(sheets=sheets, sql=sql)

        with patch("app.deps.settings") as mock_settings:
            mock_settings.use_postgres = True
            result = await wrapper.list_existing_ids()

        sql.list_existing_ids.assert_awaited_once()
        assert result == ["SH-20260514-01"]

    async def test_get_uses_sql(self) -> None:
        sheets = self._make_sheets()
        sql = self._make_sql()
        wrapper = _DualWriteBrewLogRepo(sheets=sheets, sql=sql)

        with patch("app.deps.settings") as mock_settings:
            mock_settings.use_postgres = True
            result = await wrapper.get("SH-20260514-01")

        sql.get.assert_awaited_once_with("SH-20260514-01")
        assert result == _SHOT_ROW

    async def test_list_for_bag_uses_sql(self) -> None:
        sheets = self._make_sheets()
        sql = self._make_sql()
        wrapper = _DualWriteBrewLogRepo(sheets=sheets, sql=sql)

        with patch("app.deps.settings") as mock_settings:
            mock_settings.use_postgres = True
            result = await wrapper.list_for_bag("BAG001")

        sql.list_for_bag.assert_awaited_once_with("BAG001")
        assert result == [_SHOT_ROW]


# ---------------------------------------------------------------------------
# _DualWriteInventoryRepo
# ---------------------------------------------------------------------------


class TestDualWriteInventoryRepoReads:
    def _make_sheets(self) -> MagicMock:
        m = MagicMock()
        m.list.return_value = [_BAG_ROW]
        m.list_all.return_value = [_BAG_ROW]
        m.get.return_value = _BAG_ROW
        return m

    def _make_sql(self) -> AsyncMock:
        m = AsyncMock()
        m.list.return_value = [_BAG_ROW]
        m.list_all.return_value = [_BAG_ROW]
        m.get.return_value = _BAG_ROW
        return m

    async def test_list_uses_sql(self) -> None:
        sheets = self._make_sheets()
        sql = self._make_sql()
        wrapper = _DualWriteInventoryRepo(sheets=sheets, sql=sql)

        with patch("app.deps.settings") as mock_settings:
            mock_settings.use_postgres = True
            await wrapper.list(status="Active")

        sql.list.assert_awaited_once_with(status="Active")
        sheets.list.assert_not_called()

    async def test_list_uses_sheets_when_postgres_false(self) -> None:
        sheets = self._make_sheets()
        sql = self._make_sql()
        wrapper = _DualWriteInventoryRepo(sheets=sheets, sql=sql)

        with patch("app.deps.settings") as mock_settings:
            mock_settings.use_postgres = False
            await wrapper.list()

        sheets.list.assert_called_once()
        sql.list.assert_not_called()

    async def test_list_raises_when_sql_none(self) -> None:
        sheets = self._make_sheets()
        wrapper = _DualWriteInventoryRepo(sheets=sheets, sql=None)

        with patch("app.deps.settings") as mock_settings:
            mock_settings.use_postgres = True
            with pytest.raises(RuntimeError, match="SQL repo unavailable"):
                await wrapper.list()

        sheets.list.assert_not_called()

    async def test_list_all_uses_sql(self) -> None:
        sheets = self._make_sheets()
        sql = self._make_sql()
        wrapper = _DualWriteInventoryRepo(sheets=sheets, sql=sql)

        with patch("app.deps.settings") as mock_settings:
            mock_settings.use_postgres = True
            await wrapper.list_all()

        sql.list_all.assert_awaited_once()

    async def test_get_uses_sql(self) -> None:
        sheets = self._make_sheets()
        sql = self._make_sql()
        wrapper = _DualWriteInventoryRepo(sheets=sheets, sql=sql)

        with patch("app.deps.settings") as mock_settings:
            mock_settings.use_postgres = True
            result = await wrapper.get("BAG001")

        sql.get.assert_awaited_once_with("BAG001")
        assert result == _BAG_ROW


# ---------------------------------------------------------------------------
# _DualWriteHardwareRepo
# ---------------------------------------------------------------------------


class TestDualWriteHardwareRepoReads:
    def _make_sheets(self) -> MagicMock:
        m = MagicMock()
        m.list.return_value = [_HW_ROW]
        m.get.return_value = _HW_ROW
        return m

    def _make_sql(self) -> AsyncMock:
        m = AsyncMock()
        m.list.return_value = [_HW_ROW]
        m.get.return_value = _HW_ROW
        return m

    async def test_list_uses_sql(self) -> None:
        sheets = self._make_sheets()
        sql = self._make_sql()
        wrapper = _DualWriteHardwareRepo(sheets=sheets, sql=sql)

        with patch("app.deps.settings") as mock_settings:
            mock_settings.use_postgres = True
            await wrapper.list(category="Machine")

        sql.list.assert_awaited_once_with(category="Machine")
        sheets.list.assert_not_called()

    async def test_list_uses_sheets_when_postgres_false(self) -> None:
        sheets = self._make_sheets()
        sql = self._make_sql()
        wrapper = _DualWriteHardwareRepo(sheets=sheets, sql=sql)

        with patch("app.deps.settings") as mock_settings:
            mock_settings.use_postgres = False
            await wrapper.list()

        sheets.list.assert_called_once()
        sql.list.assert_not_called()

    async def test_list_raises_when_sql_none(self) -> None:
        sheets = self._make_sheets()
        wrapper = _DualWriteHardwareRepo(sheets=sheets, sql=None)

        with patch("app.deps.settings") as mock_settings:
            mock_settings.use_postgres = True
            with pytest.raises(RuntimeError, match="SQL repo unavailable"):
                await wrapper.list()

        sheets.list.assert_not_called()

    async def test_get_uses_sql(self) -> None:
        sheets = self._make_sheets()
        sql = self._make_sql()
        wrapper = _DualWriteHardwareRepo(sheets=sheets, sql=sql)

        with patch("app.deps.settings") as mock_settings:
            mock_settings.use_postgres = True
            result = await wrapper.get("HW001")

        sql.get.assert_awaited_once_with("HW001")
        assert result == _HW_ROW

    async def test_get_raises_when_sql_none(self) -> None:
        sheets = self._make_sheets()
        wrapper = _DualWriteHardwareRepo(sheets=sheets, sql=None)

        with patch("app.deps.settings") as mock_settings:
            mock_settings.use_postgres = True
            with pytest.raises(RuntimeError, match="SQL repo unavailable"):
                await wrapper.get("HW001")

        sheets.get.assert_not_called()

    async def test_hardware_next_id_still_uses_sheets_when_use_postgres_true(
        self, settings_use_postgres: Any
    ) -> None:
        """next_id() must always delegate to Sheets — never switches to SQL."""
        sheets_mock = MagicMock()
        sheets_mock.next_id.return_value = "HW-42"
        sql_mock = AsyncMock(spec=SqlHardwareRepo)

        wrapper = _DualWriteHardwareRepo(sheets=sheets_mock, sql=sql_mock)
        result = wrapper.next_id("Grinder")

        sheets_mock.next_id.assert_called_once_with("Grinder")
        sql_mock.next_id.assert_not_called()
        assert result == "HW-42"


# ---------------------------------------------------------------------------
# _DualWriteMaintenanceRepo
# ---------------------------------------------------------------------------


class TestDualWriteMaintenanceRepoReads:
    def _make_sheets(self) -> MagicMock:
        m = MagicMock()
        m.list.return_value = [_MAINT_ROW]
        m.get.return_value = _MAINT_ROW
        return m

    def _make_sql(self) -> AsyncMock:
        m = AsyncMock()
        m.list.return_value = [_MAINT_ROW]
        m.get.return_value = _MAINT_ROW
        return m

    async def test_list_uses_sql(self) -> None:
        sheets = self._make_sheets()
        sql = self._make_sql()
        wrapper = _DualWriteMaintenanceRepo(sheets=sheets, sql=sql)

        with patch("app.deps.settings") as mock_settings:
            mock_settings.use_postgres = True
            await wrapper.list(hardware_id="HW001")

        sql.list.assert_awaited_once_with(hardware_id="HW001")
        sheets.list.assert_not_called()

    async def test_list_uses_sheets_when_postgres_false(self) -> None:
        sheets = self._make_sheets()
        sql = self._make_sql()
        wrapper = _DualWriteMaintenanceRepo(sheets=sheets, sql=sql)

        with patch("app.deps.settings") as mock_settings:
            mock_settings.use_postgres = False
            await wrapper.list()

        sheets.list.assert_called_once()
        sql.list.assert_not_called()

    async def test_list_raises_when_sql_none(self) -> None:
        sheets = self._make_sheets()
        wrapper = _DualWriteMaintenanceRepo(sheets=sheets, sql=None)

        with patch("app.deps.settings") as mock_settings:
            mock_settings.use_postgres = True
            with pytest.raises(RuntimeError, match="SQL repo unavailable"):
                await wrapper.list()

        sheets.list.assert_not_called()

    async def test_get_uses_sql(self) -> None:
        sheets = self._make_sheets()
        sql = self._make_sql()
        wrapper = _DualWriteMaintenanceRepo(sheets=sheets, sql=sql)

        with patch("app.deps.settings") as mock_settings:
            mock_settings.use_postgres = True
            result = await wrapper.get("MNT001")

        sql.get.assert_awaited_once_with("MNT001")
        assert result == _MAINT_ROW

    async def test_get_raises_when_sql_none(self) -> None:
        sheets = self._make_sheets()
        wrapper = _DualWriteMaintenanceRepo(sheets=sheets, sql=None)

        with patch("app.deps.settings") as mock_settings:
            mock_settings.use_postgres = True
            with pytest.raises(RuntimeError, match="SQL repo unavailable"):
                await wrapper.get("MNT001")

        sheets.get.assert_not_called()
