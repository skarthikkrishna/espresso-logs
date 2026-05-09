"""E2E tests — catalog navigation (React SPA, Phase 10).

Validates:
- Catalog grid renders cards with bean names (not IDs)
- Clicking a card navigates to /catalog/{id} and shows detail
- Detail page shows roaster + bean name, NEVER catalog_id/bag_id text
- Back link returns to catalog list
- Sidebar is visible throughout (never unmounts)

Run with:
    uv run pytest tests/e2e/test_catalog_nav.py --browser chromium -v
"""

from __future__ import annotations

import re

import pytest
from playwright.sync_api import Page, expect

# Patterns that must NEVER appear in visible text
_ID_PATTERNS = [re.compile(r"CAT\d{3}"), re.compile(r"BAG-[A-Z0-9]+")]


def _assert_no_ids(page: Page, label: str) -> None:
    text = page.locator("body").inner_text()
    for pat in _ID_PATTERNS:
        matches = pat.findall(text)
        assert not matches, f"{label}: raw ID {matches[0]!r} found in visible page text"


def test_catalog_grid_renders(auth_page: Page, live_server: str) -> None:
    """Catalog page loads and shows a grid of bean cards."""
    auth_page.goto(live_server + "/catalog")
    auth_page.wait_for_selector('[data-testid="catalog-grid"]', timeout=8000)
    cards = auth_page.locator('[data-testid="catalog-grid"] a')
    assert cards.count() >= 2, "Expected at least 2 catalog cards"


def test_catalog_shows_bean_names_not_ids(auth_page: Page, live_server: str) -> None:
    """Catalog list must show roaster/bean names, never raw catalog IDs."""
    auth_page.goto(live_server + "/catalog")
    auth_page.wait_for_selector('[data-testid="catalog-grid"]', timeout=8000)
    _assert_no_ids(auth_page, "CatalogList")
    # Confirm actual names are present
    expect(auth_page.get_by_text("Seabright")).to_be_visible()
    expect(auth_page.get_by_text("Verve Coffee")).to_be_visible()


def test_catalog_card_click_navigates_to_detail(auth_page: Page, live_server: str) -> None:
    """Clicking a catalog card navigates to /catalog/{id} and shows detail."""
    auth_page.goto(live_server + "/catalog")
    auth_page.wait_for_selector('[data-testid="catalog-grid"]', timeout=8000)
    # Click the first card
    auth_page.locator('[data-testid="catalog-grid"] a').first.click()
    auth_page.wait_for_selector('[data-testid="catalog-detail"]', timeout=8000)
    # URL must have changed to /catalog/...
    assert "/catalog/" in auth_page.url, f"Expected /catalog/... URL, got {auth_page.url}"
    # Detail page must NOT show raw catalog ID or bag ID in visible text
    _assert_no_ids(auth_page, "CatalogDetail")


def test_catalog_detail_shows_bean_and_roaster(auth_page: Page, live_server: str) -> None:
    """Catalog detail shows bean name (h1) and roaster prominently."""
    auth_page.goto(live_server + "/catalog/CAT001")
    auth_page.wait_for_selector('[data-testid="catalog-detail"]', timeout=8000)
    # Use role-based locators to avoid strict-mode ambiguity when display_name
    # also contains the bean name (e.g. "Verve Coffee — Seabright" in bags list).
    expect(auth_page.get_by_role("heading", name="Seabright", exact=True, level=1)).to_be_visible()
    expect(auth_page.get_by_text("Verve Coffee", exact=True).first).to_be_visible()
    _assert_no_ids(auth_page, "CatalogDetail direct")


def test_catalog_back_link_returns_to_list(auth_page: Page, live_server: str) -> None:
    """← Catalog back link returns to list without full page reload."""
    auth_page.goto(live_server + "/catalog/CAT001")
    auth_page.wait_for_selector('[data-testid="catalog-detail"]', timeout=8000)
    auth_page.get_by_text("← Back").click()
    auth_page.wait_for_selector('[data-testid="catalog-grid"]', timeout=6000)
    assert auth_page.url.rstrip("/").endswith("/catalog"), f"Expected /catalog URL, got {auth_page.url}"


def test_sidebar_persists_on_catalog_navigation(auth_page: Page, live_server: str) -> None:
    """Sidebar must be in the DOM at every step of catalog navigation (no ghost defect)."""
    auth_page.goto(live_server + "/catalog")
    auth_page.wait_for_selector('[data-testid="sidebar"]', timeout=6000)

    # Navigate to detail
    auth_page.locator('[data-testid="catalog-grid"] a').first.click()
    auth_page.wait_for_selector('[data-testid="catalog-detail"]', timeout=8000)
    sidebar_count = auth_page.locator('[data-testid="sidebar"]').count()
    assert sidebar_count == 1, f"Sidebar count after detail nav: {sidebar_count} (expected 1)"

    # Navigate back to list
    auth_page.get_by_text("← Back").click()
    auth_page.wait_for_selector('[data-testid="catalog-grid"]', timeout=6000)
    sidebar_count = auth_page.locator('[data-testid="sidebar"]').count()
    assert sidebar_count == 1, f"Sidebar count after back nav: {sidebar_count} (expected 1)"
