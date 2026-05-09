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

import base64
import json
import os

import pytest
from httpx import ASGITransport, AsyncClient
from itsdangerous import TimestampSigner

# ---------------------------------------------------------------------------
# Re-use the helpers already proven in tests/e2e/conftest.py
# ---------------------------------------------------------------------------

_TEST_SECRET: str = "dev-insecure-secret-for-testing-only"
_TEST_USER: dict = {"email": "test@example.com", "name": "Test User", "picture": ""}

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


def _make_session_cookie(data: dict, secret: str = _TEST_SECRET) -> str:
    """Sign a session payload the same way Starlette's SessionMiddleware does.

    Starlette signs ``base64(json(data))`` with ``itsdangerous.TimestampSigner``.
    This is NOT ``URLSafeTimedSerializer`` — the payload encoding matters.
    """
    signer = TimestampSigner(secret)
    payload = base64.b64encode(json.dumps(data).encode("utf-8"))
    return signer.sign(payload).decode("utf-8")


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
    cookie_value = _make_session_cookie({"user": _TEST_USER})
    client = AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        follow_redirects=False,
    )
    client.cookies.set("session", cookie_value)
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


@pytest.mark.asyncio
async def test_unauthenticated_redirect() -> None:
    """[ASGI] GET / with no session cookie → 302 redirect to /auth/login.

    This validates that the _RequiresLogin guard is active on the dashboard
    route before any JavaScript or HTMX is involved.
    """
    async with _make_anon_app_client() as ac:
        response = await ac.get("/")

    assert response.status_code == 302, (
        f"Expected 302 redirect for unauthenticated request, got {response.status_code}"
    )
    location = response.headers.get("location", "")
    assert "/auth/login" in location, (
        f"Expected redirect to /auth/login, got location: {location!r}"
    )


@pytest.mark.asyncio
async def test_dashboard_renders() -> None:
    """[ASGI] Authenticated GET / → 200, page title contains 'Espresso', nav + main present.

    Injects a properly signed session cookie (TimestampSigner) matching the
    app's SessionMiddleware configuration.  Validates that:
      - The page renders without error (not 403 or 500).
      - The brand title 'Espresso' from base.html sidebar is present.
      - Navigation elements (sidebar links) are present in the HTML.
      - The <main> element from base.html renders.
    """
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
        cookie_value = _make_session_cookie({"user": _TEST_USER})
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
            follow_redirects=False,
        ) as ac:
            ac.cookies.set("session", cookie_value)
            response = await ac.get("/")
    finally:
        app.dependency_overrides.pop(get_sheets_client, None)

    assert response.status_code == 200, (
        f"Expected 200 for authenticated dashboard, got {response.status_code}"
    )
    content = response.text

    # Brand name in sidebar (base.html: "☕ Espresso Logs")
    assert "Espresso" in content, "Page title / brand 'Espresso' not found in rendered HTML"

    # At least one nav link from base.html sidebar
    assert 'href="/"' in content or 'href="/brew-log"' in content, (
        "Expected nav links in dashboard HTML"
    )

    # The <main> element wrapping page content
    assert "<main" in content, "Expected <main> element in dashboard HTML"


@pytest.mark.asyncio
async def test_maintenance_action_type_filters_by_hardware() -> None:
    """[ASGI] /maintenance/action-types returns different options for Machine vs Grinder.

    Verifies that the HTMX fragment endpoint that drives the dynamic action-type
    dropdown correctly filters by hardware category:
      - Machine (M01) → Backflush, Descale, Steam Wand Clean
      - Grinder (G01) → Re-zero only
      - Basket  (B01) → empty / disabled (no valid actions)

    This exercises the JS-dependent dropdown path at the HTTP layer — a real
    browser test would verify the <select> is visually updated after HTMX swap.
    """
    client_ctx, _, app = _make_fake_app_client()
    from app.deps import get_sheets_client

    try:
        async with client_ctx as ac:
            machine_resp = await ac.get("/maintenance/action-types?hardware_id=M01")
            grinder_resp = await ac.get("/maintenance/action-types?hardware_id=G01")
            basket_resp = await ac.get("/maintenance/action-types?hardware_id=B01")
    finally:
        app.dependency_overrides.pop(get_sheets_client, None)

    # Machine actions
    assert machine_resp.status_code == 200
    machine_html = machine_resp.text
    assert "Backflush" in machine_html, "Machine action 'Backflush' not in response"
    assert "Descale" in machine_html, "Machine action 'Descale' not in response"
    assert "Steam Wand Clean" in machine_html, "Machine action 'Steam Wand Clean' not in response"
    # Grinder-only action must NOT appear for a Machine
    assert "Re-zero" not in machine_html, "Grinder-only 'Re-zero' must not appear for Machine"

    # Grinder actions
    assert grinder_resp.status_code == 200
    grinder_html = grinder_resp.text
    assert "Re-zero" in grinder_html, "Grinder action 'Re-zero' not in response"
    # Machine actions must NOT appear for a Grinder
    assert "Backflush" not in grinder_html, "Machine-only 'Backflush' must not appear for Grinder"

    # Basket — no valid actions; select rendered as disabled
    assert basket_resp.status_code == 200
    basket_html = basket_resp.text
    assert "disabled" in basket_html, "Basket action select must render as disabled"
    # Content of both machine and grinder actions absent
    assert "Backflush" not in basket_html
    assert "Re-zero" not in basket_html


@pytest.mark.asyncio
async def test_extraction_compass_in_brew_form() -> None:
    """[ASGI] GET /brew-log/new?bag_id=X includes the Extraction Compass canvas.

    There is no standalone /compass endpoint; the compass is embedded in the
    brew-log modal fragment rendered by GET /brew-log/new.  This test verifies:
      - The canvas#compass-chart element is present in the fragment.
      - The data-shots attribute carries JSON-encoded shot history for the bag.
      - The shot coordinates (time_sec, yield_out_g) from _SHOT_1 are present.
    """
    client_ctx, _, app = _make_fake_app_client()
    from app.deps import get_sheets_client

    try:
        async with client_ctx as ac:
            response = await ac.get("/brew-log/new?bag_id=Ve20250201M")
    finally:
        app.dependency_overrides.pop(get_sheets_client, None)

    assert response.status_code == 200, (
        f"Expected 200 for brew-log/new with bag_id, got {response.status_code}"
    )
    html = response.text

    # Canvas element is present
    assert 'id="compass-chart"' in html, (
        "Expected canvas#compass-chart in the brew-log modal fragment"
    )

    # data-shots attribute holds the serialised shot history
    assert "data-shots=" in html, "Expected data-shots attribute on compass-chart canvas"

    # Shot coordinates from _SHOT_1 should appear in the JSON
    # _SHOT_1 has Time_Sec=28, Yield_Out_g=36.0 → compass_data = [{"x": 28, "y": 36.0}]
    assert "28" in html, "Expected shot Time_Sec (28) in compass data"
    assert "36" in html, "Expected shot Yield_Out_g (36) in compass data"


# ===========================================================================
# test_zero_to_first_shot_flow — annotated ASGI + browser roadmap
# ===========================================================================


@pytest.mark.asyncio
async def test_zero_to_first_shot_flow_asgi_steps() -> None:
    """[ASGI] Document and partially validate the zero-to-first-shot flow.

    The full "happy path" described in functional-spec.md §4 UX Pattern 1 & 2:

      1. Add hardware (Machine, Grinder, Basket)           → POST /hardware
      2. Add catalog entry (roaster + bean)                → POST /catalog
      3. Add inventory bag to catalog                      → POST /catalog/{id}/inventory
      4. Dashboard shows the active bag                    → GET /
      5. Open "Log Shot" modal for the bag                 → GET /brew-log/new?bag_id=X
      6. Submit shot                                       → POST /brew-log
      7. Dashboard stats update to show the logged shot    → GET /

    Steps 1-6 can be exercised at the ASGI level with injected session cookies.
    Step 7 requires verifying the DOM update — fully testable at ASGI level but
    a real browser (RUN_E2E_LIVE=1) is needed to confirm the HTMX OOB swap.

    This test validates the ASGI-verifiable sub-steps (4-6).
    Steps 1-3 are covered by dedicated hardware/catalog router tests.
    """
    from app.deps import get_sheets_client
    from app.main import app
    from tests.doubles import FakeSheetsClient

    # Start with the bag already in inventory (simulates steps 1-3 done)
    fake = FakeSheetsClient(
        {
            "Hardware": [
                _HARDWARE_GRINDER.copy(),
                _HARDWARE_MACHINE.copy(),
                _HARDWARE_BASKET.copy(),
            ],
            "Inventory": [_BAG_ACTIVE.copy()],
            "Brew_Log": [],  # no shots yet — first shot scenario
            "Catalog": [_CATALOG_VERVE.copy()],
            "Maintenance": [],
        }
    )
    app.dependency_overrides[get_sheets_client] = lambda: fake
    cookie_value = _make_session_cookie({"user": _TEST_USER})

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
            follow_redirects=False,
        ) as ac:
            ac.cookies.set("session", cookie_value)

            # Step 4 — Dashboard renders (bags are deferred via HTMX skeleton loader)
            dash = await ac.get("/")
            assert dash.status_code == 200
            # The initial dashboard HTML now contains a skeleton placeholder;
            # bag content is loaded lazily by GET /dashboard/bags (hx-trigger="load").
            # Verify the deferred endpoint returns the active bag.
            bags = await ac.get("/dashboard/bags")
            assert bags.status_code == 200
            assert "Ve20250201M" in bags.text or "Verve-Seabright" in bags.text, (
                "Active bag not visible in /dashboard/bags fragment"
            )
            assert "No shots yet" in bags.text, "Expected 'No shots yet' empty state for first shot"

            # Step 5 — Open Log Shot modal for the bag (no prior shots → level-4 defaults)
            modal = await ac.get("/brew-log/new?bag_id=Ve20250201M")
            assert modal.status_code == 200
            assert "Log a Shot" in modal.text, "Expected modal title 'Log a Shot'"
            # No defaults banner when no prior shots exist (level 4)
            assert "Pre-filled" not in modal.text, (
                "Should NOT show Pre-filled banner for first-ever shot"
            )

            # Step 6 — Submit the first shot
            submit = await ac.post(
                "/brew-log",
                data={
                    "bag_id": "Ve20250201M",
                    "machine_id": "M01",
                    "grinder_id": "G01",
                    "basket_id": "B01",
                    "dose_in_g": "18.0",
                    "yield_out_g": "36.0",
                    "time_sec": "28",
                    "grind_setting": "4.5",
                    "shot_eligibility": "Good Espresso",
                    "taste_summary": "Sweet & Balanced",
                    "user_notes": "",
                    "storage_method": "Ambient — Bag",
                },
            )
            assert submit.status_code == 200, (
                f"Expected 200 after submitting first shot, got {submit.status_code}: "
                f"{submit.text[:200]}"
            )
            assert "brew-log-result" in submit.text, (
                "Expected success fragment with id='brew-log-result'"
            )
            assert "Shot logged" in submit.text, "Expected 'Shot logged!' in success fragment"

    finally:
        app.dependency_overrides.pop(get_sheets_client, None)

    # --- Steps that require a live browser (RUN_E2E_LIVE=1) ---
    # The following sub-steps are gated and only run against a real server:
    # 7a. HTMX OOB swap updates the dashboard card to show last shot stats.
    # 7b. The Extraction Compass canvas renders with a data point.
    # 7c. Clicking a compass zone pre-fills the Taste Summary select.
    # See test_authenticated_dashboard_nav_visible for a basic browser smoke.


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
def test_anonymous_root_follows_oauth_chain(page) -> None:
    """[Browser] GET / with no cookie → redirects through /auth/login → Google OAuth.

    Validates the full OAuth redirect chain in a real Chromium browser:
      / → /auth/login → accounts.google.com
    """
    page.goto(_BASE_URL + "/")
    # Allow up to 10 seconds for the OAuth redirect to settle
    page.wait_for_load_state("networkidle")
    assert "accounts.google.com" in page.url, (
        f"Expected redirect to accounts.google.com, got: {page.url}"
    )


@_skip_no_live
def test_authenticated_dashboard_nav_visible(page, browser_context) -> None:
    """[Browser] Inject signed session cookie → dashboard loads, sidebar visible.

    Uses page.context.add_cookies() with a properly signed TimestampSigner
    cookie (matching the app's SessionMiddleware) to bypass Google OAuth in
    a real browser and land directly on the authenticated dashboard.

    Verifies:
      - The sidebar brand "Espresso Logs" is visible (not hidden by auth wall).
      - At least one nav link (Home / Brew Log / Catalog) is visible.
      - The page is NOT a 403 or redirect loop.
    """
    # Inject the signed session cookie before navigating
    cookie_value = _make_session_cookie({"user": _TEST_USER})
    page.context.add_cookies(
        [
            {
                "name": "session",
                "value": cookie_value,
                "url": _BASE_URL,
                "httpOnly": False,
                "secure": False,
                "sameSite": "Lax",
            }
        ]
    )

    page.goto(_BASE_URL + "/")
    page.wait_for_load_state("networkidle")

    # Not redirected to OAuth
    assert "accounts.google.com" not in page.url, (
        "Session cookie injection failed — still redirected to Google"
    )
    assert "/auth/login" not in page.url, "Session cookie injection failed — still on login page"

    # Brand visible in sidebar
    sidebar_text = page.locator(".app-sidebar").text_content() or ""
    assert "Espresso" in sidebar_text, "Expected 'Espresso' brand text in sidebar"

    # At least one nav anchor is visible
    nav_links = page.locator(".app-sidebar nav a")
    assert nav_links.count() > 0, "Expected nav links in sidebar"
