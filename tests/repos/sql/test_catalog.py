"""Unit tests for SqlCatalogRepo."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.catalog import CatalogBean
from app.repos.sql.catalog import SqlCatalogRepo


async def test_upsert_creates_row(db_session: AsyncSession) -> None:
    """upsert() inserts a row with correct field mapping."""
    repo = SqlCatalogRepo(db=db_session)
    row = {
        "Catalog_ID": "CAT001",
        "Roaster": "Test Roaster",
        "Bean_Name": "Test Bean",
        "Roast_Level": "Light",
    }
    await repo.upsert(row)

    result = await db_session.execute(
        select(CatalogBean).where(CatalogBean.roaster == "Test Roaster")
    )
    bean = result.scalar_one()
    assert bean.bean_name == "Test Bean"
    assert bean.roast_level == "Light"
    assert bean.household_id is None  # M2: intentionally NULL — regression guard for M5
    assert bean.notes == "CAT001"  # Catalog_ID stored as cross-reference


async def test_upsert_missing_optional_fields(db_session: AsyncSession) -> None:
    """upsert() succeeds when optional fields are absent."""
    repo = SqlCatalogRepo(db=db_session)
    row = {"Roaster": "Minimal Roaster", "Bean_Name": "Minimal Bean"}
    await repo.upsert(row)

    result = await db_session.execute(
        select(CatalogBean).where(CatalogBean.roaster == "Minimal Roaster")
    )
    bean = result.scalar_one()
    assert bean.origin is None
    assert bean.process is None
    assert bean.roast_level is None


async def test_list_returns_empty(db_session: AsyncSession) -> None:
    """list() returns empty list on empty DB."""
    repo = SqlCatalogRepo(db=db_session)
    assert await repo.list() == []


async def test_get_returns_none(db_session: AsyncSession) -> None:
    """get() returns None when entry does not exist."""
    repo = SqlCatalogRepo(db=db_session)
    assert await repo.get("CAT001") is None


async def test_add_many_inserts_all_rows(db_session: AsyncSession) -> None:
    """add_many() inserts all rows."""
    repo = SqlCatalogRepo(db=db_session)
    rows = [{"Roaster": f"Roaster{i}", "Bean_Name": f"Bean{i}"} for i in range(3)]
    await repo.add_many(rows)

    result = await db_session.execute(
        select(CatalogBean).where(CatalogBean.roaster.like("Roaster%"))
    )
    beans = result.scalars().all()
    assert len(beans) == 3
