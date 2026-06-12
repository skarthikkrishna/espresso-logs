"""Safety guardrails for SQL-backed tests that write database fixtures."""

from __future__ import annotations

from urllib.parse import unquote, urlparse

_EXPLICIT_TEST_MARKERS = ("_test", "test_", "-test", "pytest")
_PRODUCTION_LIKE_MARKERS = ("espresso", "coffee", "kaapi", "dev", "local")


def _database_name_or_path(url: str | None) -> str:
    if not url:
        return ""
    parsed = urlparse(url)
    return unquote(parsed.path or "").strip().lower().lstrip("/")


def is_explicit_test_database_url(url: str | None) -> bool:
    """Return True only when the database name/path is explicitly test-marked."""
    database_name = _database_name_or_path(url)
    if not database_name:
        return False

    has_test_marker = any(marker in database_name for marker in _EXPLICIT_TEST_MARKERS)
    if has_test_marker:
        return True

    if any(marker in database_name for marker in _PRODUCTION_LIKE_MARKERS):
        return False

    return False


def assert_explicit_test_database_url(url: str | None, *, purpose: str) -> None:
    """Fail loudly before a fixture-writing test can target a non-test database."""
    if is_explicit_test_database_url(url):
        return
    raise RuntimeError(
        f"Refusing to use database for {purpose}: configured database name/path is not "
        "explicitly marked as a test database. Set TEST_DATABASE_URL or DATABASE_URL to a "
        "database whose name contains one of: _test, test_, -test, pytest."
    )
