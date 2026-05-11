"""Pytest configuration for scripts tests."""

from __future__ import annotations

import os
from typing import Any

import pytest

# SPREADSHEET_ID must be present for subprocess-based env-var tests that
# strip it from the environment explicitly. Do NOT set DATABASE_URL here —
# it would bypass the skip guard in tests/models/test_migrations.py.
os.environ.setdefault("SPREADSHEET_ID", "test-spreadsheet-id")

MOCK_CATALOG_ROWS: list[dict[str, Any]] = [
    {
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
]

MOCK_INVENTORY_ROWS: list[dict[str, Any]] = [
    {
        "Bag_ID": "BAG-001",
        "Beans": "Ethiopian Yirgacheffe",
        "RoastDate": "2024-01-15",
        "RoastLevel": "Light",
        "Display_Name": "Test Bag",
        "Catalog_ID": "CAT-001",
        "Status": "Active",
        "Storage_Method": "Freezer",
    }
]

MOCK_HARDWARE_ROWS: list[dict[str, Any]] = [
    {
        "Hardware_ID": "HW-001",
        "Category": "Machine",
        "Name": "La Marzocca Linea Mini",
        "Product_URL": "https://example.com/hw001",
        "Local_Image_Path": "",
    }
]

MOCK_MAINTENANCE_ROWS: list[dict[str, Any]] = [
    {
        "Maintenance_ID": "MAINT-001",
        "Hardware_ID": "HW-001",
        "Date": "2024-01-20",
        "Action_Type": "Backflush",
        "Notes": "Routine maintenance",
    }
]

MOCK_BREW_LOG_ROWS: list[dict[str, Any]] = [
    {
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
]


@pytest.fixture
def mock_sheets_data() -> dict[str, list[dict[str, Any]]]:
    """Deterministic fixture data for all 5 entities."""
    return {
        "Catalog": list(MOCK_CATALOG_ROWS),
        "Inventory": list(MOCK_INVENTORY_ROWS),
        "Hardware": list(MOCK_HARDWARE_ROWS),
        "Maintenance": list(MOCK_MAINTENANCE_ROWS),
        "Brew_Log": list(MOCK_BREW_LOG_ROWS),
    }


@pytest.fixture
async def db_engine():  # type: ignore[misc]
    """Integration test fixture: skips if DATABASE_URL is not a real postgres URL."""
    db_url = os.environ.get("DATABASE_URL", "")
    if not db_url.startswith("postgresql"):
        pytest.skip("DATABASE_URL is not a real postgres URL — skipping integration test")
    import subprocess

    from sqlalchemy.ext.asyncio import create_async_engine

    engine = create_async_engine(db_url, echo=False)
    result = subprocess.run(
        ["uv", "run", "alembic", "upgrade", "head"],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        pytest.fail(f"alembic upgrade head failed:\n{result.stderr}")
    yield engine
    await engine.dispose()
