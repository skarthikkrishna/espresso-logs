"""Root test configuration — sets required env vars before any app module is imported."""

import os
import subprocess
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# Provide a dummy value so Settings() does not raise at collection time.
# Unit tests never hit a real sheet; integration tests supply the real value via env.
os.environ.setdefault("SPREADSHEET_ID", "fake-spreadsheet-id-for-tests")

# Unit tests default to the no-DB Sheets path even when a developer .env opts in to Postgres.
os.environ.setdefault("USE_POSTGRES", "false")

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
_FAKE_MEMBER_ID = uuid.UUID("00000000-0000-0000-0000-000000000003")

_UNEXPECTED_SQL_ACCESS = (
    "Unexpected database access in no-DB unit tests. Override get_db with a "
    "representative async session for DB tests, or patch settings.use_postgres=False "
    "to exercise the Sheets fallback."
)


@pytest.fixture(autouse=True)
def _patch_use_postgres_default_false():
    """Keep baseline unit tests on the Sheets fallback regardless of local .env."""
    from app.config import settings

    original = settings.use_postgres
    settings.use_postgres = False
    yield
    settings.use_postgres = original


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
    m.id = _FAKE_MEMBER_ID
    return m


def _database_url_active() -> bool:
    return bool(os.environ.get("DATABASE_URL"))


def _run_alembic_upgrade_head() -> None:
    result = subprocess.run(
        ["uv", "run", "alembic", "upgrade", "head"],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(
            "alembic upgrade head failed while preparing global SQL test fixture\n"
            f"stdout:\n{result.stdout[-1000:]}\n"
            f"stderr:\n{result.stderr[-1000:]}"
        )


async def _tenant_schema_present(engine) -> bool:
    from sqlalchemy import text

    async with engine.connect() as conn:
        result = await conn.execute(
            text(
                """
                SELECT
                  to_regclass('public.users') IS NOT NULL
                  AND to_regclass('public.households') IS NOT NULL
                  AND to_regclass('public.household_members') IS NOT NULL
                """
            )
        )
        return bool(result.scalar_one())


async def _ensure_tenant_schema(engine) -> None:
    if not await _tenant_schema_present(engine):
        _run_alembic_upgrade_head()


async def _seed_global_tenant_context(conn) -> None:
    from sqlalchemy import text

    await conn.execute(
        text(
            """
            INSERT INTO users (id, username, password_hash, display_name)
            VALUES (:uid, :username, :password_hash, :display_name)
            ON CONFLICT (id) DO UPDATE
            SET display_name = EXCLUDED.display_name
            """
        ),
        {
            "uid": _FAKE_USER_ID,
            "username": "__global_fixture_user__",
            "password_hash": "fixture-only",
            "display_name": "Global Fixture User",
        },
    )
    await conn.execute(
        text(
            """
            INSERT INTO households (id, name, created_by)
            VALUES (:hid, :name, :uid)
            ON CONFLICT (id) DO UPDATE
            SET name = EXCLUDED.name,
                created_by = EXCLUDED.created_by
            """
        ),
        {
            "hid": _FAKE_HOUSEHOLD_ID,
            "name": "Global Fixture Household",
            "uid": _FAKE_USER_ID,
        },
    )
    await conn.execute(
        text("UPDATE users SET active_household_id = :hid WHERE id = :uid"),
        {"hid": _FAKE_HOUSEHOLD_ID, "uid": _FAKE_USER_ID},
    )
    await conn.execute(
        text(
            """
            INSERT INTO household_members (id, household_id, user_id, role)
            VALUES (:mid, :hid, :uid, 'admin')
            ON CONFLICT (household_id, user_id) DO UPDATE
            SET role = EXCLUDED.role
            """
        ),
        {
            "mid": _FAKE_MEMBER_ID,
            "hid": _FAKE_HOUSEHOLD_ID,
            "uid": _FAKE_USER_ID,
        },
    )
    await conn.execute(
        text("SELECT set_config('app.current_household_id', :hid, true)"),
        {"hid": str(_FAKE_HOUSEHOLD_ID)},
    )


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
    """Override DB session creation for deterministic unit and CI behavior.

    M2 introduced a Depends(get_db) on every repo factory. Some tests call
    app.dependency_overrides.clear(), removing any get_db override. This fixture
    patches get_session_factory at the module level instead — it survives
    dependency_overrides.clear().

    Without DATABASE_URL, the sentinel session fails loudly on SQL execution.
    With DATABASE_URL, tests that explicitly enable Postgres receive a real
    session with the test tenant rows and RLS context set inside an outer
    transaction, matching the SQL repo fixture while preserving strict RLS.
    """
    from contextlib import asynccontextmanager

    if _database_url_active():
        import app.models.base as base
        from sqlalchemy.ext.asyncio import AsyncSession

        @asynccontextmanager
        async def _tenant_cm():
            engine = base.get_engine()
            await _ensure_tenant_schema(engine)
            async with engine.connect() as conn:
                transaction = await conn.begin()
                await _seed_global_tenant_context(conn)
                session = AsyncSession(
                    bind=conn,
                    expire_on_commit=False,
                    join_transaction_mode="create_savepoint",
                )
                try:
                    yield session
                finally:
                    await session.close()
                    await transaction.rollback()

        def _tenant_get_session_factory():
            return lambda: _tenant_cm()

        with (
            patch("app.models.base.get_session_factory", _tenant_get_session_factory),
            patch("app.main.get_session_factory", _tenant_get_session_factory),
        ):
            yield
        return

    mock_session = MagicMock()
    mock_session.add = MagicMock()
    mock_session.execute = AsyncMock(side_effect=AssertionError(_UNEXPECTED_SQL_ACCESS))
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
