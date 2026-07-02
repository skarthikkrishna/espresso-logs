"""SQL-backed API tests for cross-household read isolation."""

from __future__ import annotations

from collections.abc import AsyncGenerator
from dataclasses import dataclass
import os
import uuid

import pytest
import sqlalchemy as sa
from fastapi import Depends
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.deps import (
    current_household_membership,
    get_sheets_client,
    resolve_guest_or_member,
)
from app.main import app
from app.models.base import get_db
from app.models.household import HouseholdMember
from app.repos.sql.brew_log import SqlBrewLogRepo
from app.repos.sql.catalog import SqlCatalogRepo
from app.repos.sql.hardware import SqlHardwareRepo
from app.repos.sql.inventory import SqlInventoryRepo
from app.repos.sql.maintenance import SqlMaintenanceRepo

pytestmark = pytest.mark.asyncio(loop_scope="module")

_SQL_SCHEMA_READY = False
_SQL_ENGINE = None


@dataclass(frozen=True)
class _SeededHousehold:
    household_id: uuid.UUID
    user_id: uuid.UUID
    catalog_id: str
    exact_bag_id: str
    same_roaster_bag_id: str
    same_roast_bag_id: str
    hardware_id: str
    grinder_id: str
    basket_id: str
    maintenance_id: str
    shot_id: str
    default_machine_id: str
    default_grinder_id: str
    default_basket_id: str
    default_dose: str
    default_yield: str
    default_grind: str


def _require_sql_backend(monkeypatch: pytest.MonkeyPatch) -> None:
    if not os.environ.get("DATABASE_URL"):
        pytest.fail("DATABASE_URL not set — SQL-backed household isolation tests must fail closed")
    global _SQL_SCHEMA_READY
    if not _SQL_SCHEMA_READY:
        from tests.conftest import _run_alembic_upgrade_head

        _run_alembic_upgrade_head()
        _SQL_SCHEMA_READY = True
    from app.config import settings

    monkeypatch.setattr(settings, "use_postgres", True)


def _sessionmaker() -> async_sessionmaker[AsyncSession]:
    global _SQL_ENGINE
    if _SQL_ENGINE is None:
        _SQL_ENGINE = create_async_engine(os.environ["DATABASE_URL"], echo=False)
    return async_sessionmaker(_SQL_ENGINE, expire_on_commit=False)


def _install_sql_app_overrides(active: dict[str, uuid.UUID]) -> None:
    from tests.doubles import FakeSheetsClient

    session_factory = _sessionmaker()
    app.dependency_overrides[get_sheets_client] = lambda: FakeSheetsClient()

    async def _sql_db() -> AsyncGenerator[AsyncSession, None]:
        async with session_factory() as session:
            yield session

    async def _membership(db: AsyncSession = Depends(get_db)) -> HouseholdMember:
        await db.execute(
            sa.text("SELECT set_config('app.current_household_id', :hid, true)"),
            {"hid": str(active["household_id"])},
        )
        member = HouseholdMember(
            household_id=active["household_id"],
            user_id=active["user_id"],
            role="admin",
        )
        member.id = uuid.uuid4()
        return member

    app.dependency_overrides[get_db] = _sql_db
    app.dependency_overrides[current_household_membership] = _membership
    app.dependency_overrides[resolve_guest_or_member] = _membership


def _clear_sql_app_overrides() -> None:
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(current_household_membership, None)
    app.dependency_overrides.pop(resolve_guest_or_member, None)
    app.dependency_overrides.pop(get_sheets_client, None)


async def _seed_household(label: str, suffix: str) -> _SeededHousehold:
    household_id = uuid.uuid4()
    user_id = uuid.uuid4()
    catalog_uuid = uuid.uuid4()
    companion_catalog_uuid = uuid.uuid4()
    roast_catalog_uuid = uuid.uuid4()
    exact_bag_uuid = uuid.uuid4()
    same_roaster_bag_uuid = uuid.uuid4()
    same_roast_bag_uuid = uuid.uuid4()
    machine_uuid = uuid.uuid4()
    grinder_uuid = uuid.uuid4()
    basket_uuid = uuid.uuid4()
    maintenance_uuid = uuid.uuid4()

    catalog_id = f"CAT-{label}001-{suffix}"
    exact_bag_id = f"BAG-{label}001-{suffix}"
    same_roaster_bag_id = f"BAG-{label}ROASTER-{suffix}"
    same_roast_bag_id = f"BAG-{label}ROAST-{suffix}"
    hardware_id = f"HW-{label}MACHINE-{suffix}"
    grinder_id = f"HW-{label}GRINDER-{suffix}"
    basket_id = f"HW-{label}BASKET-{suffix}"
    maintenance_id = f"MAINT-{label}001-{suffix}"
    shot_id = f"SHOT-{label}001-{suffix}"
    default_dose = "18.1" if label == "A" else "21.9"
    default_yield = "40.2" if label == "A" else "55.5"
    default_grind = "6.1" if label == "A" else "9.9"

    session_factory = _sessionmaker()
    async with session_factory() as session:
        await session.execute(
            sa.text(
                """
                INSERT INTO users (id, username, password_hash, display_name)
                VALUES (:uid, :username, 'fixture-only', :display_name)
                ON CONFLICT (id) DO UPDATE
                SET display_name = EXCLUDED.display_name
                """
            ),
            {
                "uid": user_id,
                "username": f"spec042-sql-{label}-{suffix}",
                "display_name": f"Spec042 SQL {label}",
            },
        )
        await session.execute(
            sa.text(
                """
                INSERT INTO households (id, name, created_by)
                VALUES (:hid, :name, :uid)
                ON CONFLICT (id) DO NOTHING
                """
            ),
            {"hid": household_id, "name": f"Spec042 Household {label}", "uid": user_id},
        )
        await session.execute(
            sa.text(
                """
                INSERT INTO household_members (household_id, user_id, role)
                VALUES (:hid, :uid, 'admin')
                ON CONFLICT (household_id, user_id) DO UPDATE
                SET role = EXCLUDED.role
                """
            ),
            {"hid": household_id, "uid": user_id},
        )
        await session.execute(
            sa.text("UPDATE users SET active_household_id = :hid WHERE id = :uid"),
            {"hid": household_id, "uid": user_id},
        )
        await session.execute(
            sa.text("SELECT set_config('app.current_household_id', :hid, true)"),
            {"hid": str(household_id)},
        )
        await session.execute(
            sa.text(
                """
                INSERT INTO catalog
                    (id, household_id, sheets_id, roaster, bean_name, roast_level, notes)
                VALUES
                    (:cid, :hid, :sid, :roaster, :bean, 'Medium', :sid),
                    (:ccid, :hid, :companion_sid, :roaster, 'Same Roaster Target', 'Light', :companion_sid),
                    (:rcid, :hid, :roast_sid, :other_roaster, 'Same Roast Target', 'Medium', :roast_sid)
                """
            ),
            {
                "cid": catalog_uuid,
                "ccid": companion_catalog_uuid,
                "rcid": roast_catalog_uuid,
                "hid": household_id,
                "sid": catalog_id,
                "companion_sid": f"CAT-{label}ROASTER-{suffix}",
                "roast_sid": f"CAT-{label}ROAST-{suffix}",
                "roaster": "Spec042 Shared Roaster",
                "other_roaster": f"Spec042 Other Roaster {label}",
                "bean": f"Visible Bean {label}",
            },
        )
        await session.execute(
            sa.text(
                """
                INSERT INTO inventory_bags
                    (id, household_id, catalog_id, sheets_id, sheets_catalog_id, beans,
                     display_name, roast_level, status, storage_method, roast_date)
                VALUES
                    (:bid, :hid, :cid, :bag_id, :catalog_id, :beans, :beans, 'Medium',
                     'Active', 'Airscape', DATE '2026-01-01'),
                    (:roaster_bid, :hid, :ccid, :roaster_bag_id, :companion_catalog_id,
                     :roaster_beans, :roaster_beans, 'Light', 'Active', 'Airscape',
                     DATE '2026-01-02'),
                    (:roast_bid, :hid, :rcid, :roast_bag_id, :roast_catalog_id,
                     :roast_beans, :roast_beans, 'Medium', 'Active', 'Airscape',
                     DATE '2026-01-03')
                """
            ),
            {
                "bid": exact_bag_uuid,
                "roaster_bid": same_roaster_bag_uuid,
                "roast_bid": same_roast_bag_uuid,
                "hid": household_id,
                "cid": catalog_uuid,
                "ccid": companion_catalog_uuid,
                "rcid": roast_catalog_uuid,
                "bag_id": exact_bag_id,
                "roaster_bag_id": same_roaster_bag_id,
                "roast_bag_id": same_roast_bag_id,
                "catalog_id": catalog_id,
                "companion_catalog_id": f"CAT-{label}ROASTER-{suffix}",
                "roast_catalog_id": f"CAT-{label}ROAST-{suffix}",
                "beans": f"Beans {label}",
                "roaster_beans": f"Roaster Target Beans {label}",
                "roast_beans": f"Roast Target Beans {label}",
            },
        )
        await session.execute(
            sa.text(
                """
                INSERT INTO hardware
                    (id, household_id, sheets_id, name, category, notes)
                VALUES
                    (:machine_uuid, :hid, :machine_id, :machine_name, 'Machine', :machine_id),
                    (:grinder_uuid, :hid, :grinder_id, :grinder_name, 'Grinder', :grinder_id),
                    (:basket_uuid, :hid, :basket_id, :basket_name, 'Basket', :basket_id)
                """
            ),
            {
                "machine_uuid": machine_uuid,
                "grinder_uuid": grinder_uuid,
                "basket_uuid": basket_uuid,
                "hid": household_id,
                "machine_id": hardware_id,
                "grinder_id": grinder_id,
                "basket_id": basket_id,
                "machine_name": f"Machine {label}",
                "grinder_name": f"Grinder {label}",
                "basket_name": f"Basket {label}",
            },
        )
        await session.execute(
            sa.text(
                """
                INSERT INTO maintenance_log
                    (id, household_id, hardware_id, sheets_id, sheets_hardware_id,
                     action, performed_at, notes)
                VALUES
                    (:mid, :hid, :machine_uuid, :maintenance_id, :machine_id,
                     'Backflush', TIMESTAMPTZ '2026-01-04 00:00:00+00', :maintenance_id)
                """
            ),
            {
                "mid": maintenance_uuid,
                "hid": household_id,
                "machine_uuid": machine_uuid,
                "maintenance_id": maintenance_id,
                "machine_id": hardware_id,
            },
        )
        await session.execute(
            sa.text(
                """
                INSERT INTO brew_log
                    (household_id, sheets_id, bag_id, machine_id, grinder_id, basket_id,
                     dose_g, yield_g, time_sec, grind_setting, shot_eligibility,
                     taste_summary, ai_feedback, storage_method, brewed_at)
                VALUES
                    (:hid, :shot_id, :bag_id, :machine_id, :grinder_id, :basket_id,
                     :dose, :yield_out, 29, :grind, 'Good', :taste, :feedback,
                     'Airscape', TIMESTAMPTZ '2026-01-05 00:00:00+00')
                """
            ),
            {
                "hid": household_id,
                "shot_id": shot_id,
                "bag_id": exact_bag_id,
                "machine_id": hardware_id,
                "grinder_id": grinder_id,
                "basket_id": basket_id,
                "dose": float(default_dose),
                "yield_out": float(default_yield),
                "grind": float(default_grind),
                "taste": f"Taste {label}",
                "feedback": f"Feedback {label}",
            },
        )
        await session.commit()

    return _SeededHousehold(
        household_id=household_id,
        user_id=user_id,
        catalog_id=catalog_id,
        exact_bag_id=exact_bag_id,
        same_roaster_bag_id=same_roaster_bag_id,
        same_roast_bag_id=same_roast_bag_id,
        hardware_id=hardware_id,
        grinder_id=grinder_id,
        basket_id=basket_id,
        maintenance_id=maintenance_id,
        shot_id=shot_id,
        default_machine_id=hardware_id,
        default_grinder_id=grinder_id,
        default_basket_id=basket_id,
        default_dose=default_dose,
        default_yield=default_yield,
        default_grind=default_grind,
    )


async def _seed_fresh_household(suffix: str) -> _SeededHousehold:
    household_id = uuid.uuid4()
    user_id = uuid.uuid4()
    session_factory = _sessionmaker()
    async with session_factory() as session:
        await session.execute(
            sa.text(
                """
                INSERT INTO users (id, username, password_hash, display_name)
                VALUES (:uid, :username, 'fixture-only', 'Spec042 Fresh')
                """
            ),
            {"uid": user_id, "username": f"spec042-fresh-{suffix}"},
        )
        await session.execute(
            sa.text("INSERT INTO households (id, name, created_by) VALUES (:hid, 'Fresh', :uid)"),
            {"hid": household_id, "uid": user_id},
        )
        await session.execute(
            sa.text(
                """
                INSERT INTO household_members (household_id, user_id, role)
                VALUES (:hid, :uid, 'admin')
                """
            ),
            {"hid": household_id, "uid": user_id},
        )
        await session.execute(
            sa.text("UPDATE users SET active_household_id = :hid WHERE id = :uid"),
            {"hid": household_id, "uid": user_id},
        )
        await session.commit()
    return _SeededHousehold(
        household_id=household_id,
        user_id=user_id,
        catalog_id="",
        exact_bag_id=f"FRESH-BAG-{suffix}",
        same_roaster_bag_id="",
        same_roast_bag_id="",
        hardware_id="",
        grinder_id="",
        basket_id="",
        maintenance_id="",
        shot_id="",
        default_machine_id="",
        default_grinder_id="",
        default_basket_id="",
        default_dose="",
        default_yield="",
        default_grind="",
    )


async def _create_overlap_household(label: str, suffix: str) -> tuple[uuid.UUID, uuid.UUID]:
    household_id = uuid.uuid4()
    user_id = uuid.uuid4()
    session_factory = _sessionmaker()
    async with session_factory() as session:
        await session.execute(
            sa.text(
                """
                INSERT INTO users (id, username, password_hash, display_name)
                VALUES (:uid, :username, 'fixture-only', :display_name)
                """
            ),
            {
                "uid": user_id,
                "username": f"spec042-overlap-{label}-{suffix}",
                "display_name": f"Spec042 Overlap {label}",
            },
        )
        await session.execute(
            sa.text("INSERT INTO households (id, name, created_by) VALUES (:hid, :name, :uid)"),
            {"hid": household_id, "name": f"Spec042 Overlap {label}", "uid": user_id},
        )
        await session.execute(
            sa.text(
                """
                INSERT INTO household_members (household_id, user_id, role)
                VALUES (:hid, :uid, 'admin')
                """
            ),
            {"hid": household_id, "uid": user_id},
        )
        await session.execute(
            sa.text("UPDATE users SET active_household_id = :hid WHERE id = :uid"),
            {"hid": household_id, "uid": user_id},
        )
        await session.commit()
    return household_id, user_id


async def _set_household_context(session: AsyncSession, household_id: uuid.UUID) -> None:
    await session.execute(
        sa.text("SELECT set_config('app.current_household_id', :hid, true)"),
        {"hid": str(household_id)},
    )


async def _cleanup_overlap_fixtures() -> None:
    session_factory = _sessionmaker()
    async with session_factory() as session:
        result = await session.execute(
            sa.text(
                """
                SELECT DISTINCT h.id
                FROM households h
                JOIN users u ON u.id = h.created_by
                WHERE u.username LIKE 'spec042-overlap-%'
                """
            )
        )
        household_ids = [row[0] for row in result.all()]
        if not household_ids:
            return

        await session.execute(
            sa.text(
                "UPDATE users SET active_household_id = NULL WHERE active_household_id = ANY(:hids)"
            ),
            {"hids": household_ids},
        )
        for table in (
            "brew_log",
            "maintenance_log",
            "inventory_bags",
            "hardware",
            "catalog",
            "household_members",
        ):
            await session.execute(
                sa.text(f"DELETE FROM {table} WHERE household_id = ANY(:hids)"),
                {"hids": household_ids},
            )
        await session.execute(
            sa.text("DELETE FROM households WHERE id = ANY(:hids)"), {"hids": household_ids}
        )
        await session.execute(sa.text("DELETE FROM users WHERE username LIKE 'spec042-overlap-%'"))
        await session.commit()


async def _seed_overlapping_sql_rows(household_id: uuid.UUID, label: str) -> None:
    session_factory = _sessionmaker()
    async with session_factory() as session:
        catalog_repo = SqlCatalogRepo(db=session)
        inventory_repo = SqlInventoryRepo(db=session)
        hardware_repo = SqlHardwareRepo(db=session)
        maintenance_repo = SqlMaintenanceRepo(db=session)
        brew_log_repo = SqlBrewLogRepo(db=session)

        await _set_household_context(session, household_id)
        await catalog_repo.upsert(
            {
                "Catalog_ID": "CAT-001",
                "Roaster": f"Overlap Roaster {label}",
                "Bean_Name": f"Overlap Bean {label}",
                "Roast_Level": "Light" if label == "A" else "Dark",
            }
        )
        await _set_household_context(session, household_id)
        await inventory_repo.upsert(
            {
                "Bag_ID": "BAG-001",
                "Catalog_ID": "CAT-001",
                "Beans": f"Overlap Beans {label}",
                "Display_Name": f"Overlap Bag {label}",
                "RoastDate": "2026-06-01" if label == "A" else "2026-06-02",
                "Status": "Active",
            }
        )
        await _set_household_context(session, household_id)
        await hardware_repo.upsert(
            {
                "Hardware_ID": "HW-001",
                "Name": f"Overlap Machine {label}",
                "Category": "Machine",
            }
        )
        await _set_household_context(session, household_id)
        await maintenance_repo.upsert(
            {
                "Maintenance_ID": "MAINT-001",
                "Hardware_ID": "HW-001",
                "Date": "2026-06-03T00:00:00+00:00",
                "Action_Type": f"Backflush {label}",
                "Notes": f"Overlap Maintenance {label}",
            }
        )
        await _set_household_context(session, household_id)
        await brew_log_repo.add(
            {
                "Shot_ID": "SHOT-001",
                "Date": "2026-06-04T00:00:00+00:00",
                "Bag_ID": "BAG-001",
                "Machine_ID": "HW-001",
                "Dose_In_g": "18.0" if label == "A" else "21.0",
                "Yield_Out_g": "40.0" if label == "A" else "50.0",
                "Taste_Summary": f"Overlap Taste {label}",
                "AI_Feedback": f"Overlap Feedback {label}",
            }
        )


async def _assert_overlapping_repo_view(household_id: uuid.UUID, label: str) -> None:
    other_label = "B" if label == "A" else "A"
    session_factory = _sessionmaker()
    async with session_factory() as session:
        await _set_household_context(session, household_id)
        catalog_repo = SqlCatalogRepo(db=session)
        inventory_repo = SqlInventoryRepo(db=session)
        hardware_repo = SqlHardwareRepo(db=session)
        maintenance_repo = SqlMaintenanceRepo(db=session)
        brew_log_repo = SqlBrewLogRepo(db=session)

        catalog = await catalog_repo.get("CAT-001")
        assert catalog is not None
        assert catalog["Roaster"] == f"Overlap Roaster {label}"
        assert catalog["Bean_Name"] == f"Overlap Bean {label}"
        assert f"Overlap Roaster {other_label}" not in str(await catalog_repo.list())

        inventory = await inventory_repo.get("BAG-001")
        assert inventory is not None
        assert inventory["Beans"] == f"Overlap Beans {label}"
        assert f"Overlap Beans {other_label}" not in str(await inventory_repo.list_all())

        hardware = await hardware_repo.get("HW-001")
        assert hardware is not None
        assert hardware["Name"] == f"Overlap Machine {label}"
        assert f"Overlap Machine {other_label}" not in str(await hardware_repo.list())

        maintenance = await maintenance_repo.get("MAINT-001")
        assert maintenance is not None
        assert maintenance["Action_Type"] == f"Backflush {label}"
        assert f"Overlap Maintenance {other_label}" not in str(await maintenance_repo.list())

        brew = await brew_log_repo.get("SHOT-001")
        assert brew is not None
        assert brew["Taste_Summary"] == f"Overlap Taste {label}"
        assert f"Overlap Taste {other_label}" not in str(await brew_log_repo.list())


def _ids(rows: list[dict[str, object]], key: str) -> set[str]:
    return {str(row[key]) for row in rows}


async def test_sql_api_cross_household_direct_read_paths(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _require_sql_backend(monkeypatch)
    suffix = uuid.uuid4().hex[:8]
    household_a = await _seed_household("A", suffix)
    household_b = await _seed_household("B", suffix)
    active = {"household_id": household_a.household_id, "user_id": household_a.user_id}
    _install_sql_app_overrides(active)

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            catalog_list = await client.get("/api/catalog")
            catalog_b = await client.get(f"/api/catalog/{household_b.catalog_id}")
            catalog_a_detail = await client.get(f"/api/catalog/{household_a.catalog_id}")
            inventory_list = await client.get("/api/inventory?status=all")
            inventory_b = await client.get(f"/api/inventory/{household_b.exact_bag_id}")
            hardware_list = await client.get("/api/hardware")
            hardware_b = await client.get(f"/api/hardware/{household_b.hardware_id}")
            hardware_b_update = await client.put(
                f"/api/hardware/{household_b.hardware_id}",
                json={"name": "Cross-household update must not pre-read"},
            )
            maintenance_list = await client.get("/api/maintenance")
            brew_list = await client.get("/api/brew-log")
            brew_b = await client.get(f"/api/brew-log/{household_b.shot_id}")
            brew_b_feedback = await client.get(f"/api/brew-log/{household_b.shot_id}/feedback")
            brew_b_patch = await client.patch(
                f"/api/brew-log/{household_b.shot_id}",
                json={"taste_summary": "Cross-household patch must not pre-read"},
            )
            brew_b_feedback_generate = await client.post(
                f"/api/brew-log/{household_b.shot_id}/feedback"
            )
    finally:
        _clear_sql_app_overrides()

    assert catalog_list.status_code == 200
    assert household_a.catalog_id in _ids(catalog_list.json(), "catalog_id")
    assert household_b.catalog_id not in _ids(catalog_list.json(), "catalog_id")
    assert catalog_b.status_code == 404
    assert catalog_a_detail.status_code == 200
    assert household_b.exact_bag_id not in _ids(catalog_a_detail.json()["bags"], "bag_id")
    assert household_b.shot_id not in _ids(catalog_a_detail.json()["recent_shots"], "shot_id")

    assert inventory_list.status_code == 200
    assert household_a.exact_bag_id in _ids(inventory_list.json(), "bag_id")
    assert household_b.exact_bag_id not in _ids(inventory_list.json(), "bag_id")
    assert inventory_b.status_code == 404

    assert hardware_list.status_code == 200
    assert household_a.hardware_id in _ids(hardware_list.json(), "hardware_id")
    assert household_b.hardware_id not in _ids(hardware_list.json(), "hardware_id")
    assert hardware_b.status_code == 404
    assert hardware_b_update.status_code == 404

    assert maintenance_list.status_code == 200
    assert household_a.maintenance_id in _ids(maintenance_list.json(), "maintenance_id")
    assert household_b.maintenance_id not in _ids(maintenance_list.json(), "maintenance_id")

    assert brew_list.status_code == 200
    assert household_a.shot_id in _ids(brew_list.json()["items"], "shot_id")
    assert household_b.shot_id not in _ids(brew_list.json()["items"], "shot_id")
    assert brew_b.status_code == 404
    assert brew_b_feedback.status_code == 404
    assert brew_b_patch.status_code == 404
    assert brew_b_feedback_generate.status_code == 404


async def test_sql_dashboard_and_defaults_ignore_other_households(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _require_sql_backend(monkeypatch)
    suffix = uuid.uuid4().hex[:8]
    household_a = await _seed_household("A", suffix)
    household_b = await _seed_household("B", suffix)
    active = {"household_id": household_a.household_id, "user_id": household_a.user_id}
    _install_sql_app_overrides(active)

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            dashboard = await client.get("/api/dashboard")
            exact_defaults = await client.get(f"/api/defaults/{household_a.exact_bag_id}")
            basket_defaults = await client.get(
                f"/api/defaults/{household_a.exact_bag_id}?basket_id={household_a.basket_id}"
            )
            same_roaster_defaults = await client.get(
                f"/api/defaults/{household_a.same_roaster_bag_id}"
            )
            same_roast_defaults = await client.get(f"/api/defaults/{household_a.same_roast_bag_id}")
            other_household_defaults = await client.get(f"/api/defaults/{household_b.exact_bag_id}")
    finally:
        _clear_sql_app_overrides()

    assert dashboard.status_code == 200
    dashboard_ids = _ids(dashboard.json(), "bag_id")
    assert household_a.exact_bag_id in dashboard_ids
    assert household_b.exact_bag_id not in dashboard_ids
    active_summary = next(
        row for row in dashboard.json() if row["bag_id"] == household_a.exact_bag_id
    )
    assert active_summary["last_shot"]["dose_in_g"] == float(household_a.default_dose)
    assert str(household_b.default_dose) not in str(dashboard.json())

    for response in (exact_defaults, basket_defaults, same_roaster_defaults, same_roast_defaults):
        assert response.status_code == 200
        data = response.json()
        assert data["machine_id"] == household_a.default_machine_id
        assert data["grinder_id"] == household_a.default_grinder_id
        assert data["basket_id"] == household_a.default_basket_id
        assert data["dose_in_g"] == household_a.default_dose
        assert data["yield_out_g"] == household_a.default_yield
        assert data["grind_setting"] == household_a.default_grind

    assert other_household_defaults.status_code == 200
    assert set(other_household_defaults.json().values()) == {None}


async def test_sql_fresh_household_receives_empty_read_models(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _require_sql_backend(monkeypatch)
    suffix = uuid.uuid4().hex[:8]
    await _seed_household("B", suffix)
    fresh = await _seed_fresh_household(suffix)
    active = {"household_id": fresh.household_id, "user_id": fresh.user_id}
    _install_sql_app_overrides(active)

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            catalog = await client.get("/api/catalog")
            inventory = await client.get("/api/inventory?status=all")
            hardware = await client.get("/api/hardware")
            maintenance = await client.get("/api/maintenance")
            brew_log = await client.get("/api/brew-log")
            dashboard = await client.get("/api/dashboard")
            defaults = await client.get(f"/api/defaults/{fresh.exact_bag_id}")
    finally:
        _clear_sql_app_overrides()

    assert catalog.status_code == 200
    assert catalog.json() == []
    assert inventory.status_code == 200
    assert inventory.json() == []
    assert hardware.status_code == 200
    assert hardware.json() == []
    assert maintenance.status_code == 200
    assert maintenance.json() == []
    assert brew_log.status_code == 200
    assert brew_log.json()["items"] == []
    assert brew_log.json()["total_count"] == 0
    assert dashboard.status_code == 200
    assert dashboard.json() == []
    assert defaults.status_code == 200
    assert set(defaults.json().values()) == {None}


async def test_sql_overlapping_sheets_ids_are_household_scoped(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _require_sql_backend(monkeypatch)
    suffix = uuid.uuid4().hex[:8]
    await _cleanup_overlap_fixtures()

    try:
        household_a_id, user_a_id = await _create_overlap_household("A", suffix)
        household_b_id, _ = await _create_overlap_household("B", suffix)

        await _seed_overlapping_sql_rows(household_a_id, "A")
        await _seed_overlapping_sql_rows(household_b_id, "B")

        await _assert_overlapping_repo_view(household_a_id, "A")
        await _assert_overlapping_repo_view(household_b_id, "B")

        active = {"household_id": household_a_id, "user_id": user_a_id}
        _install_sql_app_overrides(active)
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                catalog_detail = await client.get("/api/catalog/CAT-001")
        finally:
            _clear_sql_app_overrides()
    finally:
        await _cleanup_overlap_fixtures()

    assert catalog_detail.status_code == 200
    payload = catalog_detail.json()
    assert payload["item"]["catalog_id"] == "CAT-001"
    assert payload["item"]["roaster"] == "Overlap Roaster A"
    assert payload["item"]["bean_name"] == "Overlap Bean A"
    assert "Overlap Roaster B" not in str(payload)
    assert "Overlap Beans B" not in str(payload)
