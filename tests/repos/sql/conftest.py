"""Shared async session fixtures for SQL repo tests.

Uses the postgres:15 CI service container. DATABASE_URL is set in ci.yml:
postgresql+asyncpg://espresso:espresso@localhost:5432/espresso_logs

No GCP credentials required — the CI service container provides a local
Postgres instance with the full Alembic schema applied.

Note: The migration round-trip test (tests/models/test_migrations.py) runs
before these tests (alphabetical order) and leaves the DB empty after its
final `downgrade base`. The `_ensure_schema` fixture below re-applies
`alembic upgrade head` at the start of each SQL repo test so the tables
exist regardless of prior test ordering.
"""

from __future__ import annotations

import os
import subprocess

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

_DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://espresso:espresso@localhost:5432/espresso_logs",
)


@pytest.fixture(scope="session", autouse=True)
def _ensure_schema() -> None:  # type: ignore[misc]
    """Run `alembic upgrade head` once per test session.

    Guarantees that tables exist even if the migration round-trip test ran
    first and left the database in the downgraded (empty) state.
    Skips silently if DATABASE_URL is not configured (unit-test-only runs).
    """
    if not os.environ.get("DATABASE_URL"):
        return
    subprocess.run(
        ["uv", "run", "alembic", "upgrade", "head"],
        check=True,
        capture_output=True,
    )


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture
async def engine():  # type: ignore[misc]
    """Function-scoped engine — one engine per test."""
    _engine = create_async_engine(_DATABASE_URL, echo=False)
    yield _engine
    await _engine.dispose()


@pytest.fixture
async def db_session(engine) -> AsyncSession:  # type: ignore[misc]
    """Function-scoped AsyncSession; rolls back after each test for isolation."""
    async with async_sessionmaker(engine, expire_on_commit=False)() as session:
        yield session
        await session.rollback()
