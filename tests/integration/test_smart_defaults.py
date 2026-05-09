"""
E2E tests for smart defaults — 4-level fallback chain.

ASGI client tests run without a live server.
Playwright tests require E2E_BASE_URL.
"""

from __future__ import annotations

import pytest


# ---------------------------------------------------------------------------
# ASGI-level tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.smoke
async def test_defaults_level1(client):
    """GET /api/defaults?bag_id=X with existing shots → 6 fields returned."""
    response = await client.get("/api/defaults?bag_id=Ve20250201M")
    assert response.status_code == 200
    data = response.json()
    # Shot exists for this bag → level-1 defaults
    assert "grinder_id" in data
    assert "dose_in_g" in data
    assert "grind_setting" in data
    # shot_eligibility must never appear
    assert "shot_eligibility" not in data


@pytest.mark.asyncio
async def test_defaults_level2_same_roaster(client, fake_client):
    """No shot for bag; shot for same-roaster bag → level-2 fields."""
    # Add a new bag with same roaster (CAT001 = Verve) but no shots
    fake_client._store["Inventory"].append({
        "Bag_ID": "Ve20250601M",
        "Beans": "Verve-NewBag",
        "RoastDate": "2025-06-01",
        "RoastLevel": "Medium",
        "Display_Name": "Verve-NewBag",
        "Catalog_ID": "CAT001",  # same Verve catalog
        "Status": "Active",
        "Storage_Method": "",
    })
    response = await client.get("/api/defaults?bag_id=Ve20250601M")
    assert response.status_code == 200
    data = response.json()
    # Should get defaults from existing Verve shots (level 2)
    assert "shot_eligibility" not in data
    # Level-2 should populate machine/grinder/dose from same-roaster shots
    assert data.get("machine_id"), "Expected machine_id from same-roaster level-2 defaults"
    assert data.get("grinder_id"), "Expected grinder_id from same-roaster level-2 defaults"
    assert data.get("dose_in_g"), "Expected dose_in_g from same-roaster level-2 defaults"


@pytest.mark.asyncio
async def test_defaults_level3_same_roast_level(client, fake_client):
    """No shots for bag; no same-roaster bag; same roast level → level-3."""
    # Add a bag with no catalog (so level-2 skipped) and same RoastLevel="Medium"
    fake_client._store["Inventory"].append({
        "Bag_ID": "XX20250601M",
        "Beans": "UnknownBeans",
        "RoastDate": "2025-06-01",
        "RoastLevel": "Medium",
        "Display_Name": "Unknown — Jun 01 — Medium",
        "Catalog_ID": "",  # no catalog → level 2 skipped
        "Status": "Active",
        "Storage_Method": "",
    })
    response = await client.get("/api/defaults?bag_id=XX20250601M")
    assert response.status_code == 200
    data = response.json()
    # Level 3: picks up from Ve20250201M shots (same roast level "Medium")
    assert "shot_eligibility" not in data
    assert data.get("machine_id"), "Expected machine_id from same-roast-level level-3 defaults"
    assert data.get("dose_in_g"), "Expected dose_in_g from same-roast-level level-3 defaults"


@pytest.mark.asyncio
async def test_defaults_level4_empty(client, fake_client):
    """No history at all → {} returned."""
    # Clear brew log
    fake_client._store["Brew_Log"] = []
    # Add a new bag with no catalog and no roast level match
    fake_client._store["Inventory"].append({
        "Bag_ID": "ZZ20250601D",
        "Beans": "Dark-Solo",
        "RoastDate": "2025-06-01",
        "RoastLevel": "Dark",
        "Display_Name": "Dark-Solo",
        "Catalog_ID": "",
        "Status": "Active",
        "Storage_Method": "",
    })
    # Clear all active bags to avoid level-3 match
    fake_client._store["Inventory"] = [
        b for b in fake_client._store["Inventory"]
        if b["Bag_ID"] == "ZZ20250601D"
    ]
    response = await client.get("/api/defaults?bag_id=ZZ20250601D")
    assert response.status_code == 200
    data = response.json()
    assert data == {}


@pytest.mark.asyncio
async def test_defaults_shot_eligibility_never_returned(client):
    """shot_eligibility key must never be present in any defaults response."""
    # Level 1: shot exists
    r1 = await client.get("/api/defaults?bag_id=Ve20250201M")
    assert "shot_eligibility" not in r1.json()
    # Unknown bag: level 4
    r4 = await client.get("/api/defaults?bag_id=doesnotexist")
    assert "shot_eligibility" not in r4.json()


@pytest.mark.asyncio
async def test_defaults_unknown_bag_returns_200_empty(client):
    """GET /api/defaults?bag_id=nonexistent → HTTP 200 {}."""
    response = await client.get("/api/defaults?bag_id=nonexistent")
    assert response.status_code == 200
    assert response.json() == {}
