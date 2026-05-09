"""E2E tests — cross-page navigation in various orders (React SPA, Phase 10).

Validates that navigating between pages in ANY order:
- Never duplicates or loses the sidebar
- Never shows a blank page
- Never leaks IDs into visible text
- Brew log shows names (bag_display) not IDs
- All nav links work correctly

Run with:
    uv run pytest tests/e2e/test_react_navigation.py --browser chromium -v
"""

from __future__ import annotations

import re

import pytest
from playwright.sync_api import Page

# All ID patterns that must NEVER appear in visible body text
_ALL_ID_PATTERNS = [
    re.compile(r"CAT\d{3}"),  # catalog IDs
    re.compile(r"BAG-[A-Z0-9]+"),  # bag IDs
    re.compile(r"HW-[A-Z0-9]+"),  # hardware IDs
    re.compile(r"SHOT-\d+"),  # shot IDs
    re.compile(r"MAINT-\d+"),  # maintenance IDs
]

_NAV_ROUTES = ["/", "/catalog", "/hardware", "/brew-log", "/import"]


def _body_text(page: Page) -> str:
    return page.locator("body").inner_text()


def _assert_no_ids(page: Page, context: str) -> None:
    text = _body_text(page)
    for pat in _ALL_ID_PATTERNS:
        hits = pat.findall(text)
        assert not hits, f"[{context}] Raw ID found in visible text: {hits[0]!r}"


def _assert_sidebar_once(page: Page, context: str) -> None:
    count = page.locator('[data-testid="sidebar"]').count()
    assert count == 1, f"[{context}] Sidebar count = {count} (expected 1)"


def _navigate_and_check(page: Page, live_server: str, path: str) -> None:
    """Navigate to path and do baseline checks."""
    page.goto(live_server + path)
    page.wait_for_load_state("networkidle")
    _assert_sidebar_once(page, f"after goto {path}")
    # Page must have visible content (not blank)
    text = _body_text(page).strip()
    assert len(text) > 10, f"Page {path} appears blank"
    _assert_no_ids(page, f"goto {path}")


def test_navigate_all_pages_forward(auth_page: Page, live_server: str) -> None:
    """Navigate every page in forward order — no blank pages, no ID leaks."""
    for path in _NAV_ROUTES:
        _navigate_and_check(auth_page, live_server, path)


def test_navigate_all_pages_reverse(auth_page: Page, live_server: str) -> None:
    """Navigate every page in reverse order — sidebar never lost."""
    for path in reversed(_NAV_ROUTES):
        _navigate_and_check(auth_page, live_server, path)


def test_navigate_random_order_1(auth_page: Page, live_server: str) -> None:
    """Navigate: hardware → brew-log → catalog → home → import."""
    for path in ["/hardware", "/brew-log", "/catalog", "/", "/import"]:
        _navigate_and_check(auth_page, live_server, path)


def test_navigate_random_order_2(auth_page: Page, live_server: str) -> None:
    """Navigate: catalog → hardware → brew-log → catalog/detail → brew-log → home."""
    auth_page.goto(live_server + "/catalog")
    auth_page.wait_for_selector('[data-testid="catalog-grid"]', timeout=8000)
    _assert_sidebar_once(auth_page, "catalog list")

    # Go to hardware
    auth_page.goto(live_server + "/hardware")
    auth_page.wait_for_selector('[data-testid="hardware-list"]', timeout=8000)
    _assert_sidebar_once(auth_page, "hardware")

    # Go to brew log
    auth_page.goto(live_server + "/brew-log")
    auth_page.wait_for_load_state("networkidle")
    _assert_sidebar_once(auth_page, "brew-log")
    _assert_no_ids(auth_page, "brew-log list")

    # Go to catalog detail
    auth_page.goto(live_server + "/catalog/CAT001")
    auth_page.wait_for_selector('[data-testid="catalog-detail"]', timeout=8000)
    _assert_sidebar_once(auth_page, "catalog detail")
    _assert_no_ids(auth_page, "catalog detail")

    # Back to brew log
    auth_page.goto(live_server + "/brew-log")
    auth_page.wait_for_load_state("networkidle")
    _assert_sidebar_once(auth_page, "brew-log 2nd visit")

    # Home
    auth_page.goto(live_server + "/")
    auth_page.wait_for_load_state("networkidle")
    _assert_sidebar_once(auth_page, "home after all")


def test_brew_log_shows_names_not_ids(auth_page: Page, live_server: str) -> None:
    """Brew log list must show bag_display names, never raw bag IDs."""
    auth_page.goto(live_server + "/brew-log")
    auth_page.wait_for_load_state("networkidle")
    _assert_no_ids(auth_page, "brew-log list")
    # Should show display names from our test data
    text = _body_text(auth_page)
    has_verve = "Verve Coffee" in text
    has_blue_bottle = "Blue Bottle" in text
    assert has_verve or has_blue_bottle, "Expected bag display names in brew log list"


def test_brew_log_detail_shows_names(auth_page: Page, live_server: str) -> None:
    """Brew log detail shows hardware names, not IDs."""
    auth_page.goto(live_server + "/brew-log")
    auth_page.wait_for_selector('[data-testid="brew-log-list"]', timeout=8000)
    entries = auth_page.locator('[data-testid="brew-log-entry"]')
    if entries.count() == 0:
        pytest.skip("No brew log entries in test data")
    entries.first.click()
    auth_page.wait_for_selector('[data-testid="brew-log-detail"]', timeout=8000)
    _assert_no_ids(auth_page, "brew-log detail")
    # Hardware names must be visible
    text = _body_text(auth_page)
    assert "Breville Barista Express" in text or "Niche Zero" in text, (
        "Expected hardware names in brew log detail"
    )


def test_brew_log_detail_back_link(auth_page: Page, live_server: str) -> None:
    """← Brew log back link returns to brew log list."""
    auth_page.goto(live_server + "/brew-log/SHOT-001")
    auth_page.wait_for_selector('[data-testid="brew-log-detail"]', timeout=8000)
    auth_page.get_by_text("← Back").click()
    auth_page.wait_for_selector('[data-testid="brew-log-list"]', timeout=6000)
    assert "/brew-log" in auth_page.url
    _assert_sidebar_once(auth_page, "after brew-log back")


def test_sidebar_nav_links_all_work(auth_page: Page, live_server: str) -> None:
    """Each sidebar nav link navigates to the correct page."""
    auth_page.goto(live_server + "/")
    auth_page.wait_for_selector('[data-testid="sidebar"]', timeout=6000)
    nav_items = [
        ("Brew log", "/brew-log"),
        ("Catalog", "/catalog"),
        ("Hardware", "/hardware"),
        ("Import", "/import"),
    ]
    for label, expected_path in nav_items:
        auth_page.goto(live_server + "/")  # reset to home
        auth_page.wait_for_load_state("networkidle")
        # Click via sidebar nav link text
        auth_page.locator('[data-testid="sidebar"]').get_by_text(label, exact=True).click()
        auth_page.wait_for_load_state("networkidle")
        assert expected_path in auth_page.url, (
            f"Sidebar '{label}' click: expected {expected_path} in URL, got {auth_page.url}"
        )
        _assert_sidebar_once(auth_page, f"sidebar nav to {label}")
