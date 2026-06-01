"""Root test configuration — sets required env vars before any app module is imported."""

import os
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# Provide a dummy value so Settings() does not raise at collection time.
# Unit tests never hit a real sheet; integration tests supply the real value via env.
os.environ.setdefault("SPREADSHEET_ID", "fake-spreadsheet-id-for-tests")

# JWT_SECRET is required by M5 auth service — provide a deterministic 32-char test value.
_TEST_JWT_SECRET = "test-jwt-fixture-" + ("0" * 15)
os.environ.setdefault("JWT_SECRET", _TEST_JWT_SECRET)

# Override the session secret so tests can sign cookies with the known test secret,
# regardless of any .env file present in the repo root.
os.environ["SESSION_SECRET"] = "dev-insecure-secret-for-testing-only"

# ---------------------------------------------------------------------------
# Fake ORM objects for auth dependency overrides
# ---------------------------------------------------------------------------

_FAKE_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
_FAKE_HOUSEHOLD_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")


def _make_fake_user() -> object:
    from app.models.user import User

    u = User(
        username="test-user",
        display_name="Test User",
        email="test@example.com",
    )
    u.id = _FAKE_USER_ID
    return u


def _make_fake_member() -> object:
    from app.models.household import HouseholdMember

    m = HouseholdMember(
        household_id=_FAKE_HOUSEHOLD_ID,
        user_id=_FAKE_USER_ID,
        role="admin",
    )
    m.id = uuid.UUID("00000000-0000-0000-0000-000000000003")
    return m


@pytest.fixture(autouse=True)
def _patch_auth_deps():
    """Override JWT auth dependencies so unit tests don't need real tokens.

    Provides a synthetic User and HouseholdMember so tests can focus on
    business logic without acquiring a real JWT.  Tests that explicitly test
    the auth layer should clear these overrides via
    ``app.dependency_overrides.pop(dep, None)``.
    """
    from app.deps import (
        current_household_membership,
        current_user,
        require_admin,
        resolve_guest_or_member,
    )
    from app.main import app

    fake_user = _make_fake_user()
    fake_member = _make_fake_member()

    app.dependency_overrides[current_user] = lambda: fake_user
    app.dependency_overrides[current_household_membership] = lambda: fake_member
    app.dependency_overrides[require_admin] = lambda: fake_member
    app.dependency_overrides[resolve_guest_or_member] = lambda: fake_member
    yield
    app.dependency_overrides.pop(current_user, None)
    app.dependency_overrides.pop(current_household_membership, None)
    app.dependency_overrides.pop(require_admin, None)
    app.dependency_overrides.pop(resolve_guest_or_member, None)


@pytest.fixture(autouse=True)
def _patch_get_db():
    """Override DB session creation so unit tests never attempt a real Postgres connection.

    M2 introduced a Depends(get_db) on every repo factory. Some tests call
    app.dependency_overrides.clear(), removing any get_db override. This fixture
    patches get_session_factory at the module level instead — it survives
    dependency_overrides.clear() and prevents SQLAlchemy from creating real
    connections (which would interfere with tests that also patch asyncio.create_task).
    """
    from contextlib import asynccontextmanager

    mock_session = MagicMock()
    mock_session.add = MagicMock()
    mock_session.commit = AsyncMock()
    mock_session.refresh = AsyncMock()
    mock_session.rollback = AsyncMock()

    @asynccontextmanager
    async def _fake_cm():
        yield mock_session

    def _fake_get_session_factory():
        return lambda: _fake_cm()

    with patch("app.models.base.get_session_factory", _fake_get_session_factory):
        yield


@pytest.fixture(autouse=True)
def _patch_image_sourcer():
    """Stub image-sourcer functions imported into app.routers.api_catalog.

    Patches the module-level bindings in api_catalog (not the source module),
    which is the correct scope for unit tests that test the router in isolation.
    Other callers (e.g. import_wizard) must patch separately if they use these
    functions directly.

    By default:
    - fetch_page_context returns an empty PageContext (no page content)
    - source_bean_image returns "" (no image found)
    - fetch_image_bytes returns None (nothing to upload)

    Individual tests can override with a nested patch() call.
    """
    from app.services.image_sourcer import PageContext

    with (
        patch(
            "app.routers.api_catalog.fetch_page_context",
            new_callable=AsyncMock,
            return_value=PageContext(),
        ),
        patch("app.routers.api_catalog.source_bean_image", new_callable=AsyncMock, return_value=""),
        patch(
            "app.routers.api_catalog.fetch_image_bytes", new_callable=AsyncMock, return_value=None
        ),
    ):
        yield
