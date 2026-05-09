"""Shared fixtures for integration tests (httpx ASGI client).

These tests use an in-process ASGI transport — no live server, no browser.
For real Playwright browser tests, see tests/e2e/.
"""

from __future__ import annotations

import base64
import json

import pytest
from httpx import ASGITransport, AsyncClient
from itsdangerous import TimestampSigner

from tests.doubles import FakeSheetsClient

# ---------------------------------------------------------------------------
# Session cookie helper
# ---------------------------------------------------------------------------

_TEST_SECRET = "dev-insecure-secret-for-testing-only"
_TEST_USER = {"email": "test@example.com", "name": "Test User", "picture": ""}


def _make_session_cookie(data: dict, secret: str = _TEST_SECRET) -> str:
    signer = TimestampSigner(secret)
    payload = base64.b64encode(json.dumps(data).encode("utf-8"))
    return signer.sign(payload).decode("utf-8")


# ---------------------------------------------------------------------------
# Known test data
# ---------------------------------------------------------------------------

_HARDWARE_GRINDER = {"Hardware_ID": "G01", "Category": "Grinder", "Name": "Baratza Encore"}
_HARDWARE_MACHINE = {"Hardware_ID": "M01", "Category": "Machine", "Name": "Breville Bambino"}
_HARDWARE_BASKET = {"Hardware_ID": "B01", "Category": "Basket", "Name": "IMS 20g"}

_CATALOG_VERVE = {
    "Catalog_ID": "CAT001",
    "Roaster": "Verve",
    "Bean_Name": "Seabright",
    "Roast_Level": "Medium",
    "Product_URL": "",
    "Local_Image_Path": "",
}

_BAG_ACTIVE = {
    "Bag_ID": "Ve20250201M",
    "Beans": "Verve-Seabright",
    "RoastDate": "2025-02-01",
    "RoastLevel": "Medium",
    "Display_Name": "Verve-Seabright — Feb 01 — Medium",
    "Catalog_ID": "CAT001",
    "Status": "Active",
    "Storage_Method": "Ambient — Bag",
}

_SHOT_1 = {
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

_SHOT_2 = {
    "Shot_ID": "SH-20250429-01",
    "Date": "2025-04-29",
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


# ---------------------------------------------------------------------------
# ASGI test client fixture (unit-level, no real browser)
# ---------------------------------------------------------------------------


@pytest.fixture
def fake_sheets_data():
    """Return a dict of sheet tab → rows for pre-populated test data."""
    return {
        "Hardware": [
            _HARDWARE_GRINDER.copy(),
            _HARDWARE_MACHINE.copy(),
            _HARDWARE_BASKET.copy(),
        ],
        "Inventory": [_BAG_ACTIVE.copy()],
        "Brew_Log": [_SHOT_1.copy(), _SHOT_2.copy()],
        "Catalog": [_CATALOG_VERVE.copy()],
        "Maintenance": [],
    }


@pytest.fixture
def fake_client(fake_sheets_data):
    """Return a FakeSheetsClient pre-populated with test data.

    Exposes ``_store`` attribute for tests that need to mutate data mid-test.
    """
    return FakeSheetsClient(fake_sheets_data)


@pytest.fixture
async def client(fake_client):
    """Async ASGI test client with FakeSheetsClient injected and auth bypass."""
    from app.deps import get_sheets_client
    from app.main import app

    app.dependency_overrides[get_sheets_client] = lambda: fake_client

    cookie_value = _make_session_cookie({"user": _TEST_USER})
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        follow_redirects=False,
    ) as ac:
        ac.cookies.set("session", cookie_value)
        yield ac

    app.dependency_overrides.pop(get_sheets_client, None)
