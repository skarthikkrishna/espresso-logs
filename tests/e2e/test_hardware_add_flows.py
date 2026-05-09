"""E2E tests — hardware add flows (spec 019).

Validates:
1. Add Hardware modal — per-category "+ Add" button opens modal; form
   validation (Save disabled without name/category); save creates item;
   new item auto-selected in detail panel.
2. Hardware empty state — when no items exist the empty-state CTA renders
   and its "Add hardware" button opens the modal.
3. Log Maintenance modal — button appears for Machine/Grinder; is absent for
   Basket/Storage; action-type dropdown is filtered by category.
4. Edit Hardware modal — EDIT button opens a pre-filled rename modal; saving
   updates the list without a page reload.
5. Cache invalidation — after each mutation the list/detail panel reflects
   the change without a full page reload (React Query invalidation).

Run with:
    uv run pytest tests/e2e/test_hardware_add_flows.py --browser chromium -v

Note on test isolation: the live_server fixture is session-scoped and its
FakeSheetsClient retains mutations across tests.  Non-mutating tests are
ordered first; mutating tests choose names that cannot collide with fixture
data or each other.
"""

from __future__ import annotations

import json

from playwright.sync_api import Page, Route, expect


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _go_hardware(page: Page, base: str) -> None:
    """Navigate to /hardware and wait for the list panel to be ready."""
    page.goto(base + "/hardware")
    page.wait_for_selector('[data-testid="hardware-list"]', timeout=8000)


def _intercept_hardware_list_empty(page: Page) -> None:
    """Intercept GET /api/hardware (list only) and return an empty array."""

    def _handler(route: Route) -> None:
        url = route.request.url.rstrip("/")
        # Only intercept the flat list endpoint, not sub-paths like action-types
        if url.endswith("/api/hardware") and route.request.method == "GET":
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps([]),
            )
        else:
            route.continue_()

    page.route("**/api/**", _handler)


# ---------------------------------------------------------------------------
# 1. Add Hardware modal — opening and form validation (non-mutating)
# ---------------------------------------------------------------------------


def test_add_hardware_per_category_button_opens_modal(auth_page: Page, live_server: str) -> None:
    """Clicking the per-category '+ Add' button opens the Add Hardware modal."""
    _go_hardware(auth_page, live_server)
    auth_page.get_by_label("Add Machine").click()
    expect(auth_page.get_by_role("heading", name="Add hardware")).to_be_visible()


def test_add_hardware_category_prepopulated(auth_page: Page, live_server: str) -> None:
    """Opening the modal via '+ Add Machine' pre-selects Machine in the category dropdown."""
    _go_hardware(auth_page, live_server)
    auth_page.get_by_label("Add Machine").click()
    expect(auth_page.get_by_role("heading", name="Add hardware")).to_be_visible()
    # The first (and only) select in the modal should show "Machine"
    category_select = auth_page.locator(".modal select").first
    expect(category_select).to_have_value("Machine")


def test_add_hardware_grinder_category_prepopulated(auth_page: Page, live_server: str) -> None:
    """Opening the modal via '+ Add Grinder' pre-selects Grinder."""
    _go_hardware(auth_page, live_server)
    auth_page.get_by_label("Add Grinder").click()
    expect(auth_page.get_by_role("heading", name="Add hardware")).to_be_visible()
    category_select = auth_page.locator(".modal select").first
    expect(category_select).to_have_value("Grinder")


def test_add_hardware_save_disabled_without_name(auth_page: Page, live_server: str) -> None:
    """Save button is disabled when category is chosen but the name field is empty."""
    _go_hardware(auth_page, live_server)
    auth_page.get_by_label("Add Machine").click()
    expect(auth_page.get_by_role("heading", name="Add hardware")).to_be_visible()
    # Category is pre-filled, but name is empty → Save must be disabled
    save_btn = auth_page.get_by_role("button", name="Save hardware")
    expect(save_btn).to_be_disabled()


def test_add_hardware_save_disabled_without_category(auth_page: Page, live_server: str) -> None:
    """Save button is disabled when a name is entered but no category is chosen."""
    _go_hardware(auth_page, live_server)
    auth_page.get_by_label("Add Basket").click()
    expect(auth_page.get_by_role("heading", name="Add hardware")).to_be_visible()
    # Reset category to the blank placeholder
    auth_page.locator(".modal select").first.select_option("")
    # Fill name
    auth_page.locator(".modal input[type='text']").fill("Test Item")
    save_btn = auth_page.get_by_role("button", name="Save hardware")
    expect(save_btn).to_be_disabled()


def test_add_hardware_cancel_closes_modal(auth_page: Page, live_server: str) -> None:
    """Cancel button dismisses the Add Hardware modal."""
    _go_hardware(auth_page, live_server)
    auth_page.get_by_label("Add Machine").click()
    expect(auth_page.get_by_role("heading", name="Add hardware")).to_be_visible()
    auth_page.get_by_role("button", name="Cancel").click()
    expect(auth_page.get_by_role("heading", name="Add hardware")).not_to_be_visible()


# ---------------------------------------------------------------------------
# 2. Hardware empty state (non-mutating — uses route interception)
# ---------------------------------------------------------------------------


def test_hardware_empty_state_cta_renders(auth_page: Page, live_server: str) -> None:
    """When no hardware exists the empty-state message and CTA button are shown."""
    _intercept_hardware_list_empty(auth_page)
    auth_page.goto(live_server + "/hardware")
    # Wait for the empty state — no hardware-list spinner, just the empty card
    auth_page.wait_for_timeout(1000)
    expect(auth_page.get_by_text("No hardware added yet")).to_be_visible(timeout=6000)
    expect(auth_page.get_by_role("button", name="Add hardware")).to_be_visible()


def test_hardware_empty_state_cta_opens_add_modal(auth_page: Page, live_server: str) -> None:
    """The empty-state 'Add hardware' CTA opens the Add Hardware modal."""
    _intercept_hardware_list_empty(auth_page)
    auth_page.goto(live_server + "/hardware")
    auth_page.wait_for_timeout(1000)
    auth_page.get_by_role("button", name="Add hardware").click()
    expect(auth_page.get_by_role("heading", name="Add hardware")).to_be_visible()


# ---------------------------------------------------------------------------
# 3. Log Maintenance modal (non-mutating — only opens/closes the modal)
# ---------------------------------------------------------------------------


def test_log_maintenance_button_visible_for_machine(auth_page: Page, live_server: str) -> None:
    """'Log maintenance' button appears in the Machine detail panel."""
    _go_hardware(auth_page, live_server)
    auth_page.get_by_text("Breville Barista Express").first.click()
    panel = auth_page.locator('[data-testid="hardware-detail-panel"]')
    panel.wait_for(state="visible", timeout=6000)
    expect(panel.get_by_role("button", name="Log maintenance")).to_be_visible(timeout=6000)


def test_log_maintenance_button_visible_for_grinder(auth_page: Page, live_server: str) -> None:
    """'Log maintenance' button appears in the Grinder detail panel."""
    _go_hardware(auth_page, live_server)
    auth_page.get_by_text("Niche Zero").first.click()
    panel = auth_page.locator('[data-testid="hardware-detail-panel"]')
    panel.wait_for(state="visible", timeout=6000)
    expect(panel.get_by_role("button", name="Log maintenance")).to_be_visible(timeout=6000)


def test_log_maintenance_button_absent_for_basket(auth_page: Page, live_server: str) -> None:
    """'Log maintenance' button is NOT present in the Basket detail panel."""
    _go_hardware(auth_page, live_server)
    auth_page.get_by_text("IMS 20g").first.click()
    panel = auth_page.locator('[data-testid="hardware-detail-panel"]')
    panel.wait_for(state="visible", timeout=6000)
    auth_page.wait_for_timeout(500)
    btn_count = panel.get_by_role("button", name="Log maintenance").count()
    assert btn_count == 0, "Log maintenance button must not appear for Basket category"


def test_log_maintenance_modal_opens_for_machine(auth_page: Page, live_server: str) -> None:
    """Clicking 'Log maintenance' for a Machine opens the modal."""
    _go_hardware(auth_page, live_server)
    auth_page.get_by_text("Breville Barista Express").first.click()
    panel = auth_page.locator('[data-testid="hardware-detail-panel"]')
    panel.wait_for(state="visible", timeout=6000)
    panel.get_by_role("button", name="Log maintenance").click()
    expect(auth_page.get_by_role("heading", name="Log maintenance")).to_be_visible()
    # Dismiss
    auth_page.get_by_role("button", name="Cancel").click()


def test_log_maintenance_action_types_machine(auth_page: Page, live_server: str) -> None:
    """Machine action-type dropdown includes Backflush/Descale and excludes Re-zero."""
    _go_hardware(auth_page, live_server)
    auth_page.get_by_text("Breville Barista Express").first.click()
    panel = auth_page.locator('[data-testid="hardware-detail-panel"]')
    panel.wait_for(state="visible", timeout=6000)
    panel.get_by_role("button", name="Log maintenance").click()
    expect(auth_page.get_by_role("heading", name="Log maintenance")).to_be_visible()

    # Wait for action types to load from /api/hardware/action-types
    auth_page.wait_for_timeout(1000)

    action_select = auth_page.locator(".modal select")
    html = action_select.inner_html()
    assert "Backflush" in html, "Backflush must be in Machine action types"
    assert "Descale" in html, "Descale must be in Machine action types"
    assert "Steam Wand Clean" in html, "Steam Wand Clean must be in Machine action types"
    assert "Re-zero" not in html, "Re-zero is Grinder-only — must not appear for Machine"

    auth_page.get_by_role("button", name="Cancel").click()


def test_log_maintenance_action_types_grinder(auth_page: Page, live_server: str) -> None:
    """Grinder action-type dropdown includes Re-zero and excludes Machine actions."""
    _go_hardware(auth_page, live_server)
    auth_page.get_by_text("Niche Zero").first.click()
    panel = auth_page.locator('[data-testid="hardware-detail-panel"]')
    panel.wait_for(state="visible", timeout=6000)
    panel.get_by_role("button", name="Log maintenance").click()
    expect(auth_page.get_by_role("heading", name="Log maintenance")).to_be_visible()

    auth_page.wait_for_timeout(1000)

    action_select = auth_page.locator(".modal select")
    html = action_select.inner_html()
    assert "Re-zero" in html, "Re-zero must be in Grinder action types"
    assert "Backflush" not in html, "Backflush is Machine-only — must not appear for Grinder"
    assert "Descale" not in html, "Descale is Machine-only — must not appear for Grinder"

    auth_page.get_by_role("button", name="Cancel").click()


# ---------------------------------------------------------------------------
# 4. Edit Hardware modal (non-mutating path: open, verify pre-fill, cancel)
# ---------------------------------------------------------------------------


def test_edit_hardware_button_opens_modal(auth_page: Page, live_server: str) -> None:
    """The EDIT button on a hardware card opens the Edit Hardware modal."""
    _go_hardware(auth_page, live_server)
    auth_page.locator('[data-testid="hardware-card"]').first.get_by_text("EDIT").click()
    expect(auth_page.get_by_role("heading", name="Edit hardware")).to_be_visible()


def test_edit_hardware_modal_prefilled_with_current_name(auth_page: Page, live_server: str) -> None:
    """The Edit modal name field is pre-filled with the current hardware name."""
    _go_hardware(auth_page, live_server)
    first_card = auth_page.locator('[data-testid="hardware-card"]').first
    # Capture the name shown in the card
    card_name = first_card.locator("h3").inner_text().strip()

    first_card.get_by_text("EDIT").click()
    expect(auth_page.get_by_role("heading", name="Edit hardware")).to_be_visible()

    name_input = auth_page.locator(".modal input[type='text']")
    assert name_input.input_value() == card_name, (
        f"Edit modal should pre-fill {card_name!r}, got {name_input.input_value()!r}"
    )
    auth_page.get_by_role("button", name="Cancel").click()


def test_edit_hardware_save_disabled_with_empty_name(auth_page: Page, live_server: str) -> None:
    """Save changes button is disabled when the name field is cleared."""
    _go_hardware(auth_page, live_server)
    auth_page.locator('[data-testid="hardware-card"]').first.get_by_text("EDIT").click()
    expect(auth_page.get_by_role("heading", name="Edit hardware")).to_be_visible()
    auth_page.locator(".modal input[type='text']").fill("")
    save_btn = auth_page.get_by_role("button", name="Save changes")
    expect(save_btn).to_be_disabled()
    auth_page.get_by_role("button", name="Cancel").click()


# ---------------------------------------------------------------------------
# 5. Mutating tests — cache invalidation after add/edit
# (These run last to avoid polluting earlier read-path assertions.)
# ---------------------------------------------------------------------------


def test_add_hardware_creates_item_and_auto_selects(auth_page: Page, live_server: str) -> None:
    """Saving a new item creates it, closes the modal, and auto-selects it in the panel."""
    _go_hardware(auth_page, live_server)
    count_before = auth_page.locator('[data-testid="hardware-card"]').count()

    auth_page.get_by_label("Add Grinder").click()
    expect(auth_page.get_by_role("heading", name="Add hardware")).to_be_visible()
    auth_page.locator(".modal input[type='text']").fill("Comandante C40")
    auth_page.get_by_role("button", name="Save hardware").click()

    # Modal closes
    expect(auth_page.get_by_role("heading", name="Add hardware")).not_to_be_visible(timeout=6000)

    # List grows (cache invalidation via React Query)
    auth_page.wait_for_timeout(600)
    count_after = auth_page.locator('[data-testid="hardware-card"]').count()
    assert count_after > count_before, (
        f"Hardware card count should increase after add: {count_before} → {count_after}"
    )

    # New item is auto-selected — name visible in detail panel
    panel = auth_page.locator('[data-testid="hardware-detail-panel"]')
    expect(panel.get_by_text("Comandante C40")).to_be_visible(timeout=6000)

    # URL must not change
    assert auth_page.url.rstrip("/").endswith("/hardware"), (
        f"URL must stay /hardware after add, got: {auth_page.url}"
    )


def test_cache_invalidation_after_add_storage(auth_page: Page, live_server: str) -> None:
    """Adding a Storage item updates the list immediately (cache invalidation)."""
    _go_hardware(auth_page, live_server)
    count_before = auth_page.locator('[data-testid="hardware-card"]').count()

    auth_page.get_by_label("Add Storage").click()
    auth_page.locator(".modal input[type='text']").fill("Fellow Atmos Canister")
    auth_page.get_by_role("button", name="Save hardware").click()

    expect(auth_page.get_by_role("heading", name="Add hardware")).not_to_be_visible(timeout=6000)
    auth_page.wait_for_timeout(600)

    count_after = auth_page.locator('[data-testid="hardware-card"]').count()
    assert count_after > count_before, (
        f"Card count should increase after Storage add: {count_before} → {count_after}"
    )
    expect(auth_page.get_by_text("Fellow Atmos Canister").first).to_be_visible(timeout=6000)


def test_edit_hardware_updates_list_without_reload(auth_page: Page, live_server: str) -> None:
    """Editing a hardware item reflects the new name in the list without a page reload."""
    _go_hardware(auth_page, live_server)

    # Find the IMS 20g basket card
    cards = auth_page.locator('[data-testid="hardware-card"]')
    basket_idx = -1
    for i in range(cards.count()):
        if "IMS 20g" in cards.nth(i).inner_text():
            basket_idx = i
            break
    assert basket_idx >= 0, "IMS 20g card must exist in the hardware list"

    cards.nth(basket_idx).get_by_text("EDIT").click()
    expect(auth_page.get_by_role("heading", name="Edit hardware")).to_be_visible()

    new_name = "IMS 20g Nanotech Basket"
    auth_page.locator(".modal input[type='text']").fill(new_name)
    auth_page.get_by_role("button", name="Save changes").click()

    # Modal closes
    expect(auth_page.get_by_role("heading", name="Edit hardware")).not_to_be_visible(timeout=6000)

    # Updated name visible in the list (React Query cache invalidation)
    auth_page.wait_for_timeout(500)
    expect(auth_page.get_by_text(new_name)).to_be_visible(timeout=6000)

    # URL must not have changed
    assert auth_page.url.rstrip("/").endswith("/hardware"), (
        f"URL must stay /hardware after edit, got: {auth_page.url}"
    )
