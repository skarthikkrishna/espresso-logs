"""Unit tests for SqlMaintenanceRepo."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.maintenance import MaintenanceLog
from app.repos.sql.maintenance import SqlMaintenanceRepo


async def test_add_creates_row(db_session: AsyncSession) -> None:
    """add() inserts a row with correct field mapping."""
    repo = SqlMaintenanceRepo(db=db_session)
    row = {"Action_Type": "Backflush", "Notes": "Weekly clean"}
    await repo.add(row)

    result = await db_session.execute(
        select(MaintenanceLog).where(MaintenanceLog.action == "Backflush")
    )
    event = result.scalar_one()
    assert event.action == "Backflush"
    assert event.notes == "Weekly clean"
    assert event.household_id is None
    assert event.hardware_id is None


async def test_add_empty_action_falls_back_to_empty_string(db_session: AsyncSession) -> None:
    """add() uses empty string for missing Action_Type (NOT NULL constraint)."""
    repo = SqlMaintenanceRepo(db=db_session)
    row: dict = {}
    await repo.add(row)

    result = await db_session.execute(select(MaintenanceLog).where(MaintenanceLog.action == ""))
    event = result.scalars().first()
    assert event is not None
    assert event.action == ""


async def test_add_many_inserts_all_rows(db_session: AsyncSession) -> None:
    """add_many() inserts all rows."""
    repo = SqlMaintenanceRepo(db=db_session)
    rows = [
        {"Action_Type": "Clean", "Notes": ""},
        {"Action_Type": "Calibrate", "Notes": ""},
    ]
    await repo.add_many(rows)

    result = await db_session.execute(
        select(MaintenanceLog).where(MaintenanceLog.action.in_(["Clean", "Calibrate"]))
    )
    events = result.scalars().all()
    assert len(events) == 2


async def test_list_returns_empty(db_session: AsyncSession) -> None:
    """list() returns empty list on empty DB."""
    repo = SqlMaintenanceRepo(db=db_session)
    assert await repo.list() == []


async def test_get_returns_none(db_session: AsyncSession) -> None:
    """get() returns None when entry does not exist."""
    repo = SqlMaintenanceRepo(db=db_session)
    assert await repo.get("MAINT001") is None


# ---------------------------------------------------------------------------
# Issue #69 — happy-path: list() and get() with data
# ---------------------------------------------------------------------------


async def test_list_returns_inserted_row(db_session: AsyncSession) -> None:
    """list() returns a dict with correct field mapping for an inserted row."""
    repo = SqlMaintenanceRepo(db=db_session)
    await repo.add(
        {"Maintenance_ID": "MNT-001", "Action_Type": "Backflush", "Notes": "Weekly clean"}
    )
    results = await repo.list()
    assert len(results) == 1
    row = results[0]
    assert row["Maintenance_ID"] == "MNT-001"
    assert row["Action_Type"] == "Backflush"
    assert row["Notes"] == "Weekly clean"


async def test_get_returns_inserted_row(db_session: AsyncSession) -> None:
    """get() returns a dict with correct field mapping for an inserted row."""
    repo = SqlMaintenanceRepo(db=db_session)
    await repo.add(
        {"Maintenance_ID": "MNT-002", "Action_Type": "Descale", "Notes": "Monthly descale"}
    )
    result = await repo.get("MNT-002")
    assert result is not None
    assert result["Maintenance_ID"] == "MNT-002"
    assert result["Action_Type"] == "Descale"
    assert result["Notes"] == "Monthly descale"


# ---------------------------------------------------------------------------
# T-MR-01..03 — SqlMaintenanceRepo.upsert() unit tests
# ---------------------------------------------------------------------------


async def test_mr01_upsert_new_sheets_id_inserts_row(db_session: AsyncSession) -> None:
    """T-MR-01: upsert() on a new sheets_id inserts a row with correct sheets_hardware_id."""
    repo = SqlMaintenanceRepo(db=db_session)
    row = {
        "Maintenance_ID": "MNT-UPSERT-01",
        "Hardware_ID": "HW-42",
        "Date": "2024-03-15",
        "Action_Type": "Backflush",
        "Notes": "Weekly",
    }
    await repo.upsert(row)

    result = await repo.get("MNT-UPSERT-01")
    assert result is not None
    assert result["Maintenance_ID"] == "MNT-UPSERT-01"
    assert result["Hardware_ID"] == "HW-42"
    assert result["Action_Type"] == "Backflush"
    assert result["Notes"] == "Weekly"


async def test_mr02_upsert_null_hardware_id_updates_only_hardware_id(
    db_session: AsyncSession,
) -> None:
    """T-MR-02: upsert() on existing row with NULL sheets_hardware_id updates only that field.

    ``performed_at``, ``action``, and ``notes`` must be unchanged.
    """
    repo = SqlMaintenanceRepo(db=db_session)
    # Insert a row without Hardware_ID (simulates a pre-migration-0005 write)
    await repo.add(
        {
            "Maintenance_ID": "MNT-UPSERT-02",
            "Action_Type": "Descale",
            "Notes": "Original notes",
            "Date": "2024-01-10",
        }
    )

    # Upsert should fill in the hardware ID without touching other fields
    await repo.upsert(
        {
            "Maintenance_ID": "MNT-UPSERT-02",
            "Hardware_ID": "HW-99",
            "Action_Type": "SHOULD_NOT_OVERWRITE",
            "Notes": "SHOULD_NOT_OVERWRITE",
            "Date": "9999-12-31",
        }
    )

    result = await repo.get("MNT-UPSERT-02")
    assert result is not None
    assert result["Hardware_ID"] == "HW-99"
    # Original fields must be unchanged
    assert result["Action_Type"] == "Descale"
    assert result["Notes"] == "Original notes"


async def test_mr03_upsert_existing_non_null_hardware_id_is_noop(
    db_session: AsyncSession,
) -> None:
    """T-MR-03: upsert() on existing row with non-NULL sheets_hardware_id is a no-op."""
    repo = SqlMaintenanceRepo(db=db_session)
    # Insert a row that already has Hardware_ID set
    await repo.add(
        {
            "Maintenance_ID": "MNT-UPSERT-03",
            "Hardware_ID": "HW-ORIGINAL",
            "Action_Type": "Clean",
            "Notes": "Original",
            "Date": "2024-02-20",
        }
    )

    # Upsert with a different Hardware_ID — must be ignored
    await repo.upsert(
        {
            "Maintenance_ID": "MNT-UPSERT-03",
            "Hardware_ID": "HW-SHOULD-NOT-REPLACE",
            "Action_Type": "IGNORED",
            "Notes": "IGNORED",
            "Date": "9999-12-31",
        }
    )

    result = await repo.get("MNT-UPSERT-03")
    assert result is not None
    # sheets_hardware_id was already set — row must be completely unchanged
    assert result["Hardware_ID"] == "HW-ORIGINAL"
    assert result["Action_Type"] == "Clean"
    assert result["Notes"] == "Original"
