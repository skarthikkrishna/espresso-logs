"""Unit tests for SqlHardwareRepo."""

from __future__ import annotations

import uuid

import sqlalchemy as sa
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.hardware import Hardware
from app.repos.sql.hardware import SqlHardwareRepo


async def test_upsert_creates_row(db_session: AsyncSession, test_household_id) -> None:
    """upsert() inserts a row with correct field mapping."""
    repo = SqlHardwareRepo(db=db_session)
    row = {"Name": "Decent DE1", "Category": "Machine"}
    await repo.upsert(row)

    result = await db_session.execute(select(Hardware).where(Hardware.name == "Decent DE1"))
    item = result.scalar_one()
    assert item.name == "Decent DE1"
    assert item.category == "Machine"
    assert item.household_id == test_household_id


async def test_upsert_empty_name_falls_back_to_empty_string(db_session: AsyncSession) -> None:
    """upsert() uses empty string for missing Name (NOT NULL constraint)."""
    repo = SqlHardwareRepo(db=db_session)
    row = {"Category": "Grinder"}
    await repo.upsert(row)

    result = await db_session.execute(
        select(Hardware).where(Hardware.name == "", Hardware.category == "Grinder")
    )
    item = result.scalars().first()
    assert item is not None
    assert item.name == ""


async def test_upsert_empty_category_falls_back_to_empty_string(db_session: AsyncSession) -> None:
    """upsert() uses empty string for missing Category (NOT NULL constraint)."""
    repo = SqlHardwareRepo(db=db_session)
    row = {"Name": "Orphan"}
    await repo.upsert(row)

    result = await db_session.execute(select(Hardware).where(Hardware.name == "Orphan"))
    item = result.scalar_one()
    assert item.category == ""


async def test_list_returns_empty(db_session: AsyncSession) -> None:
    """list() returns empty list on empty DB."""
    repo = SqlHardwareRepo(db=db_session)
    assert await repo.list() == []


async def test_get_returns_none(db_session: AsyncSession) -> None:
    """get() returns None when entry does not exist."""
    repo = SqlHardwareRepo(db=db_session)
    assert await repo.get("M01") is None


async def test_next_id_returns_empty_string(db_session: AsyncSession) -> None:
    """next_id() is a no-op stub returning empty string in M2."""
    repo = SqlHardwareRepo(db=db_session)
    assert repo.next_id("Machine") == ""


# ---------------------------------------------------------------------------
# Issue #69 — happy-path: list() and get() with data
# ---------------------------------------------------------------------------


async def test_list_returns_inserted_row(db_session: AsyncSession) -> None:
    """list() returns a dict with correct field mapping for an upserted row."""
    repo = SqlHardwareRepo(db=db_session)
    await repo.upsert({"Hardware_ID": "HW-001", "Name": "Decent DE1", "Category": "Machine"})
    results = await repo.list()
    assert len(results) == 1
    row = results[0]
    assert row["Hardware_ID"] == "HW-001"
    assert row["Name"] == "Decent DE1"
    assert row["Category"] == "Machine"


async def test_get_returns_inserted_row(db_session: AsyncSession) -> None:
    """get() returns a dict with correct field mapping for an upserted row."""
    repo = SqlHardwareRepo(db=db_session)
    await repo.upsert({"Hardware_ID": "HW-002", "Name": "Niche Zero", "Category": "Grinder"})
    result = await repo.get("HW-002")
    assert result is not None
    assert result["Hardware_ID"] == "HW-002"
    assert result["Name"] == "Niche Zero"
    assert result["Category"] == "Grinder"


async def _create_household(db_session: AsyncSession, name: str) -> uuid.UUID:
    user_id = uuid.uuid4()
    household_id = uuid.uuid4()
    await db_session.execute(
        sa.text(
            """
            INSERT INTO users (id, username, password_hash, display_name)
            VALUES (:uid, :username, 'fixture-only', :display_name)
            """
        ),
        {"uid": user_id, "username": f"hardware-{user_id.hex}", "display_name": name},
    )
    await db_session.execute(
        sa.text(
            """
            INSERT INTO households (id, name, created_by)
            VALUES (:hid, :name, :uid)
            """
        ),
        {"hid": household_id, "name": name, "uid": user_id},
    )
    return household_id


async def test_hardware_reads_are_scoped_to_active_household(
    db_session: AsyncSession, test_household_id: uuid.UUID
) -> None:
    other_household_id = await _create_household(db_session, "Hardware Other")
    db_session.add(
        Hardware(
            household_id=test_household_id,
            name="Visible",
            category="Machine",
            sheets_id="HW-SCOPE-A",
        )
    )
    await db_session.flush()
    await db_session.execute(
        sa.text("SELECT set_config('app.current_household_id', :hid, true)"),
        {"hid": str(other_household_id)},
    )
    db_session.add(
        Hardware(
            household_id=other_household_id,
            name="Hidden",
            category="Machine",
            sheets_id="HW-SCOPE-B",
        )
    )
    await db_session.flush()
    await db_session.execute(
        sa.text("SELECT set_config('app.current_household_id', :hid, true)"),
        {"hid": str(test_household_id)},
    )

    repo = SqlHardwareRepo(db=db_session)
    rows = await repo.list(category="Machine")
    assert {row["Hardware_ID"] for row in rows} == {"HW-SCOPE-A"}
    assert await repo.get("HW-SCOPE-B") is None


async def test_hardware_reads_without_household_context_fail_closed(
    db_session: AsyncSession,
) -> None:
    repo = SqlHardwareRepo(db=db_session)
    await repo.upsert({"Hardware_ID": "HW-NO-CONTEXT", "Name": "M", "Category": "Machine"})
    await db_session.execute(sa.text("SELECT set_config('app.current_household_id', '', true)"))

    assert await repo.list() == []
    assert await repo.get("HW-NO-CONTEXT") is None
