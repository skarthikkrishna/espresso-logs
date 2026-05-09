"""N+1 query guard tests for /api/brew-log endpoints.

Verifies that _build_lookups() pre-fetches all lookup tables exactly once
per request, and that the old per-shot inventory_repo.get() pattern is
never invoked.

Bug fix 015 — branch: bugfix/bg-images-500s
"""

from __future__ import annotations

import base64
import json
from unittest.mock import MagicMock

import pytest
from httpx import ASGITransport, AsyncClient
from itsdangerous import TimestampSigner

from app.main import app

# ---------------------------------------------------------------------------
# Auth helpers (mirrors test_api.py)
# ---------------------------------------------------------------------------

_TEST_SECRET = "dev-insecure-secret-for-testing-only"
_TEST_USER = {"email": "test@example.com", "name": "Test User", "picture": ""}


def _make_session_cookie(data: dict, secret: str = _TEST_SECRET) -> str:
    signer = TimestampSigner(secret)
    payload = base64.b64encode(json.dumps(data).encode("utf-8"))
    return signer.sign(payload).decode("utf-8")


_AUTHED_COOKIE = _make_session_cookie({"user": _TEST_USER})

# ---------------------------------------------------------------------------
# Minimal fake data
# ---------------------------------------------------------------------------

_BAG_ROW = {
    "Bag_ID": "BAG001",
    "Beans": "Verve-Seabright",
    "RoastDate": "2025-01-01",
    "RoastLevel": "Medium",
    "Display_Name": "Verve-Seabright",
    "Catalog_ID": "CAT001",
    "Status": "Active",
    "Storage_Method": "Ambient",
}

_CATALOG_ROW = {
    "Catalog_ID": "CAT001",
    "Roaster": "Verve",
    "Bean_Name": "Seabright",
    "Roast_Level": "Medium",
    "Product_URL": "",
    "Local_Image_Path": "",
}

_HARDWARE_ROW = {
    "Hardware_ID": "HW001",
    "Category": "Machine",
    "Name": "Breville Bambino",
}

_SHOT_ROW = {
    "Shot_ID": "SH-001",
    "Date": "2025-01-20",
    "Bag_ID": "BAG001",
    "Machine_ID": "HW001",
    "Grinder_ID": "",
    "Basket_ID": "",
    "Dose_In_g": "18.0",
    "Yield_Out_g": "36.0",
    "Time_Sec": "28.0",
    "Grind_Setting": "12",
    "Shot_Eligibility": "Good Espresso",
    "Taste_Summary": "Sweet",
    "User_Notes": "",
    "AI_Feedback": "",
    "Storage_Method": "Ambient",
}

# ---------------------------------------------------------------------------
# Test isolation — reset dependency overrides and process-level TTLCache
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _reset_overrides():
    from app.deps import get_sheets_client
    from app.repos.base import get_process_cache

    app.dependency_overrides.pop(get_sheets_client, None)
    get_process_cache()._store.clear()
    yield
    app.dependency_overrides.pop(get_sheets_client, None)
    get_process_cache()._store.clear()


# ---------------------------------------------------------------------------
# Mock repo factory helpers
# ---------------------------------------------------------------------------


def _make_mock_inventory_repo():
    repo = MagicMock()
    repo.list_all.return_value = [_BAG_ROW.copy()]
    repo.get.return_value = _BAG_ROW.copy()
    return repo


def _make_mock_catalog_repo():
    repo = MagicMock()
    repo.list.return_value = [_CATALOG_ROW.copy()]
    return repo


def _make_mock_hardware_repo():
    repo = MagicMock()
    repo.list.return_value = [_HARDWARE_ROW.copy()]
    return repo


def _make_mock_brew_log_repo(shots=None):
    repo = MagicMock()
    shots = shots if shots is not None else [_SHOT_ROW.copy()]
    repo.list_recent.return_value = shots
    repo.get.return_value = shots[0] if shots else None
    repo.add.return_value = None
    return repo


# ---------------------------------------------------------------------------
# Helper: install dep overrides and yield an authenticated AsyncClient
# ---------------------------------------------------------------------------


class _OverrideContext:
    """Context manager that installs dependency overrides and removes them on exit."""

    def __init__(self, overrides: dict):
        self._overrides = overrides

    def __enter__(self):
        app.dependency_overrides.update(self._overrides)
        return self

    def __exit__(self, *_):
        for dep in self._overrides:
            app.dependency_overrides.pop(dep, None)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_brew_log_list_reads_each_repo_exactly_once():
    """GET /api/brew-log calls list_all/list on each lookup repo exactly once.

    The fix ensures _build_lookups() is called once per request; no per-shot
    individual repo.get() calls are issued.
    """
    from app.deps import (
        get_brew_log_repo,
        get_catalog_repo,
        get_hardware_repo,
        get_inventory_repo,
    )

    inv_repo = _make_mock_inventory_repo()
    cat_repo = _make_mock_catalog_repo()
    hw_repo = _make_mock_hardware_repo()
    bl_repo = _make_mock_brew_log_repo()

    overrides = {
        get_inventory_repo: lambda: inv_repo,
        get_catalog_repo: lambda: cat_repo,
        get_hardware_repo: lambda: hw_repo,
        get_brew_log_repo: lambda: bl_repo,
    }

    with _OverrideContext(overrides):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            client.cookies.set("session", _AUTHED_COOKIE)
            resp = await client.get("/api/brew-log")

    assert resp.status_code == 200
    # Exactly one bulk-fetch of all inventory bags — not one per shot
    assert inv_repo.list_all.call_count == 1
    # Per-item lookup must never be used
    inv_repo.get.assert_not_called()
    # Catalog and hardware also fetched exactly once
    assert cat_repo.list.call_count == 1
    assert hw_repo.list.call_count == 1


@pytest.mark.asyncio
async def test_brew_log_list_handles_missing_bag_id():
    """GET /api/brew-log with Bag_ID="" returns HTTP 200 (no 500/KeyError)."""
    from app.deps import (
        get_brew_log_repo,
        get_catalog_repo,
        get_hardware_repo,
        get_inventory_repo,
    )

    shot_no_bag = _SHOT_ROW.copy()
    shot_no_bag["Bag_ID"] = ""

    inv_repo = MagicMock()
    inv_repo.list_all.return_value = []  # empty — bag not found
    cat_repo = MagicMock()
    cat_repo.list.return_value = []
    hw_repo = MagicMock()
    hw_repo.list.return_value = []
    bl_repo = _make_mock_brew_log_repo(shots=[shot_no_bag])

    overrides = {
        get_inventory_repo: lambda: inv_repo,
        get_catalog_repo: lambda: cat_repo,
        get_hardware_repo: lambda: hw_repo,
        get_brew_log_repo: lambda: bl_repo,
    }

    with _OverrideContext(overrides):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            client.cookies.set("session", _AUTHED_COOKIE)
            resp = await client.get("/api/brew-log")

    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    # bag_display must be "" or the raw id — never an unhandled exception
    assert data[0]["bag_display"] in ("", shot_no_bag["Bag_ID"])


@pytest.mark.asyncio
async def test_brew_log_list_handles_missing_hardware_ids():
    """GET /api/brew-log with unknown hardware IDs returns 200 with None names."""
    from app.deps import (
        get_brew_log_repo,
        get_catalog_repo,
        get_hardware_repo,
        get_inventory_repo,
    )

    shot_unknown_hw = _SHOT_ROW.copy()
    shot_unknown_hw["Machine_ID"] = "UNKNOWN_M"
    shot_unknown_hw["Grinder_ID"] = "UNKNOWN_G"
    shot_unknown_hw["Basket_ID"] = "UNKNOWN_B"

    inv_repo = MagicMock()
    inv_repo.list_all.return_value = []
    cat_repo = MagicMock()
    cat_repo.list.return_value = []
    hw_repo = MagicMock()
    hw_repo.list.return_value = []  # empty — no matching hardware in lookup dict
    bl_repo = _make_mock_brew_log_repo(shots=[shot_unknown_hw])

    overrides = {
        get_inventory_repo: lambda: inv_repo,
        get_catalog_repo: lambda: cat_repo,
        get_hardware_repo: lambda: hw_repo,
        get_brew_log_repo: lambda: bl_repo,
    }

    with _OverrideContext(overrides):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            client.cookies.set("session", _AUTHED_COOKIE)
            resp = await client.get("/api/brew-log")

    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    entry = data[0]
    # All hardware names should be None or "" — never a KeyError / 500
    assert entry["machine_name"] in (None, "")
    assert entry["grinder_name"] in (None, "")
    assert entry["basket_name"] in (None, "")


@pytest.mark.asyncio
async def test_brew_log_detail_reads_each_repo_exactly_once():
    """GET /api/brew-log/{shot_id} calls list_all/list on each lookup repo exactly once."""
    from app.deps import (
        get_brew_log_repo,
        get_catalog_repo,
        get_hardware_repo,
        get_inventory_repo,
    )

    inv_repo = _make_mock_inventory_repo()
    cat_repo = _make_mock_catalog_repo()
    hw_repo = _make_mock_hardware_repo()
    bl_repo = _make_mock_brew_log_repo()

    overrides = {
        get_inventory_repo: lambda: inv_repo,
        get_catalog_repo: lambda: cat_repo,
        get_hardware_repo: lambda: hw_repo,
        get_brew_log_repo: lambda: bl_repo,
    }

    with _OverrideContext(overrides):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            client.cookies.set("session", _AUTHED_COOKIE)
            resp = await client.get("/api/brew-log/SH-001")

    assert resp.status_code == 200
    assert inv_repo.list_all.call_count == 1
    # inventory_repo.get() must never be called — only brew_log_repo.get() is fine
    inv_repo.get.assert_not_called()
    assert cat_repo.list.call_count == 1
    assert hw_repo.list.call_count == 1


@pytest.mark.asyncio
async def test_brew_log_create_pre_fetches_lookups():
    """POST /api/brew-log uses _build_lookups (list_all once, get never called)."""
    from app.deps import (
        get_brew_log_repo,
        get_catalog_repo,
        get_hardware_repo,
        get_inventory_repo,
        get_llm_client,
        get_maintenance_repo,
    )

    inv_repo = _make_mock_inventory_repo()
    cat_repo = _make_mock_catalog_repo()
    hw_repo = _make_mock_hardware_repo()
    bl_repo = _make_mock_brew_log_repo(shots=[])

    maint_repo = MagicMock()
    maint_repo.list.return_value = []
    llm = MagicMock()

    overrides = {
        get_inventory_repo: lambda: inv_repo,
        get_catalog_repo: lambda: cat_repo,
        get_hardware_repo: lambda: hw_repo,
        get_brew_log_repo: lambda: bl_repo,
        get_maintenance_repo: lambda: maint_repo,
        get_llm_client: lambda: llm,
    }

    with _OverrideContext(overrides):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            client.cookies.set("session", _AUTHED_COOKIE)
            resp = await client.post(
                "/api/brew-log",
                json={
                    "bag_id": "BAG001",
                    "machine_id": "HW001",
                    "grinder_id": "",
                    "basket_id": "",
                    "dose_in_g": 18.0,
                    "yield_out_g": 36.0,
                    "time_sec": 28.0,
                    "grind_setting": "12",
                    "shot_eligibility": "Good Espresso",
                    "taste_summary": "Sweet",
                },
            )

    assert resp.status_code == 201
    # _build_lookups was called → list_all exactly once, get never called
    assert inv_repo.list_all.call_count == 1
    inv_repo.get.assert_not_called()
