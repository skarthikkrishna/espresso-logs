"""
Tests for app/services/defaults.py — get_defaults() 4-level fallback chain.
"""

from __future__ import annotations

import pytest

from app.repos.base import TTLCache
from app.repos.brew_log import BrewLogRepo
from app.repos.catalog import CatalogRepo
from app.repos.inventory import InventoryRepo
from tests.doubles import FakeSheetsClient
from app.services.defaults import get_defaults

# ---------------------------------------------------------------------------
# Shared test data
# ---------------------------------------------------------------------------

_CATALOG_VERVE = {
    "Catalog_ID": "CAT001",
    "Roaster": "Verve",
    "Bean_Name": "Seabright",
    "Roast_Level": "Medium",
    "Product_URL": "",
    "Local_Image_Path": "",
}
_CATALOG_CHROMATIC = {
    "Catalog_ID": "CAT002",
    "Roaster": "Chromatic",
    "Bean_Name": "Encore",
    "Roast_Level": "Medium",
    "Product_URL": "",
    "Local_Image_Path": "",
}

_BAG_A = {
    "Bag_ID": "Ve20250201M",
    "Beans": "Verve-Seabright",
    "RoastDate": "2025-02-01",
    "RoastLevel": "Medium",
    "Display_Name": "Verve-Seabright — Feb 01 — Medium",
    "Catalog_ID": "CAT001",
    "Status": "Active",
    "Storage_Method": "Ambient — Bag",
}
_BAG_B = {
    "Bag_ID": "Ve20250301M",
    "Beans": "Verve-Seabright-Mar",
    "RoastDate": "2025-03-01",
    "RoastLevel": "Medium",
    "Display_Name": "Verve-Seabright-Mar — Mar 01 — Medium",
    "Catalog_ID": "CAT001",  # same roaster: Verve
    "Status": "Active",
    "Storage_Method": "Ambient — Bag",
}
_BAG_C = {
    "Bag_ID": "Ch20250301M",
    "Beans": "Chromatic-Encore",
    "RoastDate": "2025-03-01",
    "RoastLevel": "Medium",  # same roast level, different roaster
    "Display_Name": "Chromatic-Encore — Mar 01 — Medium",
    "Catalog_ID": "CAT002",
    "Status": "Active",
    "Storage_Method": "Frozen — Bag",
}
_BAG_D = {
    "Bag_ID": "Ve20250401D",
    "Beans": "Verve-Dark",
    "RoastDate": "2025-04-01",
    "RoastLevel": "Dark",
    "Display_Name": "Verve-Dark — Apr 01 — Dark",
    "Catalog_ID": "CAT001",
    "Status": "Active",
    "Storage_Method": "Ambient — Bag",
}
_BAG_NO_CATALOG = {
    "Bag_ID": "XX20250401M",
    "Beans": "Unknown",
    "RoastDate": "2025-04-01",
    "RoastLevel": "Medium",
    "Display_Name": "Unknown — Apr 01 — Medium",
    "Catalog_ID": "",  # no catalog entry
    "Status": "Active",
    "Storage_Method": "",
}

_SHOT_A = {
    "Shot_ID": "SH-20250428-01",
    "Date": "2025-04-28",
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
_SHOT_B = {
    "Shot_ID": "SH-20250429-01",
    "Date": "2025-04-29",
    "Bag_ID": "Ve20250201M",
    "Machine_ID": "M01",
    "Grinder_ID": "G01",
    "Basket_ID": "",
    "Dose_In_g": 17.5,
    "Yield_Out_g": 35.0,
    "Time_Sec": 27,
    "Grind_Setting": 4.0,
    "Shot_Eligibility": "Passable",
    "Taste_Summary": "Acidic & Bright",
    "User_Notes": "",
    "AI_Feedback": "",
    "Storage_Method": "Frozen — Glass Tube",
}
# Shot for BAG_B (same roaster as BAG_A, level-2 trigger)
_SHOT_B2 = {
    "Shot_ID": "SH-20250501-01",
    "Date": "2025-05-01",
    "Bag_ID": "Ve20250301M",
    "Machine_ID": "M02",
    "Grinder_ID": "G02",
    "Basket_ID": "B02",
    "Dose_In_g": 19.0,
    "Yield_Out_g": 38.0,
    "Time_Sec": 30,
    "Grind_Setting": 5.0,
    "Shot_Eligibility": "Good Espresso",
    "Taste_Summary": "Complex & Syrupy",
    "User_Notes": "",
    "AI_Feedback": "",
    "Storage_Method": "Ambient — Bag",
}
# Shot for BAG_C (same roast level, different roaster — level-3 trigger)
_SHOT_C = {
    "Shot_ID": "SH-20250502-01",
    "Date": "2025-05-02",
    "Bag_ID": "Ch20250301M",
    "Machine_ID": "M01",
    "Grinder_ID": "G01",
    "Basket_ID": "B01",
    "Dose_In_g": 16.0,
    "Yield_Out_g": 32.0,
    "Time_Sec": 26,
    "Grind_Setting": 3.5,
    "Shot_Eligibility": "Good Espresso",
    "Taste_Summary": "Sweet & Balanced",
    "User_Notes": "",
    "AI_Feedback": "",
    "Storage_Method": "Frozen — Bag",
}


# ---------------------------------------------------------------------------
# Fixture helpers
# ---------------------------------------------------------------------------

def _make_repos(brew_log_rows=None, inventory_rows=None, catalog_rows=None):
    """Return (brew_log_repo, inventory_repo, catalog_repo) backed by FakeSheetsClient."""
    client = FakeSheetsClient(
        {
            "Brew_Log": brew_log_rows or [],
            "Inventory": inventory_rows or [],
            "Catalog": catalog_rows or [],
        }
    )
    cache = TTLCache()
    return (
        BrewLogRepo(client=client, cache=cache),
        InventoryRepo(client=client, cache=cache),
        CatalogRepo(client=client, cache=cache),
    )


# ---------------------------------------------------------------------------
# Level 1 — exact bag match
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_defaults_level1():
    """Level 1: most recent shot for this bag → returns 6 snake_case fields."""
    brew_repo, inv_repo, cat_repo = _make_repos(
        brew_log_rows=[_SHOT_A.copy(), _SHOT_B.copy()],
        inventory_rows=[_BAG_A.copy()],
        catalog_rows=[_CATALOG_VERVE.copy()],
    )
    result = await get_defaults("Ve20250201M", brew_repo, inv_repo, cat_repo)
    # _SHOT_B has the later date
    assert result["machine_id"] == "M01"
    assert result["grinder_id"] == "G01"
    assert result["dose_in_g"] == 17.5
    assert result["grind_setting"] == 4.0
    assert result["storage_method"] == "Frozen — Glass Tube"
    # basket_id is empty → must be omitted
    assert "basket_id" not in result
    # shot_eligibility must never appear
    assert "shot_eligibility" not in result


@pytest.mark.asyncio
async def test_defaults_shot_eligibility_never_returned():
    """shot_eligibility must never be a key in any defaults response."""
    brew_repo, inv_repo, cat_repo = _make_repos(
        brew_log_rows=[_SHOT_A.copy()],
        inventory_rows=[_BAG_A.copy()],
        catalog_rows=[_CATALOG_VERVE.copy()],
    )
    result = await get_defaults("Ve20250201M", brew_repo, inv_repo, cat_repo)
    assert "shot_eligibility" not in result

    # Also check level 2
    brew_repo2, inv_repo2, cat_repo2 = _make_repos(
        brew_log_rows=[_SHOT_B2.copy()],
        inventory_rows=[_BAG_A.copy(), _BAG_B.copy()],
        catalog_rows=[_CATALOG_VERVE.copy()],
    )
    result2 = await get_defaults("Ve20250201M", brew_repo2, inv_repo2, cat_repo2)
    assert "shot_eligibility" not in result2


# ---------------------------------------------------------------------------
# Level 2 — same roaster
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_defaults_level2_same_roaster():
    """Level 2: no shot for bag; shot for same-roaster bag → level-2 fields."""
    # BAG_A has no shots; BAG_B (same roaster) has SHOT_B2
    brew_repo, inv_repo, cat_repo = _make_repos(
        brew_log_rows=[_SHOT_B2.copy()],
        inventory_rows=[_BAG_A.copy(), _BAG_B.copy()],
        catalog_rows=[_CATALOG_VERVE.copy()],
    )
    result = await get_defaults("Ve20250201M", brew_repo, inv_repo, cat_repo)
    assert result["machine_id"] == "M02"
    assert result["grinder_id"] == "G02"
    assert result["dose_in_g"] == 19.0
    assert result["grind_setting"] == 5.0
    assert "shot_eligibility" not in result


@pytest.mark.asyncio
async def test_defaults_level2_skipped_when_no_catalog_id():
    """Level 2 is skipped when bag has no Catalog_ID; falls through to Level 3."""
    # BAG_NO_CATALOG has no Catalog_ID, same RoastLevel "Medium"
    # BAG_C (different roaster, same roast level) has SHOT_C
    brew_repo, inv_repo, cat_repo = _make_repos(
        brew_log_rows=[_SHOT_C.copy()],
        inventory_rows=[_BAG_NO_CATALOG.copy(), _BAG_C.copy()],
        catalog_rows=[_CATALOG_CHROMATIC.copy()],
    )
    result = await get_defaults("XX20250401M", brew_repo, inv_repo, cat_repo)
    # Level 2 skipped (no catalog_id) → Level 3 picks up SHOT_C (same roast level "Medium")
    assert result["machine_id"] == "M01"
    assert result["grind_setting"] == 3.5


# ---------------------------------------------------------------------------
# Level 3 — same roast level
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_defaults_level3_same_roast_level():
    """Level 3: no shots for bag or same-roaster bags; same roast level → level-3 fields."""
    # BAG_D (Dark) has no shots; BAG_A has no shots; BAG_C (Medium, different roaster) has SHOT_C
    # We need a bag with Medium level that has no same-roaster match but a same-level match
    _bag_new = {
        "Bag_ID": "Ne20250601M",
        "Beans": "New-Bean",
        "RoastDate": "2025-06-01",
        "RoastLevel": "Medium",
        "Display_Name": "New — Jun 01 — Medium",
        "Catalog_ID": "CAT999",  # non-existent catalog
        "Status": "Active",
        "Storage_Method": "",
    }
    brew_repo, inv_repo, cat_repo = _make_repos(
        brew_log_rows=[_SHOT_C.copy()],  # only shot is for BAG_C, same roast level "Medium"
        inventory_rows=[_bag_new.copy(), _BAG_C.copy()],
        catalog_rows=[_CATALOG_CHROMATIC.copy()],  # CAT002 only; CAT999 doesn't exist
    )
    result = await get_defaults("Ne20250601M", brew_repo, inv_repo, cat_repo)
    # Level 2 fails (CAT999 not found) → Level 3 picks up SHOT_C (same roast level)
    assert result["machine_id"] == "M01"
    assert result["grind_setting"] == 3.5
    assert "shot_eligibility" not in result


# ---------------------------------------------------------------------------
# Level 4 — no history
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_defaults_level4_empty():
    """Level 4: no history at all → {} returned."""
    brew_repo, inv_repo, cat_repo = _make_repos(
        brew_log_rows=[],
        inventory_rows=[_BAG_A.copy()],
        catalog_rows=[_CATALOG_VERVE.copy()],
    )
    result = await get_defaults("Ve20250201M", brew_repo, inv_repo, cat_repo)
    assert result == {}


@pytest.mark.asyncio
async def test_defaults_nonexistent_bag_id():
    """Nonexistent bag_id → {} (no 404, just empty)."""
    brew_repo, inv_repo, cat_repo = _make_repos(
        brew_log_rows=[],
        inventory_rows=[],
        catalog_rows=[],
    )
    result = await get_defaults("DoesNotExist", brew_repo, inv_repo, cat_repo)
    assert result == {}


# ---------------------------------------------------------------------------
# T013 — Level 0 basket-specific defaults
# ---------------------------------------------------------------------------

# Three shots for basket B01 on BAG_A, in ascending date order
_SHOT_B01_1 = {
    "Shot_ID": "SH-L0-01",
    "Date": "2025-04-26",
    "Bag_ID": "Ve20250201M",
    "Machine_ID": "M01",
    "Grinder_ID": "G01",
    "Basket_ID": "B01",
    "Dose_In_g": 18.0,
    "Yield_Out_g": 36.0,
    "Time_Sec": 28,
    "Grind_Setting": 10.5,
    "Shot_Eligibility": "Good Espresso",
    "Taste_Summary": "Sweet & Balanced",
    "User_Notes": "",
    "AI_Feedback": "",
    "Storage_Method": "Ambient — Bag",
}
_SHOT_B01_2 = {
    "Shot_ID": "SH-L0-02",
    "Date": "2025-04-27",
    "Bag_ID": "Ve20250201M",
    "Machine_ID": "M01",
    "Grinder_ID": "G01",
    "Basket_ID": "B01",
    "Dose_In_g": 18.5,
    "Yield_Out_g": 37.0,
    "Time_Sec": 29,
    "Grind_Setting": 11.0,
    "Shot_Eligibility": "Good Espresso",
    "Taste_Summary": "Sweet & Balanced",
    "User_Notes": "",
    "AI_Feedback": "",
    "Storage_Method": "Ambient — Bag",
}
_SHOT_B01_3 = {
    "Shot_ID": "SH-L0-03",
    "Date": "2025-04-28",
    "Bag_ID": "Ve20250201M",
    "Machine_ID": "M01",
    "Grinder_ID": "G01",
    "Basket_ID": "B01",
    "Dose_In_g": 19.0,
    "Yield_Out_g": 38.0,
    "Time_Sec": 30,
    "Grind_Setting": 11.5,
    "Shot_Eligibility": "Good Espresso",
    "Taste_Summary": "Sweet & Balanced",
    "User_Notes": "",
    "AI_Feedback": "",
    "Storage_Method": "Ambient — Bag",
}
# Noise shot for basket B02 — must not appear in B01 results
_SHOT_B02_NOISE = {
    "Shot_ID": "SH-L0-04",
    "Date": "2025-04-29",
    "Bag_ID": "Ve20250201M",
    "Machine_ID": "M02",
    "Grinder_ID": "G02",
    "Basket_ID": "B02",
    "Dose_In_g": 15.0,
    "Yield_Out_g": 30.0,
    "Time_Sec": 25,
    "Grind_Setting": 8.0,
    "Shot_Eligibility": "Reject",
    "Taste_Summary": "Bitter",
    "User_Notes": "",
    "AI_Feedback": "",
    "Storage_Method": "Ambient — Bag",
}


@pytest.mark.asyncio
async def test_defaults_level0_basket_filtered():
    """Level 0: basket_id filters to matching shots; most recent B01 shot returned,
    B02 noise shot excluded."""
    brew_repo, inv_repo, cat_repo = _make_repos(
        brew_log_rows=[
            _SHOT_B01_1.copy(),
            _SHOT_B01_2.copy(),
            _SHOT_B01_3.copy(),
            _SHOT_B02_NOISE.copy(),
        ],
        inventory_rows=[_BAG_A.copy()],
        catalog_rows=[_CATALOG_VERVE.copy()],
    )
    result = await get_defaults("Ve20250201M", brew_repo, inv_repo, cat_repo, basket_id="B01")

    # Most recent B01 shot is SH-L0-03 (2025-04-28): dose=19.0, yield=38.0, grind=11.5
    assert result["dose_in_g"] == 19.0
    assert result["yield_out_g"] == 38.0
    assert result["grind_setting"] == 11.5

    # B02 noise shot values must NOT be returned
    assert result["dose_in_g"] != 15.0

    # shot_eligibility must never appear
    assert "shot_eligibility" not in result


@pytest.mark.asyncio
async def test_defaults_level0_with_few_shots_returns_non_null():
    """Level 0 with only 2 B01 shots: result is non-None with a non-null dose_in_g.

    The service either returns Level 0 (from the 2 matching shots) or falls through to
    a higher level — both are valid. The critical guarantee is that no error is raised
    and a DefaultsOut-compatible dict with dose_in_g is returned.
    """
    brew_repo, inv_repo, cat_repo = _make_repos(
        brew_log_rows=[_SHOT_B01_1.copy(), _SHOT_B01_2.copy()],
        inventory_rows=[_BAG_A.copy()],
        catalog_rows=[_CATALOG_VERVE.copy()],
    )
    result = await get_defaults("Ve20250201M", brew_repo, inv_repo, cat_repo, basket_id="B01")

    assert result is not None
    assert result.get("dose_in_g") is not None


@pytest.mark.asyncio
async def test_defaults_no_basket_id_regression():
    """Calling get_defaults without basket_id returns same Level-1 result as before
    this PR (regression guard: basket_id param must not alter existing behaviour)."""
    brew_repo, inv_repo, cat_repo = _make_repos(
        brew_log_rows=[_SHOT_A.copy(), _SHOT_B.copy()],
        inventory_rows=[_BAG_A.copy()],
        catalog_rows=[_CATALOG_VERVE.copy()],
    )
    # No basket_id — identical call pattern to the existing test_defaults_level1
    result = await get_defaults("Ve20250201M", brew_repo, inv_repo, cat_repo)

    # _SHOT_B has the later date → Level 1 returns its values
    assert result["machine_id"] == "M01"
    assert result["grinder_id"] == "G01"
    assert result["dose_in_g"] == 17.5
    assert result["grind_setting"] == 4.0
    assert "shot_eligibility" not in result

