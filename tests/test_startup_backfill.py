"""Unit tests for the startup backfill functions (T-BF-01 through T-BF-09).

These tests exercise the idempotency guards, Sheets-read skipping, upsert call
counts, and exception-handling behaviour of the backfill functions defined in
app/main.py.  All fixtures use scope="function" so there is no shared mutable
state between tests.
"""

from __future__ import annotations

import logging
import uuid
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.inventory import InventoryBag
from app.models.maintenance import MaintenanceLog
from app.testing.fake_sheets import FakeSheetsClient

_TEST_HOUSEHOLD_ID = uuid.UUID("00000000-0000-0000-0000-00000000bf01")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_mock_db(count_return: int = 0) -> MagicMock:
    """Return a fresh mock AsyncSession whose first execute() returns *count_return*."""
    mock_db = MagicMock()
    mock_db.add = MagicMock()
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()
    mock_db.rollback = AsyncMock()

    count_result = MagicMock()
    count_result.scalar_one.return_value = count_return

    mock_db.execute = AsyncMock(return_value=count_result)
    return mock_db


def _household_context_result() -> MagicMock:
    """Return a mock current_setting() result with an active household id."""
    result = MagicMock()
    result.scalar_one_or_none.return_value = str(_TEST_HOUSEHOLD_ID)
    return result


def _make_session_factory(mock_db: MagicMock):  # type: ignore[no-untyped-def]
    """Return a get_session_factory replacement that yields *mock_db*.

    The real get_session_factory() returns an async_sessionmaker.  Calling
    async_sessionmaker() returns an AsyncSession async context manager.  This
    helper replicates that two-call contract so that the idiom
    ``async with get_session_factory()() as db:`` works in tests.
    """

    @asynccontextmanager  # type: ignore[arg-type]
    async def _fake_cm() -> MagicMock:
        yield mock_db

    def _session_factory() -> MagicMock:
        return _fake_cm()

    # get_session_factory() → _session_factory; _session_factory() → context manager
    return lambda: _session_factory


# ---------------------------------------------------------------------------
# T-BF-01: use_postgres=False → skip entirely
# ---------------------------------------------------------------------------


async def test_bf01_use_postgres_false_skips_backfill() -> None:
    """T-BF-01: use_postgres=False → run_startup_backfill returns immediately.

    No Sheets read and no DB query must be issued.
    """
    from app.main import run_startup_backfill

    mock_db = _make_mock_db(count_return=99)
    session_factory = _make_session_factory(mock_db)

    with (
        patch("app.main.settings") as mock_settings,
        patch("app.main.get_session_factory", session_factory),
    ):
        mock_settings.use_postgres = False
        await run_startup_backfill()

    # No DB interaction should have occurred
    mock_db.execute.assert_not_called()
    mock_db.add.assert_not_called()


# ---------------------------------------------------------------------------
# T-BF-02: maintenance — zero NULL rows → Sheets read skipped
# ---------------------------------------------------------------------------


async def test_bf02_maintenance_zero_null_rows_skips_sheets_read() -> None:
    """T-BF-02: maintenance_log has 0 NULL sheets_hardware_id rows → no Sheets read."""
    from app.main import _backfill_maintenance_logs

    fake_sheets = FakeSheetsClient(
        {"Maintenance": [{"Maintenance_ID": "MNT-1", "Hardware_ID": "HW-1"}]}
    )
    mock_db = _make_mock_db(count_return=0)

    await _backfill_maintenance_logs(mock_db, fake_sheets)

    assert fake_sheets.call_counts.get("Maintenance", 0) == 0
    mock_db.add.assert_not_called()


# ---------------------------------------------------------------------------
# T-BF-03: inventory — zero NULL rows → Sheets read skipped
# ---------------------------------------------------------------------------


async def test_bf03_inventory_zero_null_rows_skips_sheets_read() -> None:
    """T-BF-03: inventory_bags has 0 NULL sheets_catalog_id rows → no Sheets read."""
    from app.main import _backfill_inventory_bags

    fake_sheets = FakeSheetsClient(
        {"Inventory": [{"Bag_ID": "BAG-1", "Catalog_ID": "CAT-1", "Status": "Active"}]}
    )
    mock_db = _make_mock_db(count_return=0)

    await _backfill_inventory_bags(mock_db, fake_sheets)

    assert fake_sheets.call_counts.get("Inventory", 0) == 0
    mock_db.add.assert_not_called()


# ---------------------------------------------------------------------------
# T-BF-04: maintenance — N NULL rows → upsert called N times
# ---------------------------------------------------------------------------


async def test_bf04_maintenance_n_null_rows_upserts_n_times() -> None:
    """T-BF-04: N maintenance rows with NULL sheets_hardware_id → upsert called N times."""
    from app.main import _backfill_maintenance_logs
    from app.repos.sql.maintenance import SqlMaintenanceRepo

    fake_sheets = FakeSheetsClient(
        {
            "Maintenance": [
                {
                    "Maintenance_ID": "MNT-1",
                    "Hardware_ID": "HW-1",
                    "Date": "2024-01-01",
                    "Action_Type": "Backflush",
                    "Notes": "",
                },
                {
                    "Maintenance_ID": "MNT-2",
                    "Hardware_ID": "HW-1",
                    "Date": "2024-01-02",
                    "Action_Type": "Clean",
                    "Notes": "",
                },
            ]
        }
    )
    mock_db = _make_mock_db(count_return=2)

    with patch.object(SqlMaintenanceRepo, "upsert", new_callable=AsyncMock) as mock_upsert:
        await _backfill_maintenance_logs(mock_db, fake_sheets)

    assert mock_upsert.call_count == 2
    # Verify Sheets was read exactly once
    assert fake_sheets.call_counts.get("Maintenance", 0) == 1
    # Verify the Hardware_ID is passed through to upsert
    called_ids = {call.args[0].get("Maintenance_ID") for call in mock_upsert.call_args_list}
    assert called_ids == {"MNT-1", "MNT-2"}


# ---------------------------------------------------------------------------
# T-BF-05: inventory — N NULL rows → upsert called N times
# ---------------------------------------------------------------------------


async def test_bf05_inventory_n_null_rows_upserts_n_times() -> None:
    """T-BF-05: N inventory bags with NULL sheets_catalog_id → upsert called N times.

    Both bags are absent from Postgres (SELECT returns None), so the INSERT
    path (SqlInventoryRepo.upsert) is exercised for each row.
    """
    from app.main import _backfill_inventory_bags
    from app.repos.sql.inventory import SqlInventoryRepo

    fake_sheets = FakeSheetsClient(
        {
            "Inventory": [
                {
                    "Bag_ID": "BAG-1",
                    "Catalog_ID": "CAT-1",
                    "Beans": "Ethiopia",
                    "Status": "Active",
                },
                {
                    "Bag_ID": "BAG-2",
                    "Catalog_ID": "CAT-2",
                    "Beans": "Colombia",
                    "Status": "Depleted",
                },
            ]
        }
    )

    # count query → 2; context query → household; per-bag SELECTs → None.
    count_result = MagicMock()
    count_result.scalar_one.return_value = 2
    select_none = MagicMock()
    select_none.scalar_one_or_none.return_value = None

    mock_db = MagicMock()
    mock_db.add = MagicMock()
    mock_db.commit = AsyncMock()
    mock_db.execute = AsyncMock(
        side_effect=[count_result, _household_context_result(), select_none, select_none]
    )

    with patch.object(SqlInventoryRepo, "upsert", new_callable=AsyncMock) as mock_upsert:
        await _backfill_inventory_bags(mock_db, fake_sheets)

    assert mock_upsert.call_count == 2
    assert fake_sheets.call_counts.get("Inventory", 0) == 1
    called_ids = {call.args[0].get("Bag_ID") for call in mock_upsert.call_args_list}
    assert called_ids == {"BAG-1", "BAG-2"}


# ---------------------------------------------------------------------------
# T-BF-06: maintenance — row with sheets_hardware_id already set → not updated
# ---------------------------------------------------------------------------


async def test_bf06_maintenance_already_set_row_is_not_updated() -> None:
    """T-BF-06: row already has sheets_hardware_id set → no DB write (no-op branch)."""
    from app.main import _backfill_maintenance_logs

    fake_sheets = FakeSheetsClient(
        {
            "Maintenance": [
                {
                    "Maintenance_ID": "MNT-1",
                    "Hardware_ID": "HW-1",
                    "Date": "2024-01-01",
                    "Action_Type": "Backflush",
                    "Notes": "",
                }
            ]
        }
    )

    # Simulate: count=1, context query returns a household, then SELECT returns
    # existing row with sheets_hardware_id already populated → upsert no-ops.
    existing_row = MagicMock(spec=MaintenanceLog)
    existing_row.sheets_hardware_id = "HW-1"  # already set

    count_result = MagicMock()
    count_result.scalar_one.return_value = 1

    select_result = MagicMock()
    select_result.scalar_one_or_none.return_value = existing_row

    mock_db = MagicMock()
    mock_db.add = MagicMock()
    mock_db.commit = AsyncMock()
    mock_db.execute = AsyncMock(
        side_effect=[count_result, _household_context_result(), select_result]
    )

    await _backfill_maintenance_logs(mock_db, fake_sheets)

    # Row existed with non-NULL hardware_id → no INSERT, no UPDATE commit
    mock_db.add.assert_not_called()
    mock_db.commit.assert_not_called()


# ---------------------------------------------------------------------------
# T-BF-07: inventory — row with sheets_catalog_id already set → not updated
# ---------------------------------------------------------------------------


async def test_bf07_inventory_already_set_row_is_not_updated() -> None:
    """T-BF-07: inventory bag already has sheets_catalog_id set → no DB write."""
    from app.main import _backfill_inventory_bags

    fake_sheets = FakeSheetsClient(
        {
            "Inventory": [
                {
                    "Bag_ID": "BAG-1",
                    "Catalog_ID": "CAT-1",
                    "Beans": "Ethiopia",
                    "Status": "Active",
                }
            ]
        }
    )

    existing_bag = MagicMock(spec=InventoryBag)
    existing_bag.sheets_catalog_id = "CAT-1"  # already set

    count_result = MagicMock()
    count_result.scalar_one.return_value = 1

    select_result = MagicMock()
    select_result.scalar_one_or_none.return_value = existing_bag

    mock_db = MagicMock()
    mock_db.add = MagicMock()
    mock_db.commit = AsyncMock()
    mock_db.execute = AsyncMock(
        side_effect=[count_result, _household_context_result(), select_result]
    )

    await _backfill_inventory_bags(mock_db, fake_sheets)

    mock_db.add.assert_not_called()
    mock_db.commit.assert_not_called()


# ---------------------------------------------------------------------------
# T-BF-08: Sheets API raises → caught, warning logged, no re-raise
# ---------------------------------------------------------------------------


async def test_bf08_sheets_exception_caught_and_logged(caplog: pytest.LogCaptureFixture) -> None:
    """T-BF-08: Sheets API raises → exception caught; WARNING logged; function returns normally."""
    from app.main import run_startup_backfill

    mock_db = _make_mock_db(count_return=1)
    session_factory = _make_session_factory(mock_db)

    # Make get_sheets_client raise to simulate an unavailable Sheets API
    def _raising_get_sheets_client() -> None:
        raise RuntimeError("Sheets API unavailable")

    with (
        patch("app.main.settings") as mock_settings,
        patch("app.main.get_session_factory", session_factory),
        patch("app.main.get_sheets_client", _raising_get_sheets_client),
        caplog.at_level(logging.WARNING, logger="app.main"),
    ):
        mock_settings.use_postgres = True
        # Must not raise
        await run_startup_backfill()

    assert any("Startup backfill failed" in r.message for r in caplog.records)
    assert any("Sheets API unavailable" in r.message for r in caplog.records)


# ---------------------------------------------------------------------------
# T-BF-09: Postgres raises mid-backfill → caught, warning logged, no re-raise
# ---------------------------------------------------------------------------


async def test_bf09_postgres_exception_caught_and_logged(caplog: pytest.LogCaptureFixture) -> None:
    """T-BF-09: Postgres raises during backfill → exception caught; WARNING logged; returns normally."""
    from app.main import run_startup_backfill

    # Make db.execute raise on the first call (count query)
    mock_db = MagicMock()
    mock_db.execute = AsyncMock(side_effect=RuntimeError("connection refused"))
    session_factory = _make_session_factory(mock_db)

    fake_sheets = FakeSheetsClient({"Maintenance": [], "Inventory": []})

    with (
        patch("app.main.settings") as mock_settings,
        patch("app.main.get_session_factory", session_factory),
        patch("app.main.get_sheets_client", return_value=fake_sheets),
        caplog.at_level(logging.WARNING, logger="app.main"),
    ):
        mock_settings.use_postgres = True
        # Must not raise
        await run_startup_backfill()

    assert any("Startup backfill failed" in r.message for r in caplog.records)
    assert any("connection refused" in r.message for r in caplog.records)
