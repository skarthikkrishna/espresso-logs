"""Phase 15 UI smoke tests — verify no page-title-bar, correct back labels, nav stack."""
import pytest
from playwright.sync_api import Page, expect


@pytest.mark.parametrize("path", ["/brew-log", "/catalog", "/hardware", "/import"])
def test_no_page_title_bar_on_section_pages(page: Page, base_url: str, path: str) -> None:
    """FR-B-001: .page-title-bar must not appear on any section page."""
    page.goto(f"{base_url}{path}")
    page.wait_for_load_state("networkidle")
    count = page.locator('[class*="page-title-bar"]').count()
    assert count == 0, f"{path}: found {count} page-title-bar elements; expected 0"


@pytest.mark.parametrize("detail_path,testid", [
    ("/brew-log", "brew-log-detail"),
    ("/catalog", "catalog-detail"),
])
def test_detail_back_link_reads_back(page: Page, base_url: str, detail_path: str, testid: str) -> None:
    """FR-B-006: Detail view back links must read '← Back' not the section name."""
    # Navigate to list, click first item
    page.goto(f"{base_url}{detail_path}")
    page.wait_for_load_state("networkidle")
    first_link = page.locator(f'a[href*="{detail_path}/"]').first
    if first_link.count() == 0:
        pytest.skip(f"No items in {detail_path} to navigate to")
    first_link.click()
    page.wait_for_selector(f'[data-testid="{testid}"]', timeout=8000)
    # Back link must say "← Back"
    back = page.get_by_text("← Back")
    expect(back).to_be_visible()
    # Must NOT say section name
    assert page.get_by_text("← Brew log").count() == 0
    assert page.get_by_text("← Catalog").count() == 0


def test_catalog_to_brew_back_preserves_catalog_context(page: Page, base_url: str) -> None:
    """FR-B-007/008: Catalog→BrewDetail→Back must return to CatalogDetail, not /brew-log."""
    page.goto(f"{base_url}/catalog")
    page.wait_for_selector('[data-testid="catalog-grid"]', timeout=8000)
    page.locator('[data-testid="catalog-grid"] a').first.click()
    page.wait_for_selector('[data-testid="catalog-detail"]', timeout=8000)
    catalog_detail_url = page.url

    brew_link = page.locator('[data-testid="catalog-detail"] a[href*="/brew-log/"]').first
    if brew_link.count() == 0:
        pytest.skip("No recent shots on this catalog item — cannot test nav stack")
    brew_link.click()
    page.wait_for_selector('[data-testid="brew-log-detail"]', timeout=8000)
    assert "back=" in page.url, "Expected ?back= param in brew detail URL after clicking from catalog"

    page.get_by_text("← Back").click()
    page.wait_for_load_state("networkidle")
    assert page.url == catalog_detail_url, \
        f"Expected return to {catalog_detail_url!r}; got {page.url!r}"


def test_section_pages_have_visible_h1(page: Page, base_url: str) -> None:
    """FR-B-002: Each section page must render a visible <h1> section heading."""
    for path, expected_text in [
        ("/brew-log", "Brew log"),
        ("/catalog", "Catalog"),
        ("/hardware", "Hardware"),
        ("/import", "Import"),
    ]:
        page.goto(f"{base_url}{path}")
        page.wait_for_load_state("networkidle")
        h1 = page.locator("h1").filter(has_text=expected_text)
        assert h1.count() >= 1, f"{path}: no visible <h1> with text '{expected_text}'"
        # Must NOT have sr-only class (which makes it invisible)
        classes = h1.first.get_attribute("class") or ""
        assert "sr-only" not in classes, f"{path}: h1 has sr-only class — heading is invisible"
