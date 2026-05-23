"""Auth smoke tests — verify the SPA routes anonymous users to sign in."""

import pytest
from playwright.sync_api import Page


@pytest.mark.smoke
def test_anonymous_root_routes_to_login(page: Page, base_url: str) -> None:
    """GET / should bootstrap the SPA and land on /login for anonymous users."""
    page.goto(base_url + "/")
    page.wait_for_load_state("networkidle")
    assert "/login" in page.url, f"Expected /login route, got: {page.url}"
    assert page.get_by_role("heading", name="Sign in").is_visible()


@pytest.mark.smoke
def test_login_page_renders_sign_in_form(page: Page, base_url: str) -> None:
    """GET /login renders the username/password sign-in form."""
    page.goto(base_url + "/login")
    page.wait_for_load_state("networkidle")
    assert page.get_by_role("heading", name="Sign in").is_visible()
    assert page.locator("#login-username").is_visible()
    assert page.locator("#login-password").is_visible()
