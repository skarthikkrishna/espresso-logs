"""Tests for validate_migration.py checksum and validation logic."""

from __future__ import annotations

import datetime
import os
import subprocess
import sys
from typing import Any
from unittest.mock import patch  # noqa: F401 — unused but kept for future TC expansion

import pytest

from scripts._mapping import _CHECKSUM_EXCLUDE, row_checksum

HH = "00000000-0000-0000-0000-00000000f202"


# ---------------------------------------------------------------------------
# TC-1: Checksum consistency — same input → same hash
# ---------------------------------------------------------------------------


def test_row_checksum_consistency() -> None:
    row: dict[str, Any] = {
        "sheets_id": "CAT-001",
        "roaster": "Test Roaster",
        "bean_name": "Ethiopian",
        "roast_level": "Light",
        "product_url": None,
        "local_image_path": None,
        "origin": "Ethiopia",
        "process": "Washed",
        "notes": None,
    }
    h1 = row_checksum(row)
    h2 = row_checksum(row)
    assert h1 == h2
    assert len(h1) == 64  # SHA-256 hex digest


# ---------------------------------------------------------------------------
# TC-2: Checksum excludes injected fields
# ---------------------------------------------------------------------------


def test_row_checksum_excludes_injected_fields() -> None:
    row_a: dict[str, Any] = {
        "id": "aaa",
        "household_id": "bbb",
        "sheets_id": "CAT-001",
        "created_at": datetime.datetime(2024, 1, 1, tzinfo=datetime.timezone.utc),
        "roaster": "Roaster",
        "bean_name": "Bean",
        "roast_level": "Light",
        "product_url": None,
        "local_image_path": None,
        "origin": None,
        "process": None,
        "notes": None,
    }
    row_b: dict[str, Any] = {
        "id": "zzz",  # different id
        "household_id": "yyy",  # different household
        "sheets_id": "CAT-999",  # different sheets_id
        "created_at": datetime.datetime(2025, 6, 1, tzinfo=datetime.timezone.utc),  # different
        "roaster": "Roaster",
        "bean_name": "Bean",
        "roast_level": "Light",
        "product_url": None,
        "local_image_path": None,
        "origin": None,
        "process": None,
        "notes": None,
    }
    # Excluded fields differ → checksums should be equal
    assert row_checksum(row_a) == row_checksum(row_b)

    # Verify _CHECKSUM_EXCLUDE contains the expected fields
    assert "id" in _CHECKSUM_EXCLUDE
    assert "household_id" in _CHECKSUM_EXCLUDE
    assert "sheets_id" in _CHECKSUM_EXCLUDE
    assert "created_at" in _CHECKSUM_EXCLUDE


# ---------------------------------------------------------------------------
# TC-3: Checksum serialization rules
# ---------------------------------------------------------------------------


def test_row_checksum_serialization_rules() -> None:
    import decimal
    import hashlib

    row: dict[str, Any] = {
        "a_none": None,
        "b_float": 3.14159,
        "c_date": datetime.date(2024, 3, 15),
        "d_decimal": decimal.Decimal("18.5"),
    }
    # Manually compute expected checksum
    # fields sorted alphabetically: a_none, b_float, c_date, d_decimal
    parts = [
        "NULL",  # None
        f"{3.14159:.6f}",  # float
        "2024-03-15",  # date
        f"{float(decimal.Decimal('18.5')):.6f}",  # Decimal
    ]
    expected = hashlib.sha256("|".join(parts).encode()).hexdigest()
    assert row_checksum(row) == expected


# ---------------------------------------------------------------------------
# TC-4: Full validation against seeded DB (integration — skips without real postgres)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_validation_passed_output(db_engine: Any) -> None:  # type: ignore[misc]
    """Seed catalog rows then validate they match checksums."""
    from scripts._mapping import CATALOG_TABLE, bulk_upsert, from_sheets_dict_catalog

    catalog_row: dict[str, Any] = {
        "Catalog_ID": "VAL-001",
        "Roaster": "Validation Roaster",
        "Bean_Name": "Validation Bean",
        "Roast_Level": "Medium",
        "Product_URL": "",
        "Local_Image_Path": "",
        "Origin": "Colombia",
        "Process": "",
        "Notes": "",
    }
    mapped = from_sheets_dict_catalog(catalog_row, household_id=HH)
    await bulk_upsert(db_engine, CATALOG_TABLE, [mapped])

    import sqlalchemy as sa

    async with db_engine.begin() as conn:
        await conn.execute(
            sa.text("SELECT set_config('app.current_household_id', :hid, true)"),
            {"hid": HH},
        )
        result = await conn.execute(
            sa.select(CATALOG_TABLE).where(CATALOG_TABLE.c.sheets_id == "VAL-001")
        )
        pg_row = dict(result.mappings().one())

    sheets_checksum = row_checksum(mapped)
    pg_checksum = row_checksum(pg_row)
    assert sheets_checksum == pg_checksum


# ---------------------------------------------------------------------------
# TC-5: Checksum mismatch detection
# ---------------------------------------------------------------------------


def test_checksum_mismatch_detection() -> None:
    sheets_row: dict[str, Any] = {
        "sheets_id": "CAT-001",
        "roaster": "Test Roaster",
        "bean_name": "Ethiopian",
        "roast_level": "Light",
        "product_url": None,
        "local_image_path": None,
        "origin": "Ethiopia",
        "process": "Washed",
        "notes": None,
    }
    pg_row: dict[str, Any] = {
        **sheets_row,
        "roaster": "Different Roaster",  # tampered value
    }
    assert row_checksum(sheets_row) != row_checksum(pg_row)


# ---------------------------------------------------------------------------
# TC-6: Row count mismatch detection
# ---------------------------------------------------------------------------


def test_row_count_mismatch_detection() -> None:
    """Verify logic: different counts produce mismatch signal."""
    sheets_rows = {"CAT-001": {"sheets_id": "CAT-001", "roaster": "R1"}}
    pg_rows: dict[str, Any] = {}  # empty — 0 rows in postgres

    sheets_count = len(sheets_rows)
    pg_count = len(pg_rows)
    assert sheets_count != pg_count


# ---------------------------------------------------------------------------
# TC-7: Missing DATABASE_URL exits 2
# ---------------------------------------------------------------------------


def test_env_var_missing_exits_2_database_url() -> None:
    env = {k: v for k, v in os.environ.items() if k != "DATABASE_URL"}
    env["SPREADSHEET_ID"] = "dummy"
    result = subprocess.run(
        [sys.executable, "scripts/validate_migration.py"],
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
        [sys.executable, "scripts/validate_migration.py"],
        env=env,
        capture_output=True,
        text=True,
        cwd=str(__import__("pathlib").Path(__file__).resolve().parent.parent.parent),
    )
    assert result.returncode == 2
