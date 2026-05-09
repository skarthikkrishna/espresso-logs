"""E2E tests — sentence case and ID display policy (React SPA, Phase 10).

Validates §7.1 (ID display) and §7.2 (sentence case) across all pages.

Run with:
    uv run pytest tests/e2e/test_react_sentence_case.py --browser chromium -v
"""

from __future__ import annotations

import re

from playwright.sync_api import Page

# Known Title Case strings that must NOT appear in visible UI
_TITLE_CASE_VIOLATIONS = [
    "Brew Log",  # must be "Brew log"
    "Add Shot",  # must be "Add shot"
    "Brew Date",  # must be "Brew date"
    "Roast Level",  # must be "Roast level"
    "Shot Parameters",  # must be "Shot parameters"
    "Brew History",  # must be "Brew history"
    "Maintenance Log",  # must be "Maintenance log"
]

# All raw ID patterns
_ID_PATTERNS = [
    re.compile(r"\bCAT\d{3}\b"),
    re.compile(r"\bBAG-[A-Z0-9]+\b"),
    re.compile(r"\bHW-[A-Z0-9]+\b"),
    re.compile(r"\bSHOT-\d+\b"),
    re.compile(r"\bMAINT-\d+\b"),
]

# Pages to check
_PAGES = [
    ("/", "Home"),
    ("/catalog", "Catalog"),
    ("/hardware", "Hardware"),
    ("/brew-log", "Brew log"),
    ("/import", "Import"),
]


def _get_visible_text(page: Page) -> str:
    return page.locator("body").inner_text()


def test_no_title_case_on_home(auth_page: Page, live_server: str) -> None:
    auth_page.goto(live_server + "/")
    auth_page.wait_for_load_state("networkidle")
    text = _get_visible_text(auth_page)
    for violation in _TITLE_CASE_VIOLATIONS:
        assert violation not in text, f"Title Case violation on Home: {violation!r}"


def test_no_title_case_on_catalog(auth_page: Page, live_server: str) -> None:
    auth_page.goto(live_server + "/catalog")
    auth_page.wait_for_load_state("networkidle")
    text = _get_visible_text(auth_page)
    for violation in _TITLE_CASE_VIOLATIONS:
        assert violation not in text, f"Title Case violation on Catalog: {violation!r}"


def test_no_title_case_on_hardware(auth_page: Page, live_server: str) -> None:
    auth_page.goto(live_server + "/hardware")
    auth_page.wait_for_load_state("networkidle")
    text = _get_visible_text(auth_page)
    for violation in _TITLE_CASE_VIOLATIONS:
        assert violation not in text, f"Title Case violation on Hardware: {violation!r}"


def test_no_title_case_on_brew_log(auth_page: Page, live_server: str) -> None:
    auth_page.goto(live_server + "/brew-log")
    auth_page.wait_for_load_state("networkidle")
    text = _get_visible_text(auth_page)
    for violation in _TITLE_CASE_VIOLATIONS:
        assert violation not in text, f"Title Case violation on Brew log: {violation!r}"


def test_nav_labels_are_sentence_case(auth_page: Page, live_server: str) -> None:
    """Sidebar nav labels must match exactly: Home, Brew log, Catalog, Hardware, Import."""
    auth_page.goto(live_server + "/")
    auth_page.wait_for_selector('[data-testid="sidebar"]', timeout=6000)
    sidebar = auth_page.locator('[data-testid="sidebar"]')
    expected_labels = ["Home", "Brew log", "Catalog", "Hardware", "Import"]
    for label in expected_labels:
        assert sidebar.get_by_text(label, exact=True).count() >= 1, (
            f"Nav label {label!r} not found in sidebar (wrong case?)"
        )


def test_no_ids_on_any_page(auth_page: Page, live_server: str) -> None:
    """No raw IDs visible on any page."""
    for path, name in _PAGES:
        auth_page.goto(live_server + path)
        auth_page.wait_for_load_state("networkidle")
        text = _get_visible_text(auth_page)
        for pat in _ID_PATTERNS:
            hits = pat.findall(text)
            assert not hits, f"[{name}] Raw ID in visible text: {hits[0]!r}"


def test_no_ids_on_brew_log_detail(auth_page: Page, live_server: str) -> None:
    """Brew log detail must not expose any raw IDs."""
    auth_page.goto(live_server + "/brew-log/SHOT-001")
    auth_page.wait_for_selector('[data-testid="brew-log-detail"]', timeout=8000)
    text = _get_visible_text(auth_page)
    for pat in _ID_PATTERNS:
        hits = pat.findall(text)
        assert not hits, f"[BrewLogDetail] Raw ID in visible text: {hits[0]!r}"


def test_no_ids_on_catalog_detail(auth_page: Page, live_server: str) -> None:
    """Catalog detail must not expose catalog_id, bag_id in visible text."""
    auth_page.goto(live_server + "/catalog/CAT001")
    auth_page.wait_for_selector('[data-testid="catalog-detail"]', timeout=8000)
    text = _get_visible_text(auth_page)
    for pat in _ID_PATTERNS:
        hits = pat.findall(text)
        assert not hits, f"[CatalogDetail] Raw ID in visible text: {hits[0]!r}"


def test_brew_log_heading_sentence_case(auth_page: Page, live_server: str) -> None:
    """Brew log heading must be 'Brew log' not 'Brew Log'."""
    auth_page.goto(live_server + "/brew-log")
    auth_page.wait_for_load_state("networkidle")
    # h1 text must be "Brew log"
    h1 = auth_page.locator("h1").first
    text = h1.inner_text().strip()
    assert text == "Brew log", f"h1 on brew log page: {text!r} (expected 'Brew log')"
