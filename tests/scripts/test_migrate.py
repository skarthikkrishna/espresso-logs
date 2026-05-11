"""Tests for migrate_sheets_to_postgres.py mappers and migration logic."""

from __future__ import annotations

import datetime
import os
import subprocess
import sys
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from scripts._mapping import (
    from_sheets_dict_brew_log,
    from_sheets_dict_catalog,
    from_sheets_dict_hardware,
    from_sheets_dict_inventory,
    from_sheets_dict_maintenance,
)

HH = "00000000-0000-0000-0000-000000000001"


# ---------------------------------------------------------------------------
# TC-1a: Catalog happy path
# ---------------------------------------------------------------------------


def test_catalog_from_sheets_dict_happy_path() -> None:
    row: dict[str, Any] = {
        "Catalog_ID": "CAT-001",
        "Roaster": "Test Roaster",
        "Bean_Name": "Ethiopian Yirgacheffe",
        "Roast_Level": "Light",
        "Product_URL": "https://example.com/cat001",
        "Local_Image_Path": "",
        "Origin": "Ethiopia",
        "Process": "Washed",
        "Notes": "Bright and floral",
    }
    result = from_sheets_dict_catalog(row, household_id=HH)
    assert result["sheets_id"] == "CAT-001"
    assert result["household_id"] == HH
    assert result["roaster"] == "Test Roaster"
    assert result["bean_name"] == "Ethiopian Yirgacheffe"
    assert result["roast_level"] == "Light"
    assert result["product_url"] == "https://example.com/cat001"
    assert result["local_image_path"] is None
    assert result["origin"] == "Ethiopia"
    assert result["process"] == "Washed"
    assert result["notes"] == "Bright and floral"


# ---------------------------------------------------------------------------
# TC-1b: Inventory happy path
# ---------------------------------------------------------------------------


def test_inventory_from_sheets_dict_happy_path() -> None:
    row: dict[str, Any] = {
        "Bag_ID": "BAG-001",
        "Beans": "Ethiopian Yirgacheffe",
        "RoastDate": "2024-01-15",
        "RoastLevel": "Light",
        "Display_Name": "Test Bag",
        "Catalog_ID": "CAT-001",
        "Status": "Active",
        "Storage_Method": "Freezer",
    }
    catalog_lookup = {"CAT-001": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}
    result = from_sheets_dict_inventory(row, household_id=HH, catalog_id_to_pg_uuid=catalog_lookup)
    assert result["sheets_id"] == "BAG-001"
    assert result["household_id"] == HH
    assert result["beans"] == "Ethiopian Yirgacheffe"
    assert result["roast_date"] == datetime.date(2024, 1, 15)
    assert result["roast_level"] == "Light"
    assert result["display_name"] == "Test Bag"
    assert result["catalog_id"] == "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    assert result["status"] == "Active"
    assert result["storage_method"] == "Freezer"


# ---------------------------------------------------------------------------
# TC-1c: Hardware happy path
# ---------------------------------------------------------------------------


def test_hardware_from_sheets_dict_happy_path() -> None:
    row: dict[str, Any] = {
        "Hardware_ID": "HW-001",
        "Category": "Machine",
        "Name": "La Marzocca Linea Mini",
        "Product_URL": "https://example.com/hw001",
        "Local_Image_Path": "",
    }
    result = from_sheets_dict_hardware(row, household_id=HH)
    assert result["sheets_id"] == "HW-001"
    assert result["household_id"] == HH
    assert result["category"] == "Machine"
    assert result["name"] == "La Marzocca Linea Mini"
    assert result["product_url"] == "https://example.com/hw001"
    assert result["local_image_path"] is None


# ---------------------------------------------------------------------------
# TC-1d: Maintenance happy path
# ---------------------------------------------------------------------------


def test_maintenance_from_sheets_dict_happy_path() -> None:
    row: dict[str, Any] = {
        "Maintenance_ID": "MAINT-001",
        "Hardware_ID": "HW-001",
        "Date": "2024-01-20",
        "Action_Type": "Backflush",
        "Notes": "Routine maintenance",
    }
    hw_lookup = {"HW-001": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"}
    result = from_sheets_dict_maintenance(row, household_id=HH, hardware_id_to_pg_uuid=hw_lookup)
    assert result["sheets_id"] == "MAINT-001"
    assert result["household_id"] == HH
    assert result["hardware_id"] == "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
    assert result["action"] == "Backflush"
    assert result["notes"] == "Routine maintenance"
    assert result["performed_at"].tzinfo is not None


# ---------------------------------------------------------------------------
# TC-1e: Brew_Log happy path
# ---------------------------------------------------------------------------


def test_brew_log_from_sheets_dict_happy_path() -> None:
    row: dict[str, Any] = {
        "Shot_ID": "SHOT-001",
        "Date": "2024-01-21",
        "Bag_ID": "BAG-001",
        "Machine_ID": "HW-001",
        "Grinder_ID": "HW-002",
        "Basket_ID": "HW-003",
        "Dose_In_g": "18.5",
        "Yield_Out_g": "36.0",
        "Time_Sec": "28",
        "Grind_Setting": "7.5",
        "Shot_Eligibility": "Good Espresso",
        "Taste_Summary": "Balanced",
        "User_Notes": "Good shot",
        "AI_Feedback": "",
        "Storage_Method": "Freezer",
    }
    result = from_sheets_dict_brew_log(row, household_id=HH)
    assert result["sheets_id"] == "SHOT-001"
    assert result["household_id"] == HH
    assert result["bag_id"] == "BAG-001"
    assert result["machine_id"] == "HW-001"
    assert result["grinder_id"] == "HW-002"
    assert result["basket_id"] == "HW-003"
    assert result["dose_g"] == pytest.approx(18.5)
    assert result["yield_g"] == pytest.approx(36.0)
    assert result["time_sec"] == 28
    assert result["grind_setting"] == pytest.approx(7.5)
    assert result["shot_eligibility"] == "Good Espresso"
    assert result["taste_summary"] == "Balanced"
    assert result["notes"] == "Good shot"
    assert result["ai_feedback"] is None
    assert result["storage_method"] == "Freezer"
    assert result["catalog_id"] is None
    assert result["brewed_at"].tzinfo is not None


# ---------------------------------------------------------------------------
# TC-2: Invalid enum raises ValueError
# ---------------------------------------------------------------------------


def test_from_sheets_dict_invalid_enum_raises_value_error() -> None:
    row: dict[str, Any] = {
        "Catalog_ID": "CAT-999",
        "Roaster": "Roaster",
        "Bean_Name": "Bean",
        "Roast_Level": "Extra Dark",  # invalid
        "Product_URL": "",
        "Local_Image_Path": "",
        "Origin": "",
        "Process": "",
        "Notes": "",
    }
    with pytest.raises(ValueError, match="Roast_Level"):
        from_sheets_dict_catalog(row, household_id=HH)


# ---------------------------------------------------------------------------
# TC-3: Missing required field raises ValueError
# ---------------------------------------------------------------------------


def test_from_sheets_dict_missing_required_field_raises_value_error() -> None:
    row: dict[str, Any] = {
        "Catalog_ID": "",  # empty — required
        "Roaster": "Roaster",
        "Bean_Name": "Bean",
        "Roast_Level": "Light",
        "Product_URL": "",
        "Local_Image_Path": "",
        "Origin": "",
        "Process": "",
        "Notes": "",
    }
    with pytest.raises(ValueError, match="Catalog_ID"):
        from_sheets_dict_catalog(row, household_id=HH)


# ---------------------------------------------------------------------------
# TC-4: bulk_upsert idempotency (integration — skips without real postgres)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_bulk_upsert_idempotency(db_engine: Any) -> None:  # type: ignore[misc]
    from scripts._mapping import CATALOG_TABLE, bulk_upsert

    # household_id=None: catalog.household_id is nullable (migration 0003).
    # Using None avoids an FK dependency on a seeded households row — CI postgres
    # starts empty and runs DDL only, so no household is guaranteed to exist.
    rows: list[dict[str, Any]] = [
        {
            "sheets_id": "IDEM-001",
            "household_id": None,
            "roaster": "Idempotency Roaster",
            "bean_name": "Idempotency Bean",
            "roast_level": "Medium",
            "product_url": None,
            "local_image_path": None,
            "origin": None,
            "process": None,
            "notes": None,
        }
    ]

    import sqlalchemy as sa

    count1 = await bulk_upsert(db_engine, CATALOG_TABLE, rows)
    assert count1 == 1

    count2 = await bulk_upsert(db_engine, CATALOG_TABLE, rows)
    assert count2 == 1

    async with db_engine.connect() as conn:
        result = await conn.execute(
            sa.select(sa.func.count()).where(CATALOG_TABLE.c.sheets_id == "IDEM-001")
        )
        assert result.scalar() == 1


# ---------------------------------------------------------------------------
# TC-5: dry-run writes nothing
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_dry_run_writes_nothing() -> None:
    from scripts.migrate_sheets_to_postgres import main

    fake_rows: list[dict[str, Any]] = [
        {
            "Catalog_ID": "CAT-DRY",
            "Roaster": "Dry Roaster",
            "Bean_Name": "Dry Bean",
            "Roast_Level": "Light",
            "Product_URL": "",
            "Local_Image_Path": "",
            "Origin": "",
            "Process": "",
            "Notes": "",
        }
    ]
    fake_hw: list[dict[str, Any]] = []
    fake_inv: list[dict[str, Any]] = []
    fake_maint: list[dict[str, Any]] = []
    fake_brew: list[dict[str, Any]] = []

    mock_sheets = MagicMock()
    mock_sheets.get_all_records.side_effect = lambda tab: (
        fake_rows
        if tab == "Catalog"
        else (
            fake_inv
            if tab == "Inventory"
            else (
                fake_hw if tab == "Hardware" else fake_maint if tab == "Maintenance" else fake_brew
            )
        )
    )

    mock_engine = MagicMock()
    mock_conn = AsyncMock()
    mock_conn.__aenter__ = AsyncMock(return_value=mock_conn)
    mock_conn.__aexit__ = AsyncMock(return_value=False)
    mock_conn.execute = AsyncMock(return_value=MagicMock(fetchall=lambda: []))
    mock_engine.connect.return_value = mock_conn
    mock_engine.begin.return_value = mock_conn
    mock_engine.dispose = AsyncMock()

    with (
        patch("scripts.migrate_sheets_to_postgres.RealSheetsClient", return_value=mock_sheets),
        patch("scripts.migrate_sheets_to_postgres.create_async_engine", return_value=mock_engine),
        patch(
            "scripts.migrate_sheets_to_postgres.ensure_system_user",
            new_callable=AsyncMock,
            return_value=__import__("uuid").UUID(HH),
        ) as mock_ensure_user,
        patch(
            "scripts.migrate_sheets_to_postgres.ensure_default_household",
            new_callable=AsyncMock,
            return_value=__import__("uuid").UUID(HH),
        ) as mock_ensure_hh,
        patch("scripts.migrate_sheets_to_postgres.bulk_upsert", new_callable=AsyncMock) as mock_bulk,
    ):
        await main(["--dry-run"])

    mock_bulk.assert_not_called()
    mock_ensure_user.assert_not_called()
    mock_ensure_hh.assert_not_called()


# ---------------------------------------------------------------------------
# TC-6: entity filter — only Catalog processed
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_entity_filter() -> None:
    from scripts.migrate_sheets_to_postgres import main

    fake_catalog: list[dict[str, Any]] = [
        {
            "Catalog_ID": "CAT-FILTER",
            "Roaster": "Filter Roaster",
            "Bean_Name": "Filter Bean",
            "Roast_Level": "Medium",
            "Product_URL": "",
            "Local_Image_Path": "",
            "Origin": "",
            "Process": "",
            "Notes": "",
        }
    ]

    mock_sheets = MagicMock()
    mock_sheets.get_all_records.return_value = fake_catalog

    mock_engine = MagicMock()
    mock_conn = AsyncMock()
    mock_conn.__aenter__ = AsyncMock(return_value=mock_conn)
    mock_conn.__aexit__ = AsyncMock(return_value=False)
    mock_conn.execute = AsyncMock(return_value=MagicMock(fetchall=lambda: []))
    mock_engine.connect.return_value = mock_conn
    mock_engine.begin.return_value = mock_conn
    mock_engine.dispose = AsyncMock()

    calls: list[str] = []

    async def _fake_upsert(engine: Any, table: Any, rows: Any) -> int:
        calls.append(table.name)
        return len(rows)

    with (
        patch("scripts.migrate_sheets_to_postgres.RealSheetsClient", return_value=mock_sheets),
        patch("scripts.migrate_sheets_to_postgres.create_async_engine", return_value=mock_engine),
        patch(
            "scripts.migrate_sheets_to_postgres.ensure_system_user",
            new_callable=AsyncMock,
            return_value=__import__("uuid").UUID(HH),
        ),
        patch(
            "scripts.migrate_sheets_to_postgres.ensure_default_household",
            new_callable=AsyncMock,
            return_value=__import__("uuid").UUID(HH),
        ),
        patch("scripts.migrate_sheets_to_postgres.bulk_upsert", side_effect=_fake_upsert),
    ):
        await main(["--entity", "Catalog"])

    assert calls == ["catalog"]
    # Sheets get_all_records should only be called for Catalog tab (plus catalog lookup)
    tabs_called = [c.args[0] for c in mock_sheets.get_all_records.call_args_list]
    assert "Inventory" not in tabs_called
    assert "Hardware" not in tabs_called


# ---------------------------------------------------------------------------
# TC-7: Missing DATABASE_URL exits 2
# ---------------------------------------------------------------------------


def test_env_var_missing_exits_2_database_url() -> None:
    env = {k: v for k, v in os.environ.items() if k != "DATABASE_URL"}
    env["SPREADSHEET_ID"] = "dummy"
    result = subprocess.run(
        [sys.executable, "scripts/migrate_sheets_to_postgres.py"],
        env=env,
        capture_output=True,
        text=True,
        cwd=str(__import__("pathlib").Path(__file__).resolve().parent.parent.parent),
    )
    assert result.returncode == 2


# ---------------------------------------------------------------------------
# TC-8: Missing SPREADSHEET_ID exits 2
# ---------------------------------------------------------------------------


def test_env_var_missing_exits_2_spreadsheet_id() -> None:
    env = {k: v for k, v in os.environ.items() if k != "SPREADSHEET_ID"}
    env["DATABASE_URL"] = "postgresql+asyncpg://dummy/dummy"
    result = subprocess.run(
        [sys.executable, "scripts/migrate_sheets_to_postgres.py"],
        env=env,
        capture_output=True,
        text=True,
        cwd=str(__import__("pathlib").Path(__file__).resolve().parent.parent.parent),
    )
    assert result.returncode == 2
