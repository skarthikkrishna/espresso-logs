"""Real Playwright E2E tests for Coffee Tracker.

Test classification
-------------------
ASGI-level tests (run in CI without a live server, no real browser):
  - test_unauthenticated_redirect
  - test_dashboard_renders
  - test_maintenance_action_type_filters_by_hardware
  - test_extraction_compass_in_brew_form

Browser-level tests (require RUN_E2E_LIVE=1 + a live server at E2E_BASE_URL):
  - test_anonymous_root_follows_oauth_chain
  - test_authenticated_dashboard_nav_visible
  - test_zero_to_first_shot_flow  (also documents the ASGI-level sub-steps)

Existing stubs in this directory (test_auth.py, test_brew_log.py, etc.) call the
ASGI app directly via httpx.ASGITransport.  They are integration tests at the HTTP
layer and do NOT exercise JavaScript, HTMX swaps, or canvas rendering.  They live
here for historical reasons — do NOT rename the directory (tracked as tech debt).

Env vars
--------
SESSION_SECRET   Must match what the app signs cookies with.  Set to
                 "dev-insecure-secret-for-testing-only" by conftest.py for all test runs.
RUN_E2E_LIVE=1   Gate for tests that require a running server + real browser.
E2E_BASE_URL     Base URL for live-server browser tests (default: http://localhost:8000).
"""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient

# ---------------------------------------------------------------------------
# Re-use the helpers already proven in tests/e2e/conftest.py
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


def _make_fake_app_client() -> tuple:
    """Return (AsyncClient context manager, FakeSheetsClient) for ASGI tests.

    Usage::
        client_ctx, fake = _make_fake_app_client()
        async with client_ctx as ac:
            ...
    """
    from app.deps import get_sheets_client
    from app.main import app
    from tests.doubles import FakeSheetsClient

    fake = FakeSheetsClient(
        {
            "Hardware": [
                _HARDWARE_GRINDER.copy(),
                _HARDWARE_MACHINE.copy(),
                _HARDWARE_BASKET.copy(),
            ],
            "Inventory": [_BAG_ACTIVE.copy()],
            "Brew_Log": [_SHOT_1.copy()],
            "Catalog": [_CATALOG_VERVE.copy()],
            "Maintenance": [],
        }
    )
    app.dependency_overrides[get_sheets_client] = lambda: fake
    client = AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        follow_redirects=False,
    )
    return client, fake, app


# ---------------------------------------------------------------------------
# Helper: build an ASGI client WITHOUT a session cookie (anonymous)
# ---------------------------------------------------------------------------


def _make_anon_app_client():
    """Return a bare ASGI client with no session cookie."""
    from app.main import app

    return AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        follow_redirects=False,
    )


# ===========================================================================
# ASGI-level tests (no browser — run unconditionally in CI)
# ===========================================================================


def test_unauthenticated_redirect() -> None:
    """[ASGI] GET / serves the SPA shell for anonymous callers."""
    from app.main import app

    with TestClient(app) as client:
        response = client.get("/")

    assert response.status_code == 200, (
        f"Expected 200 SPA shell for unauthenticated request, got {response.status_code}"
    )
    assert 'id="root"' in response.text


def test_dashboard_renders() -> None:
    """[ASGI] GET / serves the built React SPA shell."""
    from app.deps import get_sheets_client
    from app.main import app
    from tests.doubles import FakeSheetsClient

    fake = FakeSheetsClient(
        {
            "Inventory": [_BAG_ACTIVE.copy()],
            "Brew_Log": [_SHOT_1.copy()],
        }
    )
    app.dependency_overrides[get_sheets_client] = lambda: fake
    try:
        with TestClient(app) as client:
            response = client.get("/")
    finally:
        app.dependency_overrides.pop(get_sheets_client, None)

    assert response.status_code == 200, (
        f"Expected 200 for authenticated dashboard, got {response.status_code}"
    )
    content = response.text

    assert 'id="root"' in content
    assert "/static/spa/assets/" in content


@pytest.mark.skip(reason="Legacy HTMX fragment endpoint removed by SPA migration")
async def test_maintenance_action_type_filters_by_hardware() -> None:
    """Legacy HTMX fragment coverage removed by the React SPA migration."""


@pytest.mark.skip(reason="Legacy HTMX brew modal endpoint removed by SPA migration")
async def test_extraction_compass_in_brew_form() -> None:
    """Legacy brew-log modal fragment coverage removed by the React SPA migration."""


# ===========================================================================
# test_zero_to_first_shot_flow — annotated ASGI + browser roadmap
# ===========================================================================


@pytest.mark.skip(reason="Legacy zero-to-first-shot HTMX coverage removed by SPA migration")
async def test_zero_to_first_shot_flow_asgi_steps() -> None:
    """Legacy HTMX workflow coverage removed by the React SPA migration."""


# ===========================================================================
# Real browser tests (Playwright) — require RUN_E2E_LIVE=1 + E2E_BASE_URL
# ===========================================================================

_LIVE = bool(os.environ.get("RUN_E2E_LIVE"))
_BASE_URL = os.environ.get("E2E_BASE_URL", "http://localhost:8000").rstrip("/")

_skip_no_live = pytest.mark.skipif(
    not _LIVE,
    reason="Set RUN_E2E_LIVE=1 and E2E_BASE_URL to run browser tests against a live server",
)


@_skip_no_live
def test_anonymous_root_routes_to_login_page(page) -> None:
    """[Browser] GET / with no auth lands on the SPA login page."""
    page.goto(_BASE_URL + "/")
    page.wait_for_load_state("networkidle")
    assert "/login" in page.url, f"Expected client-side redirect to /login, got: {page.url}"
    assert page.get_by_role("heading", name="Sign in").is_visible()


@_skip_no_live
def test_authenticated_dashboard_nav_visible(auth_page) -> None:
    """[Browser] Auth bootstrap loads the dashboard and sidebar navigation."""
    auth_page.goto(_BASE_URL + "/")
    auth_page.wait_for_load_state("networkidle")

    assert "/login" not in auth_page.url, "Auth bootstrap failed — still on login page"

    sidebar_text = auth_page.locator(".app-sidebar").text_content() or ""
    assert "Espresso" in sidebar_text, "Expected 'Espresso' brand text in sidebar"

    nav_links = auth_page.locator(".app-sidebar nav a")
    assert nav_links.count() > 0, "Expected nav links in sidebar"
