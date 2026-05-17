"""Unit tests for SqlInventoryRepo."""

from __future__ import annotations

import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.catalog import CatalogBean
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
    """list() returns empty list on empty DB."""
    repo = SqlInventoryRepo(db=db_session)
    assert await repo.list() == []


async def test_list_all_returns_empty(db_session: AsyncSession) -> None:
    """list_all() returns empty list on empty DB."""
    repo = SqlInventoryRepo(db=db_session)
    assert await repo.list_all() == []


async def test_get_returns_none(db_session: AsyncSession) -> None:
    """get() returns None when entry does not exist."""
    repo = SqlInventoryRepo(db=db_session)
    assert await repo.get("BAG001") is None


# ---------------------------------------------------------------------------
# Issue #69 — happy-path: list() and get() with data
# ---------------------------------------------------------------------------


async def test_list_returns_inserted_row(db_session: AsyncSession) -> None:
    """list() returns a dict with correct field mapping for an upserted row."""
    repo = SqlInventoryRepo(db=db_session)
    await repo.upsert(
        {
            "Bag_ID": "BAG-001",
            "Beans": "Ethiopia Natural",
            "RoastDate": "2026-05-01",
            "Status": "Active",
        }
    )
    results = await repo.list()
    assert len(results) == 1
    row = results[0]
    assert row["Bag_ID"] == "BAG-001"
    assert row["Beans"] == "Ethiopia Natural"
    assert row["RoastDate"] == "2026-05-01"
    assert row["Status"] == "Active"


async def test_get_returns_inserted_row(db_session: AsyncSession) -> None:
    """get() returns a dict with correct field mapping for an upserted row."""
    repo = SqlInventoryRepo(db=db_session)
    await repo.upsert(
        {
            "Bag_ID": "BAG-002",
            "Beans": "Kenya AA",
            "RoastDate": "2026-04-20",
            "Status": "Active",
        }
    )
    result = await repo.get("BAG-002")
    assert result is not None
    assert result["Bag_ID"] == "BAG-002"
    assert result["Beans"] == "Kenya AA"
    assert result["RoastDate"] == "2026-04-20"


# ---------------------------------------------------------------------------
# T-INV-JOIN-01..04 — LEFT OUTER JOIN CatalogBean tests
# ---------------------------------------------------------------------------


async def test_inv_join_01_list_all_returns_catalog_sheets_id_when_joined_via_uuid_fk(
    db_session: AsyncSession,
) -> None:
    """T-INV-JOIN-01: list_all() resolves Catalog_ID via UUID FK JOIN."""
    catalog = CatalogBean(roaster="T", bean_name="T", sheets_id="C-JOIN-01")
    db_session.add(catalog)
    await db_session.flush()

    bag = InventoryBag(
        sheets_id="BAG-JOIN-01",
        catalog_id=catalog.id,
        sheets_catalog_id=None,
        beans="T",
        status="Active",
    )
    db_session.add(bag)
    await db_session.flush()

    repo = SqlInventoryRepo(db=db_session)
    results = await repo.list_all()
    assert len(results) == 1
    assert results[0]["Catalog_ID"] == "C-JOIN-01"


async def test_inv_join_02_list_returns_sheets_catalog_id_fallback_when_no_uuid_fk(
    db_session: AsyncSession,
) -> None:
    """T-INV-JOIN-02: list() returns legacy sheets_catalog_id when catalog_id FK is NULL."""
    bag = InventoryBag(
        catalog_id=None,
        sheets_catalog_id="C-LEGACY-01",
        beans="L",
        status="Active",
    )
    db_session.add(bag)
    await db_session.flush()

    repo = SqlInventoryRepo(db=db_session)
    results = await repo.list()
    assert len(results) == 1
    assert results[0]["Catalog_ID"] == "C-LEGACY-01"


async def test_inv_join_03_get_returns_catalog_sheets_id_via_uuid_fk(
    db_session: AsyncSession,
) -> None:
    """T-INV-JOIN-03: get() resolves Catalog_ID via UUID FK JOIN."""
    catalog = CatalogBean(roaster="T", bean_name="T", sheets_id="C-JOIN-03")
    db_session.add(catalog)
    await db_session.flush()

    bag = InventoryBag(
        sheets_id="BAG-JOIN-03",
        catalog_id=catalog.id,
        sheets_catalog_id=None,
        beans="T",
        status="Active",
    )
    db_session.add(bag)
    await db_session.flush()

    repo = SqlInventoryRepo(db=db_session)
    result = await repo.get("BAG-JOIN-03")
    assert result is not None
    assert result["Catalog_ID"] == "C-JOIN-03"


async def test_inv_join_04_list_returns_empty_catalog_id_when_no_catalog_link(
    db_session: AsyncSession,
) -> None:
    """T-INV-JOIN-04: list_all() returns empty Catalog_ID when no FK and no sheets column."""
    bag = InventoryBag(
        catalog_id=None,
        sheets_catalog_id=None,
        beans="NoCatalog",
        status="Active",
    )
    db_session.add(bag)
    await db_session.flush()

    repo = SqlInventoryRepo(db=db_session)
    results = await repo.list_all()
    assert len(results) == 1
    assert results[0]["Catalog_ID"] == ""
