"""Auth smoke tests — verify the unauthenticated redirect chain reaches Google OAuth.

Run locally:
  E2E_BASE_URL=http://localhost:8000 uv run pytest tests/e2e/ -m smoke -v

Run against deployed service:
  E2E_BASE_URL=https://<your-cloud-run-service-url> \
    uv run pytest tests/e2e/ -m smoke -v
"""

import os

import pytest
from playwright.sync_api import Page

_skip_no_live = pytest.mark.skipif(
    not os.environ.get("E2E_BASE_URL"),
    reason="E2E_BASE_URL not set — set it to run Playwright browser tests",
)


@_skip_no_live
@pytest.mark.smoke
def test_anonymous_root_redirects_to_google(page: Page, base_url: str) -> None:
    """GET / with no session cookie must end up at accounts.google.com."""
    page.goto(base_url + "/")
    assert "accounts.google.com" in page.url, (
        f"Expected redirect to accounts.google.com, got: {page.url}"
    )


@_skip_no_live
@pytest.mark.smoke
def test_login_page_reaches_google_sign_in(page: Page, base_url: str) -> None:
    """GET /auth/login must redirect to the Google OAuth consent page."""
    page.goto(base_url + "/auth/login")
    assert "accounts.google.com" in page.url, (
        f"Expected Google OAuth URL, got: {page.url}"
    )
    # Google's sign-in page includes identifiable text even before interaction.
    page.wait_for_load_state("networkidle")
    content = page.content()
    assert "Sign in" in content or "Google" in content, (
        "Google sign-in page content not found"
    )
