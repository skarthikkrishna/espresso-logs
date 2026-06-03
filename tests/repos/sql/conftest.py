"""Shared async session fixtures for SQL repo tests.

Uses the postgres:15 CI service container. DATABASE_URL is set in ci.yml via
GitHub Actions repo variables. Tests are skipped automatically when DATABASE_URL
is not set (e.g., local runs without a Postgres instance).

No GCP credentials required — the CI service container provides a local
Postgres instance with the full Alembic schema applied.
"""

from __future__ import annotations

import os
import subprocess
import uuid

import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

_DATABASE_URL = os.environ.get("DATABASE_URL")
SQL_TEST_USER_ID = uuid.UUID("00000000-0000-0000-0000-00000000f101")
SQL_TEST_HOUSEHOLD_ID = uuid.UUID("00000000-0000-0000-0000-00000000f102")

if not _DATABASE_URL:
    pytest.skip(
        "DATABASE_URL not set — skipping SQL repo integration tests",
        allow_module_level=True,
    )


@pytest.fixture(scope="session", autouse=True)
def _ensure_schema() -> None:  # type: ignore[misc]
    """Run `alembic upgrade head` once per test session.

    Guarantees that tables exist even if the migration round-trip test ran
    first and left the database in the downgraded (empty) state.
    """
    result = subprocess.run(
        ["uv", "run", "alembic", "upgrade", "head"],
        capture_output=True,
    )
    if result.returncode != 0:
        import warnings

        warnings.warn(
            f"alembic upgrade head failed (returncode={result.returncode}); "
            "SQL repo tests will fail if the schema is not applied.\n"
            f"stderr: {result.stderr.decode()[:500]}",
            stacklevel=1,
        )


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture
def test_household_id() -> uuid.UUID:
    return SQL_TEST_HOUSEHOLD_ID


@pytest_asyncio.fixture(loop_scope="function")
async def engine():  # type: ignore[misc]
    """Function-scoped engine — one engine per test."""
    _engine = create_async_engine(_DATABASE_URL, echo=False)  # type: ignore[arg-type]
    yield _engine
    await _engine.dispose()


@pytest_asyncio.fixture(loop_scope="function")
async def db_session(engine) -> AsyncSession:  # type: ignore[misc]
    """Function-scoped AsyncSession with SAVEPOINT isolation.

    Uses join_transaction_mode="create_savepoint" so that session.commit()
    inside repo methods issues a SAVEPOINT release rather than a real COMMIT.
    The outer connection-level transaction is rolled back after each test,
    preventing cross-test contamination regardless of how many commits the
    code under test issues.
    """
    async with engine.connect() as conn:
        await conn.begin()
        await conn.execute(
            text(
                """
                INSERT INTO users (id, username, password_hash, display_name)
                VALUES (:uid, :username, :password_hash, :display_name)
                ON CONFLICT (id) DO NOTHING
                """
            ),
            {
                "uid": SQL_TEST_USER_ID,
                "username": "__sql_repo_fixture_user__",
                "password_hash": "fixture-only",
                "display_name": "SQL Repo Fixture User",
            },
        )
        await conn.execute(
            text(
                """
                INSERT INTO households (id, name, created_by)
                VALUES (:hid, :name, :uid)
                ON CONFLICT (id) DO NOTHING
                """
            ),
            {
                "hid": SQL_TEST_HOUSEHOLD_ID,
                "name": "SQL Repo Fixture Household",
                "uid": SQL_TEST_USER_ID,
            },
        )
        await conn.execute(
            text("SELECT set_config('app.current_household_id', :hid, true)"),
            {"hid": str(SQL_TEST_HOUSEHOLD_ID)},
        )
        session = AsyncSession(
            bind=conn,
            expire_on_commit=False,
            join_transaction_mode="create_savepoint",
        )
        yield session
        await session.close()
        await conn.rollback()
