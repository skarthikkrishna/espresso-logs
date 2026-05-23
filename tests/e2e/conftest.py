"""Shared fixtures for Playwright browser tests.

Uses a session-scoped uvicorn server with fake Sheets data when ``E2E_BASE_URL``
is not provided. Defaults the E2E environment to the local auth-bypass mode so
browser tests can exercise the SPA without a live auth backend.
"""

from __future__ import annotations

import json
import os
import socket
import threading
import time
from typing import Any
from urllib.parse import urlparse

import httpx
import pytest
import uvicorn

os.environ.setdefault("APP_ENV", "local")
os.environ.setdefault("SPREADSHEET_ID", "dummy")
os.environ.setdefault("E2E_AUTH_BYPASS", "1")

# ---------------------------------------------------------------------------
# Test constants
# ---------------------------------------------------------------------------

_E2E_ACCESS_TOKEN = "e2e-access-token"
_E2E_REFRESH_TOKEN = "e2e-refresh-token"
_E2E_HOUSEHOLD_ID = "00000000-0000-0000-0000-000000000002"
_E2E_USER_ID = "00000000-0000-0000-0000-000000000001"
_E2E_USERNAME = "e2e-test-user"
_E2E_DISPLAY_NAME = "E2E Test User"
_E2E_EMAIL = "e2e-test@localhost"
_E2E_PASSWORD = "VerySecurePass123!"

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
# Helpers
# ---------------------------------------------------------------------------


def _find_free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class _UvicornThread(threading.Thread):
    def __init__(self, config: uvicorn.Config):
        super().__init__(daemon=True)
        self.server = uvicorn.Server(config)

    def run(self) -> None:
        self.server.run()

    def stop(self) -> None:
        self.server.should_exit = True


def _refresh_cookie(base_url: str, value: str) -> dict[str, Any]:
    parsed = urlparse(base_url)
    domain = parsed.hostname or "localhost"
    return {
        "name": "rt",
        "value": value,
        "domain": domain,
        "path": "/auth",
        "httpOnly": True,
        "secure": parsed.scheme == "https",
        "sameSite": "Lax",
    }


def _auth_headers(access_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {access_token}"}


def _me_payload() -> dict[str, Any]:
    return {
        "id": _E2E_USER_ID,
        "username": _E2E_USERNAME,
        "display_name": _E2E_DISPLAY_NAME,
        "email": _E2E_EMAIL,
        "picture_url": None,
        "household_id": _E2E_HOUSEHOLD_ID,
        "role": "admin",
        "active_household_id": _E2E_HOUSEHOLD_ID,
        "memberships": [
            {
                "household_id": _E2E_HOUSEHOLD_ID,
                "household_name": "Home",
                "role": "admin",
                "joined_at": "2025-01-01T00:00:00Z",
            }
        ],
    }


def _install_auth_bypass(page: Any, base_url: str) -> None:
    context = page.context
    context.set_extra_http_headers(_auth_headers(_E2E_ACCESS_TOKEN))
    context.add_cookies([_refresh_cookie(base_url, _E2E_REFRESH_TOKEN)])
    page.add_init_script(
        f"window.localStorage.setItem('espresso.activeHouseholdId', '{_E2E_HOUSEHOLD_ID}');"
    )

    def _fulfill_json(route: Any, payload: dict[str, Any]) -> None:
        route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps(payload),
        )

    context.route(
        "**/auth/refresh",
        lambda route: _fulfill_json(
            route,
            {"access_token": _E2E_ACCESS_TOKEN, "token_type": "bearer"},
        ),
    )
    context.route("**/auth/me", lambda route: _fulfill_json(route, _me_payload()))


def _authenticate_via_api(page: Any, base_url: str) -> None:
    username = f"e2e-{int(time.time() * 1000)}"
    refresh_token: str | None = None

    with httpx.Client(base_url=base_url, follow_redirects=False, timeout=10.0) as client:
        response = client.post(
            "/auth/register",
            json={
                "username": username,
                "password": _E2E_PASSWORD,
                "display_name": _E2E_DISPLAY_NAME,
            },
        )
        if response.status_code == 409:
            response = client.post(
                "/auth/login",
                json={"username": username, "password": _E2E_PASSWORD},
            )
        response.raise_for_status()
        payload = response.json()
        refresh_token = client.cookies.get("rt") or response.cookies.get("rt")

        page.context.set_extra_http_headers(_auth_headers(payload["access_token"]))

        me_response = client.get("/auth/me", headers=_auth_headers(payload["access_token"]))
        if me_response.is_success:
            household_id = me_response.json().get("active_household_id")
            if household_id:
                page.add_init_script(
                    f"window.localStorage.setItem('espresso.activeHouseholdId', '{household_id}');"
                )

    if refresh_token is not None:
        page.context.add_cookies([_refresh_cookie(base_url, refresh_token)])


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def reset_rate_limiter() -> None:
    """Reset the in-memory slowapi limiter between E2E tests."""
    from app.rate_limit import limiter

    limiter._storage.reset()
    yield
    limiter._storage.reset()


@pytest.fixture(scope="session")
def live_server() -> str:
    """Start a uvicorn server with fake Sheets data. Session-scoped."""
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

    deadline = time.time() + 10
    while time.time() < deadline:
        try:
            response = httpx.get(f"{base}/livez", timeout=1)
            if response.status_code == 200:
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
def auth_page(page: Any, base_url: str) -> Any:
    """Playwright page bootstrapped into an authenticated JWT session."""
    if os.environ.get("E2E_AUTH_BYPASS") == "1":
        _install_auth_bypass(page, base_url)
    else:
        _authenticate_via_api(page, base_url)
    return page


@pytest.fixture(scope="session")
def base_url(request: pytest.FixtureRequest) -> str:
    """Return E2E_BASE_URL, defaulting to the session live server."""
    configured = os.environ.get("E2E_BASE_URL", "").rstrip("/")
    if configured:
        return configured
    return str(request.getfixturevalue("live_server")).rstrip("/")
