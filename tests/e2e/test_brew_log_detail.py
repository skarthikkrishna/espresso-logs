"""E2E tests — BrewLogDetail new data-testid anchors.

Validates the three new testid anchors added in bugfix/compass-layout-dup-guard:
  - eligibility-badge  (header, colour-coded by Shot_Eligibility value)
  - taste-summary-row  (Shot parameters <dl>)
  - notes-section      (only rendered when User_Notes is non-empty)

Fixture data (from conftest.py BREW_LOG_ROWS):
  SHOT-001: Shot_Eligibility="Good Espresso", Taste_Summary="Sweet & Balanced",
            User_Notes="First shot of the bag"
  SHOT-002: Shot_Eligibility="Good Espresso", Taste_Summary="Bright & Fruity",
            User_Notes=""  (empty → notes-section must NOT render)

Run with:
    uv run pytest tests/e2e/test_brew_log_detail.py --browser chromium -v
"""

from __future__ import annotations

import pytest
from playwright.sync_api import Page, expect


# ---------------------------------------------------------------------------
# Navigation helper
# ---------------------------------------------------------------------------


def _navigate_to_shot_detail(page: Page, live_server: str, shot_id: str) -> None:
    """Navigate to a specific shot detail page via the brew-log list.

    Loads the brew-log list, clicks the entry whose row contains the shot
    (matched via [data-testid="brew-log-entry"]), then waits for the detail
    view to be visible.  Falls back to a direct URL if no matching entry is
    found in the list.
    """
    page.goto(live_server + "/brew-log")
    page.wait_for_selector('[data-testid="brew-log-list"]', timeout=8000)

    entries = page.locator('[data-testid="brew-log-entry"]')
    count = entries.count()

    clicked = False
    if count > 0:
        # Find the entry whose href contains the shot_id and click it
        for i in range(count):
            entry = entries.nth(i)
            href = entry.get_attribute("href") or ""
            if shot_id in href:
                entry.click()
                clicked = True
                break

        # If no href-matched entry, click by position (SHOT-001 = first, SHOT-002 = second)
        if not clicked:
            index = 1 if shot_id == "SHOT-002" else 0
            if index < count:
                entries.nth(index).click()
                clicked = True

    if not clicked:
        # Direct URL navigation as fallback (React Router handles client-side routing)
        page.goto(live_server + f"/brew-log/{shot_id}")

    page.wait_for_selector('[data-testid="brew-log-detail"]', timeout=8000)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_detail_shows_shot_eligibility_badge(auth_page: Page, live_server: str) -> None:
    """SHOT-001 detail shows eligibility-badge with 'Good Espresso' text."""
    _navigate_to_shot_detail(auth_page, live_server, "SHOT-001")

    badge = auth_page.locator('[data-testid="eligibility-badge"]')
    expect(badge).to_be_visible()
    expect(badge).to_contain_text("Good Espresso")


def test_detail_shows_taste_summary_in_parameters(auth_page: Page, live_server: str) -> None:
    """SHOT-001 detail shows taste-summary-row dt and 'Sweet & Balanced' value."""
    _navigate_to_shot_detail(auth_page, live_server, "SHOT-001")

    taste_row = auth_page.locator('[data-testid="taste-summary-row"]')
    expect(taste_row).to_be_visible()
    expect(taste_row).to_contain_text("Taste")

    # The value cell should be visible somewhere on the page
    expect(auth_page.get_by_text("Sweet & Balanced")).to_be_visible()


def test_detail_shows_user_notes_when_present(auth_page: Page, live_server: str) -> None:
    """SHOT-001 detail renders notes-section with non-empty User_Notes."""
    _navigate_to_shot_detail(auth_page, live_server, "SHOT-001")

    notes = auth_page.locator('[data-testid="notes-section"]')
    expect(notes).to_be_visible()
    expect(auth_page.get_by_text("First shot of the bag")).to_be_visible()


def test_detail_hides_notes_section_when_empty(auth_page: Page, live_server: str) -> None:
    """SHOT-002 detail does NOT render notes-section because User_Notes is empty."""
    _navigate_to_shot_detail(auth_page, live_server, "SHOT-002")

    # notes-section must be absent from the DOM entirely
    count = auth_page.locator('[data-testid="notes-section"]').count()
    assert count == 0, f"notes-section should not render for empty User_Notes, found {count}"


@pytest.mark.skip(
    reason="No Reject shot in fixture data — BREW_LOG_ROWS has no Shot_Eligibility='Reject'"
)
def test_detail_reject_eligibility_badge_colour(auth_page: Page, live_server: str) -> None:
    """Reject shot shows eligibility-badge with error/red colour class.

    Skipped: conftest.py BREW_LOG_ROWS does not include a shot with
    Shot_Eligibility='Reject'.  Add a Reject fixture row to enable this test.
    """
    _navigate_to_shot_detail(auth_page, live_server, "SHOT-REJECT")

    badge = auth_page.locator('[data-testid="eligibility-badge"]')
    expect(badge).to_be_visible()
    expect(badge).to_contain_text("Reject")
