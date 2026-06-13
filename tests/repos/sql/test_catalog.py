"""Unit tests for SqlCatalogRepo."""

from __future__ import annotations

import uuid

import sqlalchemy as sa
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.catalog import CatalogBean
from app.repos.sql.catalog import SqlCatalogRepo


async def test_upsert_creates_row(db_session: AsyncSession, test_household_id) -> None:
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
    assert bean.household_id == test_household_id
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


# ---------------------------------------------------------------------------
# Issue #64 — write-then-read integration (Postgres read path)
# ---------------------------------------------------------------------------


async def test_upsert_then_list_returns_row(db_session: AsyncSession) -> None:
    """write-then-read: row written via upsert() appears in list()."""
    repo = SqlCatalogRepo(db=db_session)
    await repo.upsert(
        {
            "Catalog_ID": "CAT-20260515-01",
            "Roaster": "Blue Bottle",
            "Bean_Name": "Giant Steps",
            "Roast_Level": "Light",
        }
    )
    results = await repo.list()
    assert len(results) == 1
    assert results[0]["Catalog_ID"] == "CAT-20260515-01"
    assert results[0]["Roaster"] == "Blue Bottle"
    assert results[0]["Bean_Name"] == "Giant Steps"
    assert results[0]["Roast_Level"] == "Light"


async def test_upsert_then_get_returns_row(db_session: AsyncSession) -> None:
    """write-then-read: row written via upsert() is retrievable via get()."""
    repo = SqlCatalogRepo(db=db_session)
    await repo.upsert(
        {
            "Catalog_ID": "CAT-20260515-02",
            "Roaster": "Stumptown",
            "Bean_Name": "Hair Bender",
        }
    )
    result = await repo.get("CAT-20260515-02")
    assert result is not None
    assert result["Catalog_ID"] == "CAT-20260515-02"
    assert result["Roaster"] == "Stumptown"
    assert result["Bean_Name"] == "Hair Bender"


# ---------------------------------------------------------------------------
# Issue #69 — happy-path: list() and get() with data
# ---------------------------------------------------------------------------


async def test_list_returns_inserted_row(db_session: AsyncSession) -> None:
    """list() returns a dict with correct field mapping for an upserted row."""
    repo = SqlCatalogRepo(db=db_session)
    await repo.upsert(
        {
            "Catalog_ID": "CAT-20260515-03",
            "Roaster": "Counter Culture",
            "Bean_Name": "Hologram",
            "Roast_Level": "Medium",
        }
    )
    results = await repo.list()
    assert len(results) == 1
    row = results[0]
    assert row["Catalog_ID"] == "CAT-20260515-03"
    assert row["Roaster"] == "Counter Culture"
    assert row["Bean_Name"] == "Hologram"
    assert row["Roast_Level"] == "Medium"


async def test_get_returns_inserted_row(db_session: AsyncSession) -> None:
    """get() returns a dict with correct field mapping for an upserted row."""
    repo = SqlCatalogRepo(db=db_session)
    await repo.upsert(
        {
            "Catalog_ID": "CAT-20260515-04",
            "Roaster": "Onyx",
            "Bean_Name": "Tropical Weather",
            "Roast_Level": "Light",
        }
    )
    result = await repo.get("CAT-20260515-04")
    assert result is not None
    assert result["Catalog_ID"] == "CAT-20260515-04"
    assert result["Roaster"] == "Onyx"
    assert result["Bean_Name"] == "Tropical Weather"
    assert result["Roast_Level"] == "Light"


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
        {"uid": user_id, "username": f"catalog-{user_id.hex}", "display_name": name},
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


async def test_catalog_reads_are_scoped_to_active_household(
    db_session: AsyncSession, test_household_id: uuid.UUID
) -> None:
    other_household_id = await _create_household(db_session, "Catalog Other")
    db_session.add(
        CatalogBean(
            household_id=test_household_id,
            roaster="Visible",
            bean_name="A",
            sheets_id="CAT-SCOPE-A",
        )
    )
    await db_session.flush()
    await db_session.execute(
        sa.text("SELECT set_config('app.current_household_id', :hid, true)"),
        {"hid": str(other_household_id)},
    )
    db_session.add(
        CatalogBean(
            household_id=other_household_id,
            roaster="Hidden",
            bean_name="B",
            sheets_id="CAT-SCOPE-B",
        )
    )
    await db_session.flush()
    await db_session.execute(
        sa.text("SELECT set_config('app.current_household_id', :hid, true)"),
        {"hid": str(test_household_id)},
    )

    repo = SqlCatalogRepo(db=db_session)
    rows = await repo.list()
    assert {row["Catalog_ID"] for row in rows} == {"CAT-SCOPE-A"}
    assert await repo.get("CAT-SCOPE-B") is None
    assert {row["Catalog_ID"] for row in await repo._fetch_all()} == {"CAT-SCOPE-A"}


async def test_catalog_reads_without_household_context_fail_closed(
    db_session: AsyncSession,
) -> None:
    repo = SqlCatalogRepo(db=db_session)
    await repo.upsert({"Catalog_ID": "CAT-NO-CONTEXT", "Roaster": "R", "Bean_Name": "B"})
    await db_session.execute(sa.text("SELECT set_config('app.current_household_id', '', true)"))

    assert await repo.list() == []
    assert await repo.get("CAT-NO-CONTEXT") is None
