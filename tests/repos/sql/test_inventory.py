"""Unit tests for SqlInventoryRepo."""

from __future__ import annotations

import datetime
import uuid

import sqlalchemy as sa
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.catalog import CatalogBean
from app.models.inventory import InventoryBag
from app.repos.sql.inventory import SqlInventoryRepo


async def test_upsert_creates_row(db_session: AsyncSession, test_household_id) -> None:
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
    assert bag.household_id == test_household_id
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


async def test_status_transition_preserves_unrelated_bag_fields(
    db_session: AsyncSession,
) -> None:
    """Spec-039 B01: Active/Finished updates keep the frontend status contract narrow."""
    repo = SqlInventoryRepo(db=db_session)
    await repo.upsert(
        {
            "Bag_ID": "BAG-SPEC039-STATUS",
            "Beans": "Spec Roaster — Spec Bean",
            "RoastDate": "2026-06-01",
            "RoastLevel": "Medium",
            "Display_Name": "Spec Roaster — Spec Bean",
            "Status": "Active",
            "Storage_Method": "Freezer",
        }
    )

    active = await repo.get("BAG-SPEC039-STATUS")
    assert active is not None
    await repo.upsert({**active, "Status": "Finished"})

    finished = await repo.get("BAG-SPEC039-STATUS")
    assert finished is not None
    assert finished["Status"] == "Finished"
    assert finished["RoastLevel"] == "Medium"
    assert finished["Storage_Method"] == "Freezer"
    assert finished["Beans"] == "Spec Roaster — Spec Bean"

    await repo.upsert({**finished, "Status": "Active"})
    reactivated = await repo.get("BAG-SPEC039-STATUS")
    assert reactivated is not None
    assert reactivated["Status"] == "Active"


async def test_inventory_get_is_household_scoped_by_rls(
    db_session: AsyncSession,
) -> None:
    """Spec-039 B01: another household cannot see an active/finished bag."""
    repo = SqlInventoryRepo(db=db_session)
    await repo.upsert(
        {
            "Bag_ID": "BAG-SPEC039-RLS",
            "Beans": "Household One",
            "Status": "Active",
        }
    )

    other_user_id = uuid.uuid4()
    other_household_id = uuid.uuid4()
    await db_session.execute(
        sa.text(
            """
            INSERT INTO users (id, username, password_hash, display_name)
            VALUES (:uid, :username, 'fixture-only', 'Inventory RLS')
            """
        ),
        {"uid": other_user_id, "username": f"inventory-rls-{other_user_id.hex}"},
    )
    await db_session.execute(
        sa.text(
            """
            INSERT INTO households (id, name, created_by)
            VALUES (:hid, 'Inventory RLS Household', :uid)
            """
        ),
        {"hid": other_household_id, "uid": other_user_id},
    )
    await db_session.execute(
        sa.text("SELECT set_config('app.current_household_id', :hid, true)"),
        {"hid": str(other_household_id)},
    )

    assert await repo.get("BAG-SPEC039-RLS") is None


# ---------------------------------------------------------------------------
# T-INV-JOIN-01..04 — LEFT OUTER JOIN CatalogBean tests
# ---------------------------------------------------------------------------


async def test_inv_join_01_list_all_returns_catalog_sheets_id_when_joined_via_uuid_fk(
    db_session: AsyncSession,
    test_household_id,
) -> None:
    """T-INV-JOIN-01: list_all() resolves Catalog_ID via UUID FK JOIN."""
    catalog = CatalogBean(
        household_id=test_household_id,
        roaster="T",
        bean_name="T",
        sheets_id="C-JOIN-01",
    )
    db_session.add(catalog)
    await db_session.flush()

    bag = InventoryBag(
        household_id=test_household_id,
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
    test_household_id,
) -> None:
    """T-INV-JOIN-02: list() returns legacy sheets_catalog_id when catalog_id FK is NULL."""
    bag = InventoryBag(
        household_id=test_household_id,
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
    test_household_id,
) -> None:
    """T-INV-JOIN-03: get() resolves Catalog_ID via UUID FK JOIN."""
    catalog = CatalogBean(
        household_id=test_household_id,
        roaster="T",
        bean_name="T",
        sheets_id="C-JOIN-03",
    )
    db_session.add(catalog)
    await db_session.flush()

    bag = InventoryBag(
        household_id=test_household_id,
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
    test_household_id,
) -> None:
    """T-INV-JOIN-04: list_all() returns empty Catalog_ID when no FK and no sheets column."""
    bag = InventoryBag(
        household_id=test_household_id,
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


async def _create_inventory_household(db_session: AsyncSession, name: str) -> uuid.UUID:
    user_id = uuid.uuid4()
    household_id = uuid.uuid4()
    await db_session.execute(
        sa.text(
            """
            INSERT INTO users (id, username, password_hash, display_name)
            VALUES (:uid, :username, 'fixture-only', :display_name)
            """
        ),
        {"uid": user_id, "username": f"inventory-{user_id.hex}", "display_name": name},
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


async def test_inventory_reads_and_catalog_hydration_are_household_scoped(
    db_session: AsyncSession, test_household_id: uuid.UUID
) -> None:
    other_household_id = await _create_inventory_household(db_session, "Inventory Other")
    visible_catalog = CatalogBean(
        household_id=test_household_id,
        roaster="Visible",
        bean_name="Visible",
        sheets_id="CAT-VISIBLE",
    )
    db_session.add(visible_catalog)
    await db_session.flush()
    await db_session.execute(
        sa.text("SELECT set_config('app.current_household_id', :hid, true)"),
        {"hid": str(other_household_id)},
    )
    other_catalog = CatalogBean(
        household_id=other_household_id,
        roaster="Hidden",
        bean_name="Hidden",
        sheets_id="CAT-HIDDEN",
    )
    db_session.add(other_catalog)
    await db_session.flush()
    db_session.add(
        InventoryBag(
            household_id=other_household_id,
            sheets_id="BAG-SCOPE-B",
            beans="Hidden",
            status="Active",
        )
    )
    await db_session.flush()
    await db_session.execute(
        sa.text("SELECT set_config('app.current_household_id', :hid, true)"),
        {"hid": str(test_household_id)},
    )
    db_session.add_all(
        [
            InventoryBag(
                household_id=test_household_id,
                sheets_id="BAG-SCOPE-A",
                catalog_id=visible_catalog.id,
                sheets_catalog_id=None,
                beans="Visible",
                status="Active",
            ),
            InventoryBag(
                household_id=test_household_id,
                sheets_id="BAG-CROSS-CATALOG",
                catalog_id=other_catalog.id,
                sheets_catalog_id="CAT-LEGACY-A",
                beans="Cross",
                status="Active",
            ),
        ]
    )
    await db_session.flush()

    repo = SqlInventoryRepo(db=db_session)
    rows = await repo.list()
    by_id = {row["Bag_ID"]: row for row in rows}
    assert set(by_id) == {"BAG-SCOPE-A", "BAG-CROSS-CATALOG"}
    assert by_id["BAG-SCOPE-A"]["Catalog_ID"] == "CAT-VISIBLE"
    assert by_id["BAG-CROSS-CATALOG"]["Catalog_ID"] == "CAT-LEGACY-A"
    assert await repo.get("BAG-SCOPE-B") is None


async def test_inventory_reads_without_household_context_fail_closed(
    db_session: AsyncSession,
) -> None:
    repo = SqlInventoryRepo(db=db_session)
    await repo.upsert({"Bag_ID": "BAG-NO-CONTEXT", "Beans": "B", "Status": "Active"})
    await db_session.execute(sa.text("SELECT set_config('app.current_household_id', '', true)"))

    assert await repo.list() == []
    assert await repo.list_all() == []
    assert await repo.get("BAG-NO-CONTEXT") is None
