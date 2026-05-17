"""
Tests for all /api/* routes — Phase 10 React frontend rewrite.

Auth pattern mirrors test_auth.py: sign a session cookie with the known
test secret and inject via dependency_overrides.
"""

from __future__ import annotations

import base64
import json

import pytest
from httpx import ASGITransport, AsyncClient
from itsdangerous import TimestampSigner

from app.main import app

# ---------------------------------------------------------------------------
# Test isolation — reset dependency overrides before every test in this module
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _reset_overrides():
    """Clear dependency overrides AND process-level TTLCache before/after each test.

    Root cause of isolation failures: TTLCache is a process-level singleton.
    Integration tests populate it with Verve data; our FakeSheetsClient override
    is bypassed entirely because repos hit cache first. Clearing the store ensures
    repos always call the injected fake client.
    """
    from app.deps import get_sheets_client
    from app.repos.base import get_process_cache

    app.dependency_overrides.pop(get_sheets_client, None)
    get_process_cache()._store.clear()
    yield
    app.dependency_overrides.pop(get_sheets_client, None)
    get_process_cache()._store.clear()


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

_TEST_SECRET = "dev-insecure-secret-for-testing-only"
_TEST_USER = {"email": "test@example.com", "name": "Test User", "picture": ""}


def _make_session_cookie(data: dict, secret: str = _TEST_SECRET) -> str:
    signer = TimestampSigner(secret)
    payload = base64.b64encode(json.dumps(data).encode("utf-8"))
    return signer.sign(payload).decode("utf-8")


# Reusable cookie value for authenticated requests
_AUTHED_COOKIE = _make_session_cookie({"user": _TEST_USER})

# ---------------------------------------------------------------------------
# Fake data fixtures
# ---------------------------------------------------------------------------

_CATALOG_ROW = {
    "Catalog_ID": "CAT001",
    "Roaster": "Blue Bottle",
    "Bean_Name": "Kenya Kiambu",
    "Roast_Level": "Light",
    "Product_URL": "",
    "Local_Image_Path": "",
}

_INVENTORY_ROW = {
    "Bag_ID": "BB-2024-01-L-001",
    "Beans": "Blue Bottle — Kenya Kiambu",
    "RoastDate": "2024-01-15",
    "RoastLevel": "Light",
    "Display_Name": "Blue Bottle — Kenya Kiambu",
    "Catalog_ID": "CAT001",
    "Status": "Active",
    "Storage_Method": "Freezer",
}

_HARDWARE_ROW = {
    "Hardware_ID": "HW001",
    "Category": "Machine",
    "Name": "Breville Barista Express",
    "Image_URL": "",
}

_GRINDER_ROW = {
    "Hardware_ID": "HW002",
    "Category": "Grinder",
    "Name": "Niche Zero",
    "Image_URL": "",
}

# T019 (N-5): Storage row required for hardware Storage category tests
_STORAGE_ROW = {
    "Hardware_ID": "HW003",
    "Category": "Storage",
    "Name": "Frozen — Glass Tube",
    "Image_URL": "",
}

_SHOT_ROW = {
    "Shot_ID": "SHOT001",
    "Date": "2024-01-20",
    "Bag_ID": "BB-2024-01-L-001",
    "Machine_ID": "HW001",
    "Grinder_ID": "HW002",
    "Basket_ID": "",
    "Dose_In_g": "18.0",
    "Yield_Out_g": "36.0",
    "Time_Sec": "28.0",
    "Grind_Setting": "12",
    "Shot_Eligibility": "On",
    "Taste_Summary": "Sweet",
    "User_Notes": "",
    "Storage_Method": "Freezer",
    "AI_Feedback": "",
}

_MAINTENANCE_ROW = {
    "Maintenance_ID": "MAINT001",
    "Hardware_ID": "HW001",
    "Date": "2024-01-10",
    "Action_Type": "Backflush",
    "Notes": "",
}


def _make_fake_client():
    """Return a FakeSheetsClient seeded with representative data."""
    from tests.doubles import FakeSheetsClient

    return FakeSheetsClient(
        {
            "Catalog": [_CATALOG_ROW.copy()],
            "Inventory": [_INVENTORY_ROW.copy()],
            "Hardware": [_HARDWARE_ROW.copy(), _GRINDER_ROW.copy(), _STORAGE_ROW.copy()],
            "Brew_Log": [_SHOT_ROW.copy()],
            "Maintenance": [_MAINTENANCE_ROW.copy()],
        }
    )


# ---------------------------------------------------------------------------
# Async test helpers
# ---------------------------------------------------------------------------


async def _anon_get(path: str) -> int:
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test", follow_redirects=False
    ) as client:
        resp = await client.get(path)
    return resp.status_code


async def _authed(method: str, path: str, **kwargs) -> tuple[int, object]:
    from app.deps import get_sheets_client

    fake = _make_fake_client()
    app.dependency_overrides[get_sheets_client] = lambda: fake
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test", follow_redirects=False
        ) as client:
            client.cookies.set("session", _AUTHED_COOKIE)
            fn = getattr(client, method.lower())
            resp = await fn(path, **kwargs)
        return resp.status_code, resp.json()
    finally:
        app.dependency_overrides.pop(get_sheets_client, None)


# ===========================================================================
# /api/me
# ===========================================================================


@pytest.mark.asyncio
async def test_api_me_unauthenticated():
    status = await _anon_get("/api/me")
    assert status in (401, 302, 307)


@pytest.mark.asyncio
async def test_api_me_authenticated():
    status, data = await _authed("GET", "/api/me")
    assert status == 200
    assert "email" in data
    assert data["email"] == _TEST_USER["email"]
    assert "name" in data


# ===========================================================================
# /api/logout
# ===========================================================================


@pytest.mark.asyncio
async def test_api_logout():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test", follow_redirects=False
    ) as client:
        client.cookies.set("session", _AUTHED_COOKIE)
        resp = await client.post("/api/logout")
    assert resp.status_code == 200
    assert resp.json().get("ok") is True


# ===========================================================================
# /api/dashboard
# ===========================================================================


@pytest.mark.asyncio
async def test_api_dashboard_unauthenticated():
    status = await _anon_get("/api/dashboard")
    assert status in (401, 302, 307)


@pytest.mark.asyncio
async def test_api_dashboard_authenticated():
    status, data = await _authed("GET", "/api/dashboard")
    assert status == 200
    assert isinstance(data, list)
    if data:
        bag = data[0]
        assert "bag_id" in bag
        assert "display_name" in bag


# ===========================================================================
# /api/catalog
# ===========================================================================


@pytest.mark.asyncio
async def test_api_catalog_list_unauthenticated():
    status = await _anon_get("/api/catalog")
    assert status in (401, 302, 307)


@pytest.mark.asyncio
async def test_api_catalog_list_authenticated():
    status, data = await _authed("GET", "/api/catalog")
    assert status == 200
    assert isinstance(data, list)
    assert len(data) == 1
    item = data[0]
    assert item["catalog_id"] == "CAT001"
    assert item["roaster"] == "Blue Bottle"
    assert item["bean_name"] == "Kenya Kiambu"
    assert item["roast_level"] == "Light"
    # catalog_id is a route key, not a display field — but it IS in the response model
    assert "catalog_id" in item


@pytest.mark.asyncio
async def test_api_catalog_detail_unauthenticated():
    status = await _anon_get("/api/catalog/CAT001")
    assert status in (401, 302, 307)


@pytest.mark.asyncio
async def test_api_catalog_detail_authenticated():
    status, data = await _authed("GET", "/api/catalog/CAT001")
    assert status == 200
    assert "item" in data
    assert "bags" in data
    assert "recent_shots" in data
    assert data["item"]["roaster"] == "Blue Bottle"
    assert isinstance(data["bags"], list)
    assert isinstance(data["recent_shots"], list)


@pytest.mark.asyncio
async def test_api_catalog_detail_not_found():
    status, data = await _authed("GET", "/api/catalog/CATXXX")
    assert status == 404


@pytest.mark.asyncio
async def test_api_catalog_create_unauthenticated():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test", follow_redirects=False
    ) as client:
        resp = await client.post(
            "/api/catalog",
            json={"roaster": "X", "bean_name": "Y", "roast_level": "Light"},
        )
    assert resp.status_code in (401, 302, 307)


@pytest.mark.asyncio
async def test_api_catalog_create_authenticated():
    status, data = await _authed(
        "POST",
        "/api/catalog",
        json={"roaster": "Ritual", "bean_name": "Junin", "roast_level": "Medium"},
    )
    assert status == 201
    assert data["roaster"] == "Ritual"
    assert data["bean_name"] == "Junin"


@pytest.mark.asyncio
async def test_api_catalog_create_empty_roast_level_accepted():
    """POST /api/catalog with roast_level='' (LLM could not infer it) must return 201."""
    status, data = await _authed(
        "POST",
        "/api/catalog",
        json={"roaster": "Ritual", "bean_name": "Junin", "roast_level": ""},
    )
    assert status == 201, f"Expected 201, got {status}: {data}"
    assert data["roaster"] == "Ritual"


@pytest.mark.asyncio
async def test_api_catalog_create_invalid_roast_level_rejected():
    """POST /api/catalog with a non-empty invalid roast_level must still return 422."""
    status, _ = await _authed(
        "POST",
        "/api/catalog",
        json={"roaster": "Ritual", "bean_name": "Junin", "roast_level": "Bogus"},
    )
    assert status == 422


@pytest.mark.asyncio
async def test_api_catalog_update_unauthenticated():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test", follow_redirects=False
    ) as client:
        resp = await client.put(
            "/api/catalog/CAT001",
            json={"roaster": "X", "bean_name": "Y", "roast_level": "Light"},
        )
    assert resp.status_code in (401, 302, 307)


@pytest.mark.asyncio
async def test_api_catalog_update_authenticated():
    status, data = await _authed(
        "PUT",
        "/api/catalog/CAT001",
        json={
            "roaster": "Blue Bottle Updated",
            "bean_name": "Kenya Kiambu Reserve",
            "roast_level": "Medium",
            "product_url": "https://example.com/x",
        },
    )
    assert status == 200
    assert data["catalog_id"] == "CAT001"
    assert data["roaster"] == "Blue Bottle Updated"
    assert data["bean_name"] == "Kenya Kiambu Reserve"
    assert data["roast_level"] == "Medium"
    assert data["product_url"] == "https://example.com/x"


@pytest.mark.asyncio
async def test_api_catalog_update_not_found():
    status, _ = await _authed(
        "PUT",
        "/api/catalog/CATXXX",
        json={"roaster": "X", "bean_name": "Y", "roast_level": "Light"},
    )
    assert status == 404


@pytest.mark.asyncio
async def test_api_catalog_update_validation_error():
    status, _ = await _authed(
        "PUT",
        "/api/catalog/CAT001",
        json={"roaster": "", "bean_name": "Y", "roast_level": "Bogus"},
    )
    assert status == 422


@pytest.mark.asyncio
async def test_api_catalog_update_empty_roast_level_accepted():
    """PUT /api/catalog with roast_level='' must be accepted (mirrors POST fix)."""
    status, data = await _authed(
        "PUT",
        "/api/catalog/CAT001",
        json={"roaster": "Blue Bottle", "bean_name": "Kenya", "roast_level": ""},
    )
    assert status == 200, f"Expected 200, got {status}: {data}"
    assert data["roast_level"] == ""


@pytest.mark.asyncio
async def test_api_catalog_update_rejects_whitespace_product_url():
    """Mirrors POST /api/catalog: a whitespace-only product_url is rejected."""
    status, _ = await _authed(
        "PUT",
        "/api/catalog/CAT001",
        json={
            "roaster": "X",
            "bean_name": "Y",
            "roast_level": "Light",
            "product_url": "   ",
        },
    )
    assert status == 422


@pytest.mark.asyncio
async def test_api_catalog_update_preserves_image_path():
    """PUT must not clobber Local_Image_Path set by the /image endpoint."""
    from app.deps import get_sheets_client

    seeded_row = {**_CATALOG_ROW, "Local_Image_Path": "https://cdn/example.jpg"}
    from tests.doubles import FakeSheetsClient

    fake = FakeSheetsClient(
        {
            "Catalog": [seeded_row.copy()],
            "Inventory": [_INVENTORY_ROW.copy()],
            "Hardware": [_HARDWARE_ROW.copy(), _GRINDER_ROW.copy(), _STORAGE_ROW.copy()],
            "Brew_Log": [_SHOT_ROW.copy()],
            "Maintenance": [_MAINTENANCE_ROW.copy()],
        }
    )
    app.dependency_overrides[get_sheets_client] = lambda: fake
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test", follow_redirects=False
        ) as client:
            client.cookies.set("session", _AUTHED_COOKIE)
            resp = await client.put(
                "/api/catalog/CAT001",
                json={
                    "roaster": "New Roaster",
                    "bean_name": "New Bean",
                    "roast_level": "Dark",
                },
            )
        assert resp.status_code == 200
        assert resp.json()["image_path"] == "https://cdn/example.jpg"
    finally:
        app.dependency_overrides.pop(get_sheets_client, None)


# ===========================================================================
# /api/hardware
# ===========================================================================


@pytest.mark.asyncio
async def test_api_hardware_list_unauthenticated():
    status = await _anon_get("/api/hardware")
    assert status in (401, 302, 307)


@pytest.mark.asyncio
async def test_api_hardware_list_authenticated():
    status, data = await _authed("GET", "/api/hardware")
    assert status == 200
    assert isinstance(data, list)
    assert len(data) == 3  # Machine + Grinder + Storage (T019 N-5: Storage row added to fixture)
    item = data[0]
    assert "hardware_id" in item
    assert "name" in item
    assert "category" in item


@pytest.mark.asyncio
async def test_api_hardware_action_types_unauthenticated():
    status = await _anon_get("/api/hardware/action-types")
    assert status in (401, 302, 307)


@pytest.mark.asyncio
async def test_api_hardware_action_types_authenticated():
    status, data = await _authed("GET", "/api/hardware/action-types")
    assert status == 200
    assert "action_types" in data
    assert "Machine" in data["action_types"]


@pytest.mark.asyncio
async def test_api_hardware_detail_unauthenticated():
    status = await _anon_get("/api/hardware/HW001")
    assert status in (401, 302, 307)


@pytest.mark.asyncio
async def test_api_hardware_detail_authenticated():
    status, data = await _authed("GET", "/api/hardware/HW001")
    assert status == 200
    assert "item" in data
    assert "maintenance" in data
    assert data["item"]["name"] == "Breville Barista Express"
    assert data["item"]["category"] == "Machine"


@pytest.mark.asyncio
async def test_api_hardware_detail_not_found():
    status, data = await _authed("GET", "/api/hardware/HW999")
    assert status == 404


@pytest.mark.asyncio
async def test_api_hardware_create_authenticated():
    status, data = await _authed(
        "POST",
        "/api/hardware",
        json={"category": "Grinder", "name": "Comandante C40"},
    )
    assert status == 201
    assert data["name"] == "Comandante C40"
    assert data["category"] == "Grinder"


@pytest.mark.asyncio
async def test_api_hardware_update_authenticated():
    status, data = await _authed(
        "PUT",
        "/api/hardware/HW001",
        json={"name": "Breville Barista Pro"},
    )
    assert status == 200
    assert data["name"] == "Breville Barista Pro"


# ===========================================================================
# /api/brew-log
# ===========================================================================


@pytest.mark.asyncio
async def test_api_brew_log_list_unauthenticated():
    status = await _anon_get("/api/brew-log")
    assert status in (401, 302, 307)


@pytest.mark.asyncio
async def test_api_brew_log_list_authenticated():
    status, data = await _authed("GET", "/api/brew-log")
    assert status == 200
    assert isinstance(data, list)
    assert len(data) == 1
    entry = data[0]
    # Must have bag_display (not bag_id) as the display field
    assert "bag_display" in entry
    assert "shot_id" in entry
    assert "date" in entry
    # Must have resolved hardware names (not hardware IDs)
    assert "machine_name" in entry
    assert "grinder_name" in entry
    assert "basket_name" in entry
    # bag_display should contain em dash format
    assert "—" in entry["bag_display"]


@pytest.mark.asyncio
async def test_api_brew_log_detail_unauthenticated():
    status = await _anon_get("/api/brew-log/SHOT001")
    assert status in (401, 302, 307)


@pytest.mark.asyncio
async def test_api_brew_log_detail_authenticated():
    status, data = await _authed("GET", "/api/brew-log/SHOT001")
    assert status == 200
    assert data["shot_id"] == "SHOT001"
    assert "bag_display" in data
    assert "machine_name" in data


@pytest.mark.asyncio
async def test_api_brew_log_detail_not_found():
    status, data = await _authed("GET", "/api/brew-log/SHOTXXX")
    assert status == 404


@pytest.mark.asyncio
async def test_api_brew_log_feedback_unauthenticated():
    status = await _anon_get("/api/brew-log/SHOT001/feedback")
    assert status in (401, 302, 307)


@pytest.mark.asyncio
async def test_api_brew_log_feedback_authenticated():
    status, data = await _authed("GET", "/api/brew-log/SHOT001/feedback")
    assert status == 200
    assert "ai_feedback" in data


# ===========================================================================
# /api/inventory
# ===========================================================================


@pytest.mark.asyncio
async def test_api_inventory_list_unauthenticated():
    status = await _anon_get("/api/inventory")
    assert status in (401, 302, 307)


@pytest.mark.asyncio
async def test_api_inventory_list_authenticated():
    status, data = await _authed("GET", "/api/inventory")
    assert status == 200
    assert isinstance(data, list)
    assert len(data) == 1
    bag = data[0]
    assert "bag_id" in bag
    assert "display_name" in bag
    assert "status" in bag
    assert "—" in bag["display_name"]


@pytest.mark.asyncio
async def test_api_inventory_detail_unauthenticated():
    status = await _anon_get("/api/inventory/BB-2024-01-L-001")
    assert status in (401, 302, 307)


@pytest.mark.asyncio
async def test_api_inventory_detail_authenticated():
    status, data = await _authed("GET", "/api/inventory/BB-2024-01-L-001")
    assert status == 200
    assert data["bag_id"] == "BB-2024-01-L-001"
    assert "display_name" in data


@pytest.mark.asyncio
async def test_api_inventory_detail_not_found():
    status, data = await _authed("GET", "/api/inventory/BAG999")
    assert status == 404


@pytest.mark.asyncio
async def test_api_inventory_patch_unauthenticated():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test", follow_redirects=False
    ) as client:
        resp = await client.patch("/api/inventory/BB-2024-01-L-001", json={"status": "Finished"})
    assert resp.status_code in (401, 302, 307)


@pytest.mark.asyncio
async def test_api_inventory_patch_finish_bag():
    status, data = await _authed(
        "PATCH", "/api/inventory/BB-2024-01-L-001", json={"status": "Finished"}
    )
    assert status == 200
    assert data["bag_id"] == "BB-2024-01-L-001"
    assert data["status"] == "Finished"


@pytest.mark.asyncio
async def test_api_inventory_patch_set_active():
    status, data = await _authed(
        "PATCH", "/api/inventory/BB-2024-01-L-001", json={"status": "Active"}
    )
    assert status == 200
    assert data["status"] == "Active"


@pytest.mark.asyncio
async def test_api_inventory_patch_invalid_status():
    status, data = await _authed(
        "PATCH", "/api/inventory/BB-2024-01-L-001", json={"status": "Discarded"}
    )
    assert status == 422


@pytest.mark.asyncio
async def test_api_inventory_patch_not_found():
    status, data = await _authed("PATCH", "/api/inventory/BAG999", json={"status": "Finished"})
    assert status == 404


# ===========================================================================
# /api/maintenance
# ===========================================================================


@pytest.mark.asyncio
async def test_api_maintenance_list_unauthenticated():
    status = await _anon_get("/api/maintenance")
    assert status in (401, 302, 307)


@pytest.mark.asyncio
async def test_api_maintenance_list_authenticated():
    status, data = await _authed("GET", "/api/maintenance")
    assert status == 200
    assert isinstance(data, list)
    assert len(data) == 1
    entry = data[0]
    assert "maintenance_id" in entry
    assert "hardware_name" in entry
    assert "action_type" in entry
    assert "date" in entry


@pytest.mark.asyncio
async def test_api_maintenance_create_authenticated():
    status, data = await _authed(
        "POST",
        "/api/maintenance",
        json={
            "hardware_id": "HW001",
            "action_type": "Backflush",
            "date": "2024-02-01",
            "notes": "Weekly clean",
        },
    )
    assert status == 201
    assert data["action_type"] == "Backflush"
    assert data["hardware_name"] == "Breville Barista Express"


# ===========================================================================
# /api/defaults
# ===========================================================================


@pytest.mark.asyncio
async def test_api_defaults_by_bag_unauthenticated():
    status = await _anon_get("/api/defaults/BB-2024-01-L-001")
    assert status in (401, 302, 307)


@pytest.mark.asyncio
async def test_api_defaults_by_bag_authenticated():
    status, data = await _authed("GET", "/api/defaults/BB-2024-01-L-001")
    assert status == 200
    # DefaultsOut fields — all optional
    for key in (
        "machine_id",
        "grinder_id",
        "basket_id",
        "storage_method",
        "dose_in_g",
        "grind_setting",
    ):
        assert key in data


@pytest.mark.asyncio
async def test_api_defaults_unknown_bag():
    """Unknown bag_id returns 200 with empty defaults (not 404)."""
    status, data = await _authed("GET", "/api/defaults/UNKNOWN_BAG")
    assert status == 200


# ===========================================================================
# /api/defaults — T014: basket_id query param
# ===========================================================================


@pytest.mark.asyncio
async def test_api_defaults_with_basket_id_returns_200():
    """GET /api/defaults/{bag_id}?basket_id=B01 returns 200 with dose_in_g key (T014)."""
    status, data = await _authed("GET", "/api/defaults/BB-2024-01-L-001?basket_id=B01")
    assert status == 200
    # DefaultsOut always includes dose_in_g (may be null but key must be present)
    assert "dose_in_g" in data


@pytest.mark.asyncio
async def test_api_defaults_without_basket_id_regression():
    """GET /api/defaults/{bag_id} without basket_id still returns 200 (T014 regression)."""
    status, data = await _authed("GET", "/api/defaults/BB-2024-01-L-001")
    assert status == 200
    assert "dose_in_g" in data


# ===========================================================================
# /api/hardware — T019: Storage category
# ===========================================================================


@pytest.mark.asyncio
async def test_api_hardware_list_includes_storage_items():
    """GET /api/hardware returns at least one item with category == 'Storage' (T019)."""
    status, data = await _authed("GET", "/api/hardware")
    assert status == 200
    categories = [item["category"] for item in data]
    assert "Storage" in categories, (
        "Expected a Storage item in /api/hardware response. "
        "Ensure _STORAGE_ROW is seeded in _make_fake_client()."
    )


@pytest.mark.asyncio
async def test_api_hardware_create_storage_succeeds():
    """POST /api/hardware with category=Storage returns 201 (T019)."""
    status, data = await _authed(
        "POST",
        "/api/hardware",
        json={"category": "Storage", "name": "Frozen — Glass Tube"},
    )
    assert status == 201
    assert data["category"] == "Storage"
    assert data["name"] == "Frozen — Glass Tube"


# ===========================================================================
# /api/brew-log — POST (taste_summary + extra_context)
# ===========================================================================

_BREW_LOG_POST_BODY = {
    "bag_id": "BB-2024-01-L-001",
    "machine_id": "HW001",
    "grinder_id": "HW002",
    "basket_id": "",
    "dose_in_g": 18.0,
    "yield_out_g": 36.0,
    "time_sec": 28.0,
    "grind_setting": "12",
    "shot_eligibility": "Good Espresso",
    "taste_summary": "Sweet & balanced",
}


@pytest.mark.asyncio
async def test_api_brew_log_create_taste_summary_written():
    """POST /api/brew-log writes Taste_Summary field to the row."""
    from unittest.mock import AsyncMock, patch
    from app.deps import get_sheets_client

    fake = _make_fake_client()
    app.dependency_overrides[get_sheets_client] = lambda: fake
    try:
        # Patch get_ai_feedback to suppress inline AI call during test
        with patch(
            "app.routers.api_brew_log.get_ai_feedback", AsyncMock(return_value="mocked feedback")
        ):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test", follow_redirects=False
            ) as client:
                client.cookies.set("session", _AUTHED_COOKIE)
                resp = await client.post("/api/brew-log", json=_BREW_LOG_POST_BODY)

        assert resp.status_code == 201
        brew_log_rows = fake._store.get("Brew_Log", [])
        new_row = brew_log_rows[-1]
        assert new_row["Taste_Summary"] == "Sweet & balanced"
    finally:
        app.dependency_overrides.pop(get_sheets_client, None)


@pytest.mark.asyncio
async def test_api_brew_log_create_extra_context_passed_to_ai_feedback():
    """POST /api/brew-log passes extra_context dict (with taste_summary) to get_ai_feedback."""
    from unittest.mock import patch
    from app.deps import get_sheets_client

    fake = _make_fake_client()
    app.dependency_overrides[get_sheets_client] = lambda: fake
    captured: dict = {}

    async def _mock_feedback(
        shot_id, brew_log_repo, maintenance_repo, llm_client, extra_context=None
    ):
        captured["extra_context"] = extra_context
        return "mocked feedback"

    try:
        with patch("app.routers.api_brew_log.get_ai_feedback", _mock_feedback):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test", follow_redirects=False
            ) as client:
                client.cookies.set("session", _AUTHED_COOKIE)
                resp = await client.post("/api/brew-log", json=_BREW_LOG_POST_BODY)
            # get_ai_feedback is now awaited inline; no need to yield for a background task

        assert resp.status_code == 201
        assert "extra_context" in captured
        ctx = captured["extra_context"]
        assert ctx is not None
        assert ctx["taste_summary"] == "Sweet & balanced"
        # Machine name should be resolved from HW001 fixture ("Breville Barista Express")
        assert ctx["machine_name"] == "Breville Barista Express"
    finally:
        app.dependency_overrides.pop(get_sheets_client, None)
