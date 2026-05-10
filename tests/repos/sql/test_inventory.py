"""Unit tests for SqlInventoryRepo."""

from __future__ import annotations

import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inventory import InventoryBag
from app.repos.sql.inventory import SqlInventoryRepo


async def test_upsert_creates_row(db_session: AsyncSession) -> None:
    """upsert() inserts a row with correct field mapping."""
    repo = SqlInventoryRepo(db=db_session)
    row = {"RoastDate": "2024-01-15", "Beans": "Ethiopia Yirgacheffe"}
    await repo.upsert(row)

    result = await db_session.execute(
        select(InventoryBag).where(InventoryBag.notes == "Ethiopia Yirgacheffe")
    )
    bag = result.scalar_one()
    assert bag.roast_date == datetime.date(2024, 1, 15)
    assert bag.notes == "Ethiopia Yirgacheffe"
    assert bag.household_id is None
    assert bag.catalog_id is None


async def test_upsert_handles_invalid_date(db_session: AsyncSession) -> None:
    """upsert() handles invalid date gracefully (no exception)."""
    repo = SqlInventoryRepo(db=db_session)
    row = {"RoastDate": "not-a-date", "Beans": "Invalid Date Bean"}
    await repo.upsert(row)

    result = await db_session.execute(
        select(InventoryBag).where(InventoryBag.notes == "Invalid Date Bean")
    )
    bag = result.scalar_one()
    assert bag.roast_date is None


async def test_upsert_handles_empty_date(db_session: AsyncSession) -> None:
    """upsert() handles empty date gracefully (no exception)."""
    repo = SqlInventoryRepo(db=db_session)
    row = {"RoastDate": "", "Beans": "Empty Date Bean"}
    await repo.upsert(row)

    result = await db_session.execute(
        select(InventoryBag).where(InventoryBag.notes == "Empty Date Bean")
    )
    bag = result.scalar_one()
    assert bag.roast_date is None


async def test_list_returns_empty(db_session: AsyncSession) -> None:
    """list() is a no-op stub in M2."""
    repo = SqlInventoryRepo(db=db_session)
    assert repo.list() == []


async def test_list_all_returns_empty(db_session: AsyncSession) -> None:
    """list_all() is a no-op stub in M2."""
    repo = SqlInventoryRepo(db=db_session)
    assert repo.list_all() == []


async def test_get_returns_none(db_session: AsyncSession) -> None:
    """get() is a no-op stub in M2."""
    repo = SqlInventoryRepo(db=db_session)
    assert repo.get("BAG001") is None
