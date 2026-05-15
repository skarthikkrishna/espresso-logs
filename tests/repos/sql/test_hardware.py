"""Unit tests for SqlHardwareRepo."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.hardware import Hardware
from app.repos.sql.hardware import SqlHardwareRepo


async def test_upsert_creates_row(db_session: AsyncSession) -> None:
    """upsert() inserts a row with correct field mapping."""
    repo = SqlHardwareRepo(db=db_session)
    row = {"Name": "Decent DE1", "Category": "Machine"}
    await repo.upsert(row)

    result = await db_session.execute(select(Hardware).where(Hardware.name == "Decent DE1"))
    item = result.scalar_one()
    assert item.name == "Decent DE1"
    assert item.category == "Machine"
    assert item.household_id is None


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
