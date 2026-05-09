"""Shared fixtures for Playwright browser tests.

Requires E2E_BASE_URL to be set in the environment (e.g.
  E2E_BASE_URL=https://<your-cloud-run-service-url>
  E2E_BASE_URL=http://localhost:8000   # local dev
).

For ASGI httpx client tests, see tests/integration/.
"""

from __future__ import annotations

import base64
import json
import os
import socket
import threading
import time

import pytest
import uvicorn
from itsdangerous import TimestampSigner

# ---------------------------------------------------------------------------
# Test constants
# ---------------------------------------------------------------------------

_TEST_SECRET = "dev-insecure-secret-for-testing-only"
_TEST_USER = {"email": "test@example.com", "name": "Test User", "picture": ""}

# ---------------------------------------------------------------------------
# Rich fake data — realistic enough to exercise all ID-display rules
# ---------------------------------------------------------------------------

CATALOG_ROWS = [
    {
        "Catalog_ID": "CAT001",
        "Roaster": "Verve Coffee",
        "Bean_Name": "Seabright",
        "Roast_Level": "Light",
        "Product_URL": "https://vervecoffee.com",
        "Local_Image_Path": "",
    },
    {
        "Catalog_ID": "CAT002",
        "Roaster": "Blue Bottle",
        "Bean_Name": "Kenya Kiambu",
        "Roast_Level": "Medium",
        "Product_URL": "",
        "Local_Image_Path": "",
    },
]

HARDWARE_ROWS = [
    {
        "Hardware_ID": "HW-M01",
        "Category": "Machine",
        "Name": "Breville Barista Express",
        "Image_URL": "",
    },
    {"Hardware_ID": "HW-G01", "Category": "Grinder", "Name": "Niche Zero", "Image_URL": ""},
    {"Hardware_ID": "HW-B01", "Category": "Basket", "Name": "IMS 20g", "Image_URL": ""},
]

INVENTORY_ROWS = [
    {
        "Bag_ID": "BAG-V001",
        "Beans": "Verve Coffee-Seabright",
        "RoastDate": "2025-01-10",
        "RoastLevel": "Light",
        "Display_Name": "Verve Coffee — Seabright",
        "Catalog_ID": "CAT001",
        "Status": "Active",
        "Storage_Method": "Freezer",
    },
    {
        "Bag_ID": "BAG-B001",
        "Beans": "Blue Bottle-Kenya Kiambu",
        "RoastDate": "2025-01-20",
        "RoastLevel": "Medium",
        "Display_Name": "Blue Bottle — Kenya Kiambu",
        "Catalog_ID": "CAT002",
        "Status": "Active",
        "Storage_Method": "Ambient — Bag",
    },
]

BREW_LOG_ROWS = [
    {
        "Shot_ID": "SHOT-001",
        "Date": "2025-01-15",
        "Bag_ID": "BAG-V001",
        "Machine_ID": "HW-M01",
        "Grinder_ID": "HW-G01",
        "Basket_ID": "HW-B01",
        "Dose_In_g": "18.0",
        "Yield_Out_g": "36.0",
        "Time_Sec": "27",
        "Grind_Setting": "4.5",
        "Shot_Eligibility": "Good Espresso",
        "Taste_Summary": "Sweet & Balanced",
        "User_Notes": "First shot of the bag",
        "AI_Feedback": "",
        "Storage_Method": "Freezer",
    },
    {
        "Shot_ID": "SHOT-002",
        "Date": "2025-01-20",
        "Bag_ID": "BAG-B001",
        "Machine_ID": "HW-M01",
        "Grinder_ID": "HW-G01",
        "Basket_ID": "HW-B01",
        "Dose_In_g": "18.5",
        "Yield_Out_g": "37.0",
        "Time_Sec": "28",
        "Grind_Setting": "5.0",
        "Shot_Eligibility": "Good Espresso",
        "Taste_Summary": "Bright & Fruity",
        "User_Notes": "",
        "AI_Feedback": "",
        "Storage_Method": "Ambient — Bag",
    },
]

MAINTENANCE_ROWS = [
    {
        "Maintenance_ID": "MAINT-001",
        "Hardware_ID": "HW-M01",
        "Date": "2025-01-01",
        "Action_Type": "Backflush",
        "Notes": "Weekly clean",
    },
]

FAKE_SHEETS_DATA = {
    "Catalog": [r.copy() for r in CATALOG_ROWS],
    "Hardware": [r.copy() for r in HARDWARE_ROWS],
    "Inventory": [r.copy() for r in INVENTORY_ROWS],
    "Brew_Log": [r.copy() for r in BREW_LOG_ROWS],
    "Maintenance": [r.copy() for r in MAINTENANCE_ROWS],
}


# ---------------------------------------------------------------------------
# Session cookie helper
# ---------------------------------------------------------------------------


def make_session_cookie(data: dict = None, secret: str = _TEST_SECRET) -> str:
    signer = TimestampSigner(secret)
    payload = base64.b64encode(json.dumps(data or {"user": _TEST_USER}).encode())
    return signer.sign(payload).decode()


# ---------------------------------------------------------------------------
# Live server fixture — starts real uvicorn with fake Sheets data injected
# ---------------------------------------------------------------------------


def _find_free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class _UvicornThread(threading.Thread):
    def __init__(self, config: uvicorn.Config):
        super().__init__(daemon=True)
        self.server = uvicorn.Server(config)

    def run(self):
        self.server.run()

    def stop(self):
        self.server.should_exit = True


@pytest.fixture(scope="session")
def live_server():
    """Start a uvicorn server with fake Sheets data. Session-scoped — one server for all E2E tests."""
    import httpx

    from app.deps import get_sheets_client
    from app.main import app
    from tests.doubles import FakeSheetsClient

    port = _find_free_port()
    base = f"http://127.0.0.1:{port}"

    fake = FakeSheetsClient(FAKE_SHEETS_DATA)
    app.dependency_overrides[get_sheets_client] = lambda: fake

    config = uvicorn.Config(
        app,
        host="127.0.0.1",
        port=port,
        log_level="error",
        loop="asyncio",
    )
    thread = _UvicornThread(config)
    thread.start()

    # Wait up to 10s for the server to be ready
    deadline = time.time() + 10
    while time.time() < deadline:
        try:
            r = httpx.get(f"{base}/livez", timeout=1)
            if r.status_code == 200:
                break
        except Exception:
            time.sleep(0.1)
    else:
        raise RuntimeError("Test server did not start within 10 seconds")

    yield base

    thread.stop()
    thread.join(timeout=5)
    app.dependency_overrides.pop(get_sheets_client, None)


@pytest.fixture
def auth_page(page, live_server):
    """Playwright page with session cookie pre-injected — starts authenticated."""
    page.context.add_cookies(
        [
            {
                "name": "session",
                "value": make_session_cookie(),
                "url": live_server,
                "httpOnly": False,
                "secure": False,
                "sameSite": "Lax",
            }
        ]
    )
    return page


# ---------------------------------------------------------------------------
# Legacy fixture for tests that use E2E_BASE_URL (kept for backward compat)
# ---------------------------------------------------------------------------


@pytest.fixture(scope="session")
def base_url() -> str:
    """Return E2E_BASE_URL for Playwright browser tests.

    Returns empty string when not set; browser tests skip themselves when empty.
    """
    return os.environ.get("E2E_BASE_URL", "").rstrip("/")
