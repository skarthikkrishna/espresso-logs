"""E2E tests — hardware card navigation (React SPA, Phase 10).

Validates:
- Hardware list renders cards grouped by category
- Clicking a card updates the right detail panel
- URL does NOT change on card click (key Phase 10 requirement)
- Detail panel shows hardware name, NEVER hardware_id
- Sidebar persists through all hardware interactions

Run with:
    uv run pytest tests/e2e/test_hardware_nav.py --browser chromium -v
"""

from __future__ import annotations

import re

import pytest
from playwright.sync_api import Page, expect

_HW_ID_PATTERN = re.compile(r"HW-[A-Z0-9]+")


def _assert_no_hw_ids(page: Page, label: str) -> None:
    text = page.locator("body").inner_text()
    matches = _HW_ID_PATTERN.findall(text)
    assert not matches, f"{label}: raw hardware ID {matches[0]!r} found in visible page text"


def test_hardware_list_renders(auth_page: Page, live_server: str) -> None:
    """Hardware page loads and shows hardware card buttons."""
    auth_page.goto(live_server + "/hardware")
    auth_page.wait_for_selector('[data-testid="hardware-list"]', timeout=8000)
    cards = auth_page.locator('[data-testid="hardware-card"]')
    assert cards.count() >= 1, "Expected at least 1 hardware card"


def test_hardware_detail_panel_starts_empty(auth_page: Page, live_server: str) -> None:
    """Right panel shows placeholder text before any card is clicked."""
    auth_page.goto(live_server + "/hardware")
    auth_page.wait_for_selector('[data-testid="hardware-detail-panel"]', timeout=8000)
    expect(auth_page.get_by_text("Select a piece of hardware to see details")).to_be_visible()


def test_hardware_card_click_updates_panel(auth_page: Page, live_server: str) -> None:
    """Clicking a hardware card shows its name in the detail panel."""
    auth_page.goto(live_server + "/hardware")
    auth_page.wait_for_selector('[data-testid="hardware-card"]', timeout=8000)
    auth_page.locator('[data-testid="hardware-card"]').first.click()
    # Detail panel must now show hardware name
    panel = auth_page.locator('[data-testid="hardware-detail-panel"]')
    panel.wait_for(state="visible", timeout=6000)
    text = panel.inner_text()
    assert text.strip() != "", "Detail panel empty after hardware card click"
    # Must show the actual hardware name (Breville Barista Express is first Machine)
    expect(auth_page.get_by_text("Breville Barista Express")).to_be_visible()


def test_hardware_card_click_does_not_change_url(auth_page: Page, live_server: str) -> None:
    """Clicking a hardware card must NOT change the URL (key Phase 10 requirement)."""
    auth_page.goto(live_server + "/hardware")
    auth_page.wait_for_selector('[data-testid="hardware-card"]', timeout=8000)
    url_before = auth_page.url
    auth_page.locator('[data-testid="hardware-card"]').first.click()
    auth_page.wait_for_timeout(500)  # brief wait for any potential navigation
    assert auth_page.url == url_before, (
        f"URL changed after hardware card click: {url_before!r} → {auth_page.url!r}"
    )


def test_hardware_detail_shows_no_ids(auth_page: Page, live_server: str) -> None:
    """Hardware detail panel must never show raw hardware IDs."""
    auth_page.goto(live_server + "/hardware")
    auth_page.wait_for_selector('[data-testid="hardware-card"]', timeout=8000)
    auth_page.locator('[data-testid="hardware-card"]').first.click()
    auth_page.locator('[data-testid="hardware-detail-panel"]').wait_for(
        state="visible", timeout=6000
    )
    _assert_no_hw_ids(auth_page, "HardwareDetail")


def test_hardware_second_card_click_updates_panel(auth_page: Page, live_server: str) -> None:
    """Clicking a second card updates the panel (crossfade / re-render)."""
    auth_page.goto(live_server + "/hardware")
    auth_page.wait_for_selector('[data-testid="hardware-card"]', timeout=8000)
    cards = auth_page.locator('[data-testid="hardware-card"]')
    if cards.count() < 2:
        pytest.skip("Need at least 2 hardware cards for this test")
    # Click first card
    cards.first.click()
    auth_page.wait_for_timeout(300)
    first_text = auth_page.locator('[data-testid="hardware-detail-panel"]').inner_text()
    # Click second card
    cards.nth(1).click()
    auth_page.wait_for_timeout(500)
    second_text = auth_page.locator('[data-testid="hardware-detail-panel"]').inner_text()
    assert first_text != second_text, "Panel text unchanged after clicking second hardware card"
    # Still on /hardware URL
    assert auth_page.url.endswith("/hardware"), f"URL drifted: {auth_page.url}"


def test_sidebar_persists_on_hardware_page(auth_page: Page, live_server: str) -> None:
    """Sidebar is in DOM before and after hardware card interactions."""
    auth_page.goto(live_server + "/hardware")
    auth_page.wait_for_selector('[data-testid="sidebar"]', timeout=6000)
    # Click a card
    auth_page.locator('[data-testid="hardware-card"]').first.click()
    auth_page.wait_for_timeout(500)
    assert auth_page.locator('[data-testid="sidebar"]').count() == 1, (
        "Sidebar disappeared after hardware card click"
    )
