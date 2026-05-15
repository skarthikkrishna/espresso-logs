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
