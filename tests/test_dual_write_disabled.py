"""US-4.4 — Dual-write Sheets path is disabled in M5.

Verifies that _DualWrite* repo wrappers do NOT call the Sheets write methods
(add/upsert) when sql is provided — i.e., the Sheets write path is fully
disabled in Milestone 5.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock


# Import the private dual-write classes directly for unit testing.
# These are intentionally private but must be tested as they gate the
# Sheets write-path switch-off (N-005 / US-4.4).
from app.deps import (  # type: ignore[attr-defined]
    _DualWriteBrewLogRepo,
    _DualWriteCatalogRepo,
    _DualWriteHardwareRepo,
    _DualWriteInventoryRepo,
    _DualWriteMaintenanceRepo,
)


# ---------------------------------------------------------------------------
# US-4.4 — add/upsert never calls Sheets write methods
# ---------------------------------------------------------------------------


async def test_dual_write_brew_log_add_does_not_call_sheets_write() -> None:
    """_DualWriteBrewLogRepo.add() must NOT call _sheets.add() in M5 (US-4.4)."""
    mock_sheets = MagicMock()
    mock_sql = AsyncMock()
    mock_sql.add = AsyncMock()

    repo = _DualWriteBrewLogRepo(sheets=mock_sheets, sql=mock_sql)
    row = {"Shot_ID": "abc123", "Date": "2025-01-01", "Dose": "18"}

    await repo.add(row)

    mock_sheets.add.assert_not_called()
    mock_sql.add.assert_awaited_once_with(row)


async def test_dual_write_catalog_upsert_does_not_call_sheets_write() -> None:
    """_DualWriteCatalogRepo.upsert() must NOT call _sheets.upsert() in M5 (US-4.4)."""
    mock_sheets = MagicMock()
    mock_sql = AsyncMock()
    mock_sql.upsert = AsyncMock()

    repo = _DualWriteCatalogRepo(sheets=mock_sheets, sql=mock_sql)
    row = {"Catalog_ID": "cat001", "Name": "Ethiopian Yirgacheffe"}

    await repo.upsert(row)

    mock_sheets.upsert.assert_not_called()
    mock_sql.upsert.assert_awaited_once_with(row)


async def test_dual_write_inventory_upsert_does_not_call_sheets_write() -> None:
    """_DualWriteInventoryRepo.upsert() must NOT call _sheets.upsert() in M5 (US-4.4)."""
    mock_sheets = MagicMock()
    mock_sql = AsyncMock()
    mock_sql.upsert = AsyncMock()

    repo = _DualWriteInventoryRepo(sheets=mock_sheets, sql=mock_sql)
    row = {"Bag_ID": "bag001", "Status": "Active"}

    await repo.upsert(row)

    mock_sheets.upsert.assert_not_called()
    mock_sql.upsert.assert_awaited_once_with(row)


async def test_dual_write_hardware_upsert_does_not_call_sheets_write() -> None:
    """_DualWriteHardwareRepo.upsert() must NOT call _sheets.upsert() in M5 (US-4.4)."""
    mock_sheets = MagicMock()
    mock_sql = AsyncMock()
    mock_sql.upsert = AsyncMock()

    repo = _DualWriteHardwareRepo(sheets=mock_sheets, sql=mock_sql)
    row = {"Hardware_ID": "GR001", "Name": "Niche Zero"}

    await repo.upsert(row)

    mock_sheets.upsert.assert_not_called()
    mock_sql.upsert.assert_awaited_once_with(row)


async def test_dual_write_maintenance_add_does_not_call_sheets_write() -> None:
    """_DualWriteMaintenanceRepo.add() must NOT call _sheets.add() in M5 (US-4.4)."""
    mock_sheets = MagicMock()
    mock_sql = AsyncMock()
    mock_sql.add = AsyncMock()

    repo = _DualWriteMaintenanceRepo(sheets=mock_sheets, sql=mock_sql)
    row = {"Maintenance_ID": "mnt001", "Hardware_ID": "GR001", "Type": "Cleaning"}

    await repo.add(row)

    mock_sheets.add.assert_not_called()
    mock_sql.add.assert_awaited_once_with(row)
