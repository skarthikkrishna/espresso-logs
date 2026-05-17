"""
Tests for all repository classes using FakeSheetsClient.

Covers:
  - list / get / upsert / add per repo
  - TTL cache: second list() within TTL = 0 extra get_all_records calls
  - Cache invalidation on write
"""

from __future__ import annotations

import pytest

from app.repos.base import TTLCache
from app.repos.brew_log import BrewLogRepo
from app.repos.catalog import CatalogRepo
from app.repos.hardware import HardwareRepo
from app.repos.inventory import InventoryRepo
from app.repos.maintenance import MaintenanceRepo
from tests.doubles import FakeSheetsClient

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="function")
def empty_cache() -> TTLCache:
    return TTLCache(ttl=60.0)


@pytest.fixture(scope="function")
def stale_cache() -> TTLCache:
    """TTL of 0 — every read is a cache miss."""
    return TTLCache(ttl=0.0)


# ---------------------------------------------------------------------------
# CatalogRepo
# ---------------------------------------------------------------------------


_CATALOG_ROW_1 = {
    "Catalog_ID": "CAT100",
    "Roaster": "Verve",
    "Bean_Name": "Seabright",
    "Roast_Level": "Medium",
    "Product_URL": "",
    "Local_Image_Path": "",
}
_CATALOG_ROW_2 = {
    "Catalog_ID": "CAT101",
    "Roaster": "Chromatic",
    "Bean_Name": "Encore",
    "Roast_Level": "Light",
    "Product_URL": "",
    "Local_Image_Path": "",
}


@pytest.fixture(scope="function")
def catalog_client() -> FakeSheetsClient:
    return FakeSheetsClient({"Catalog": [_CATALOG_ROW_1.copy()]})


def test_catalog_list(catalog_client, empty_cache):
    repo = CatalogRepo(client=catalog_client, cache=empty_cache)
    rows = repo.list()
    assert len(rows) == 1
    assert rows[0]["Catalog_ID"] == "CAT100"


def test_catalog_get_found(catalog_client, empty_cache):
    repo = CatalogRepo(client=catalog_client, cache=empty_cache)
    row = repo.get("CAT100")
    assert row is not None
    assert row["Roaster"] == "Verve"


def test_catalog_get_not_found(catalog_client, empty_cache):
    repo = CatalogRepo(client=catalog_client, cache=empty_cache)
    assert repo.get("CATXXX") is None


def test_catalog_upsert_insert(catalog_client, empty_cache):
    repo = CatalogRepo(client=catalog_client, cache=empty_cache)
    repo.upsert(_CATALOG_ROW_2.copy())
    assert len(catalog_client._store["Catalog"]) == 2


def test_catalog_upsert_update(catalog_client, empty_cache):
    repo = CatalogRepo(client=catalog_client, cache=empty_cache)
    updated = _CATALOG_ROW_1.copy()
    updated["Bean_Name"] = "Seabright v2"
    repo.upsert(updated)
    # Still 1 row (update, not insert)
    assert len(catalog_client._store["Catalog"]) == 1
    assert catalog_client._store["Catalog"][0]["Bean_Name"] == "Seabright v2"


def test_catalog_cache_hit(catalog_client, empty_cache):
    repo = CatalogRepo(client=catalog_client, cache=empty_cache)
    repo.list()  # first call — populates cache
    repo.list()  # second call — should hit cache
    assert catalog_client.call_counts.get("Catalog", 0) == 1


def test_catalog_cache_invalidated_on_upsert(catalog_client, empty_cache):
    repo = CatalogRepo(client=catalog_client, cache=empty_cache)
    repo.list()  # populates cache
    count_after_list = catalog_client.call_counts.get("Catalog", 0)
    repo.upsert(_CATALOG_ROW_2.copy())  # should invalidate
    repo.list()  # must re-fetch (cache was invalidated)
    assert catalog_client.call_counts.get("Catalog", 0) > count_after_list


# ---------------------------------------------------------------------------
# InventoryRepo
# ---------------------------------------------------------------------------

_BAG_ACTIVE = {
    "Bag_ID": "Ve20250201M",
    "Beans": "Verve-Seabright",
    "RoastDate": "2025-02-01",
    "RoastLevel": "Medium",
    "Display_Name": "Verve-Seabright — Feb 01 — Medium",
    "Catalog_ID": "CAT100",
    "Status": "Active",
    "Storage_Method": "Ambient — Bag",
}
_BAG_FINISHED = {
    "Bag_ID": "Ve20250101L",
    "Beans": "Verve-Old",
    "RoastDate": "2025-01-01",
    "RoastLevel": "Light",
    "Display_Name": "Verve-Old — Jan 01 — Light",
    "Catalog_ID": "",
    "Status": "Finished",
    "Storage_Method": "",
}


@pytest.fixture(scope="function")
def inv_client() -> FakeSheetsClient:
    return FakeSheetsClient({"Inventory": [_BAG_ACTIVE.copy(), _BAG_FINISHED.copy()]})


def test_inventory_list_active_only(inv_client, empty_cache):
    repo = InventoryRepo(client=inv_client, cache=empty_cache)
    rows = repo.list(status="Active")
    assert len(rows) == 1
    assert rows[0]["Bag_ID"] == "Ve20250201M"


def test_inventory_list_all(inv_client, empty_cache):
    repo = InventoryRepo(client=inv_client, cache=empty_cache)
    rows = repo.list(status=None)
    assert len(rows) == 2


def test_inventory_get(inv_client, empty_cache):
    repo = InventoryRepo(client=inv_client, cache=empty_cache)
    row = repo.get("Ve20250201M")
    assert row is not None


def test_inventory_get_missing(inv_client, empty_cache):
    repo = InventoryRepo(client=inv_client, cache=empty_cache)
    assert repo.get("XXXX") is None


def test_inventory_upsert_insert(inv_client, empty_cache):
    repo = InventoryRepo(client=inv_client, cache=empty_cache)
    new_bag = _BAG_ACTIVE.copy()
    new_bag["Bag_ID"] = "Ch20250301LM"
    repo.upsert(new_bag)
    assert len(inv_client._store["Inventory"]) == 3


def test_inventory_upsert_update(inv_client, empty_cache):
    repo = InventoryRepo(client=inv_client, cache=empty_cache)
    updated = _BAG_ACTIVE.copy()
    updated["Status"] = "Finished"
    repo.upsert(updated)
    assert inv_client._store["Inventory"][0]["Status"] == "Finished"


def test_inventory_cache_hit(inv_client, empty_cache):
    repo = InventoryRepo(client=inv_client, cache=empty_cache)
    repo.list(status="Active")
    repo.list(status="Active")
    # Both calls go through _fetch_cached → only 1 API call
    assert inv_client.call_counts.get("Inventory", 0) == 1


def test_inventory_cache_invalidated_on_upsert(inv_client, empty_cache):
    repo = InventoryRepo(client=inv_client, cache=empty_cache)
    repo.list(status="Active")
    new_bag = _BAG_ACTIVE.copy()
    new_bag["Bag_ID"] = "Ch20250301LM"
    repo.upsert(new_bag)
    count_after_upsert = inv_client.call_counts.get("Inventory", 0)
    repo.list(status="Active")  # must re-fetch — cache was invalidated
    assert inv_client.call_counts.get("Inventory", 0) > count_after_upsert


# ---------------------------------------------------------------------------
# HardwareRepo
# ---------------------------------------------------------------------------

_MACHINE = {"Hardware_ID": "M01", "Category": "Machine", "Name": "Breville Bambino Plus"}
_GRINDER = {"Hardware_ID": "G01", "Category": "Grinder", "Name": "Eureka Mignon Specialita"}
_BASKET = {"Hardware_ID": "B01", "Category": "Basket", "Name": "VST 18g"}


@pytest.fixture(scope="function")
def hw_client() -> FakeSheetsClient:
    return FakeSheetsClient({"Hardware": [_MACHINE.copy(), _GRINDER.copy(), _BASKET.copy()]})


def test_hardware_list_all(hw_client, empty_cache):
    repo = HardwareRepo(client=hw_client, cache=empty_cache)
    assert len(repo.list()) == 3


def test_hardware_list_filtered(hw_client, empty_cache):
    repo = HardwareRepo(client=hw_client, cache=empty_cache)
    grinders = repo.list(category="Grinder")
    assert len(grinders) == 1
    assert grinders[0]["Hardware_ID"] == "G01"


def test_hardware_get(hw_client, empty_cache):
    repo = HardwareRepo(client=hw_client, cache=empty_cache)
    assert repo.get("M01") is not None


def test_hardware_get_missing(hw_client, empty_cache):
    repo = HardwareRepo(client=hw_client, cache=empty_cache)
    assert repo.get("M99") is None


def test_hardware_upsert_insert(hw_client, empty_cache):
    repo = HardwareRepo(client=hw_client, cache=empty_cache)
    repo.upsert({"Hardware_ID": "G02", "Category": "Grinder", "Name": "Niche Zero"})
    assert len(hw_client._store["Hardware"]) == 4


def test_hardware_upsert_update(hw_client, empty_cache):
    repo = HardwareRepo(client=hw_client, cache=empty_cache)
    repo.upsert({"Hardware_ID": "M01", "Category": "Machine", "Name": "Breville Bambino"})
    assert hw_client._store["Hardware"][0]["Name"] == "Breville Bambino"


# ---------------------------------------------------------------------------
# MaintenanceRepo
# ---------------------------------------------------------------------------

_MNT_ROW = {
    "Maintenance_ID": "MNT001",
    "Hardware_ID": "G01",
    "Date": "2025-04-01",
    "Action_Type": "Re-zero",
    "Notes": "Set to 3.0",
}


@pytest.fixture(scope="function")
def mnt_client() -> FakeSheetsClient:
    return FakeSheetsClient({"Maintenance": [_MNT_ROW.copy()]})


def test_maintenance_list_all(mnt_client, empty_cache):
    repo = MaintenanceRepo(client=mnt_client, cache=empty_cache)
    assert len(repo.list()) == 1


def test_maintenance_list_filtered(mnt_client, empty_cache):
    repo = MaintenanceRepo(client=mnt_client, cache=empty_cache)
    assert len(repo.list(hardware_id="G01")) == 1
    assert len(repo.list(hardware_id="M01")) == 0


def test_maintenance_get(mnt_client, empty_cache):
    repo = MaintenanceRepo(client=mnt_client, cache=empty_cache)
    row = repo.get("MNT001")
    assert row is not None
    assert row["Action_Type"] == "Re-zero"


def test_maintenance_get_missing(mnt_client, empty_cache):
    repo = MaintenanceRepo(client=mnt_client, cache=empty_cache)
    assert repo.get("MNT999") is None


def test_maintenance_add(mnt_client, empty_cache):
    repo = MaintenanceRepo(client=mnt_client, cache=empty_cache)
    new_row = {
        "Maintenance_ID": "MNT002",
        "Hardware_ID": "M01",
        "Date": "2025-04-15",
        "Action_Type": "Descale",
        "Notes": "",
    }
    repo.add(new_row)
    assert len(mnt_client._store["Maintenance"]) == 2


# ---------------------------------------------------------------------------
# BrewLogRepo
# ---------------------------------------------------------------------------

_SHOT_1 = {
    "Shot_ID": "SH-20250429-01",
    "Date": "2025-04-29",
    "Bag_ID": "Ve20250201M",
    "Machine_ID": "M01",
    "Grinder_ID": "G01",
    "Basket_ID": "B01",
    "Dose_In_g": 18.0,
    "Yield_Out_g": 36.0,
    "Time_Sec": 28,
    "Grind_Setting": 4.5,
    "Shot_Eligibility": "Good Espresso",
    "Taste_Summary": "Sweet & Balanced",
    "User_Notes": "",
    "AI_Feedback": "",
    "Storage_Method": "Ambient — Bag",
}
_SHOT_2 = {
    "Shot_ID": "SH-20250430-01",
    "Date": "2025-04-30",
    "Bag_ID": "Ve20250201M",
    "Machine_ID": "M01",
    "Grinder_ID": "G01",
    "Basket_ID": "B01",
    "Dose_In_g": 18.0,
    "Yield_Out_g": 37.0,
    "Time_Sec": 29,
    "Grind_Setting": 4.5,
    "Shot_Eligibility": "Good Espresso",
    "Taste_Summary": "Sweet & Balanced",
    "User_Notes": "",
    "AI_Feedback": "",
    "Storage_Method": "Ambient — Bag",
}


@pytest.fixture(scope="function")
def brew_client() -> FakeSheetsClient:
    return FakeSheetsClient({"Brew_Log": [_SHOT_1.copy(), _SHOT_2.copy()]})


def test_brew_log_add(brew_client, empty_cache):
    repo = BrewLogRepo(client=brew_client, cache=empty_cache)
    new_shot = _SHOT_1.copy()
    new_shot["Shot_ID"] = "SH-20250501-01"
    new_shot["Date"] = "2025-05-01"
    repo.add(new_shot)
    assert len(brew_client._store["Brew_Log"]) == 3


def test_brew_log_get(brew_client, empty_cache):
    repo = BrewLogRepo(client=brew_client, cache=empty_cache)
    row = repo.get("SH-20250429-01")
    assert row is not None
    assert row["Date"] == "2025-04-29"


def test_brew_log_get_missing(brew_client, empty_cache):
    repo = BrewLogRepo(client=brew_client, cache=empty_cache)
    assert repo.get("SH-99999999-01") is None


def test_brew_log_list_for_bag(brew_client, empty_cache):
    repo = BrewLogRepo(client=brew_client, cache=empty_cache)
    shots = repo.list_for_bag("Ve20250201M")
    assert len(shots) == 2


def test_brew_log_list_for_bag_other(brew_client, empty_cache):
    repo = BrewLogRepo(client=brew_client, cache=empty_cache)
    shots = repo.list_for_bag("OtherBag")
    assert shots == []


def test_brew_log_list_recent(brew_client, empty_cache):
    repo = BrewLogRepo(client=brew_client, cache=empty_cache)
    recent = repo.list_recent(n=5)
    # Most recent first
    assert recent[0]["Date"] == "2025-04-30"
    assert recent[1]["Date"] == "2025-04-29"


def test_brew_log_list_recent_n_limit(brew_client, empty_cache):
    repo = BrewLogRepo(client=brew_client, cache=empty_cache)
    recent = repo.list_recent(n=1)
    assert len(recent) == 1
    assert recent[0]["Date"] == "2025-04-30"


def test_list_recent_sorts_by_date_then_shot_id(empty_cache):
    """Regression: same-date shots must be ordered by Shot_ID desc (sequence number).

    Two shots on 2026-05-04 (SH-20260504-02 and SH-20260504-01) and one on
    2026-05-03.  Expected order after list_recent():
        SH-20260504-02 → SH-20260504-01 → SH-20260503-01
    """
    rows = [
        {**_SHOT_1, "Shot_ID": "SH-20260504-01", "Date": "2026-05-04"},
        {**_SHOT_1, "Shot_ID": "SH-20260504-02", "Date": "2026-05-04"},
        {**_SHOT_1, "Shot_ID": "SH-20260503-01", "Date": "2026-05-03"},
    ]
    client = FakeSheetsClient({"Brew_Log": rows})
    repo = BrewLogRepo(client=client, cache=empty_cache)

    recent = repo.list_recent(n=10)

    assert len(recent) == 3
    ids = [r["Shot_ID"] for r in recent]
    # Higher sequence on same date comes first
    assert ids.index("SH-20260504-02") < ids.index("SH-20260504-01"), (
        "SH-20260504-02 should precede SH-20260504-01 (same date, higher sequence)"
    )
    # Earlier-dated row appears last
    assert recent[-1]["Shot_ID"] == "SH-20260503-01", "Earlier-dated shot must appear last"


def test_brew_log_list_recent_cache_hit(brew_client, empty_cache):
    repo = BrewLogRepo(client=brew_client, cache=empty_cache)
    repo.list_recent()
    repo.list_recent()
    assert brew_client.call_counts.get("Brew_Log", 0) == 1


def test_brew_log_add_invalidates_cache(brew_client, empty_cache):
    repo = BrewLogRepo(client=brew_client, cache=empty_cache)
    repo.list_recent()  # populate cache
    new_shot = _SHOT_1.copy()
    new_shot["Shot_ID"] = "SH-20250501-01"
    new_shot["Date"] = "2025-05-01"
    repo.add(new_shot)  # invalidate
    repo.list_recent()  # must re-fetch
    assert brew_client.call_counts.get("Brew_Log", 0) >= 2


def test_brew_log_update_feedback(brew_client, empty_cache):
    repo = BrewLogRepo(client=brew_client, cache=empty_cache)
    repo.update_feedback("SH-20250429-01", "Try grinding finer.")
    updated = repo.get("SH-20250429-01")
    assert updated is not None
    assert updated["AI_Feedback"] == "Try grinding finer."


def test_brew_log_update_feedback_missing_raises(brew_client, empty_cache):
    repo = BrewLogRepo(client=brew_client, cache=empty_cache)
    with pytest.raises(KeyError):
        repo.update_feedback("SH-MISSING-00", "feedback")


def test_brew_log_add_passes_pk_col(brew_client, empty_cache):
    """add() must pass pk_col='Shot_ID' to append_row for idempotency."""
    from unittest.mock import patch

    repo = BrewLogRepo(client=brew_client, cache=empty_cache)
    new_shot = _SHOT_1.copy()
    new_shot["Shot_ID"] = "SH-20250501-01"
    new_shot["Date"] = "2025-05-01"
    with patch.object(brew_client, "append_row", wraps=brew_client.append_row) as spy:
        repo.add(new_shot)
        # add() normalises the row against COLUMNS before writing — build the same
        # normalised dict so the assertion reflects the actual contract.
        from app.repos.brew_log import BrewLogRepo as _Repo

        normalised = {col: new_shot.get(col, "") for col in _Repo.COLUMNS}
        spy.assert_called_once_with("Brew_Log", normalised, pk_col="Shot_ID")


def test_brew_log_add_duplicate_first_call_blocked(empty_cache):
    """PK guard blocks duplicate on the very first call — regression for _first_call removal.

    FakeSheetsClient.append_row mirrors the updated RealSheetsClient behaviour:
    the PK check fires unconditionally (not only on retries).  Adding a row
    with a Shot_ID that already exists must leave exactly one row in the store.
    """
    existing = _SHOT_1.copy()
    client = FakeSheetsClient({"Brew_Log": [existing]})
    repo = BrewLogRepo(client=client, cache=empty_cache)

    # Attempt to add a row with the same Shot_ID
    duplicate = _SHOT_1.copy()
    repo.add(duplicate)

    rows = client._store.get("Brew_Log", [])
    assert len(rows) == 1, (
        f"Duplicate Shot_ID should be blocked on first call; got {len(rows)} rows"
    )


def test_fake_sheets_append_row_pk_guard_blocks_first_call():
    """FakeSheetsClient.append_row PK guard fires on first call (no _first_call skip).

    Directly exercises the low-level append_row contract: two calls with the
    same pk_col value leave exactly one row, regardless of which call is first.
    """
    client = FakeSheetsClient({"Brew_Log": []})
    row = _SHOT_1.copy()
    client.append_row("Brew_Log", row, pk_col="Shot_ID")
    assert len(client._store["Brew_Log"]) == 1

    # Second call with identical PK — should be silently skipped
    client.append_row("Brew_Log", row.copy(), pk_col="Shot_ID")
    assert len(client._store["Brew_Log"]) == 1, (
        "PK guard must block the second append_row even on the first collision"
    )
