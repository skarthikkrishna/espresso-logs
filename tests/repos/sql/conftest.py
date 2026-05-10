"""Shared async session fixtures for SQL repo tests.

Uses the postgres:15 CI service container. DATABASE_URL is set in ci.yml:
postgresql+asyncpg://espresso:espresso@localhost:5432/espresso_logs

No GCP credentials required — the CI service container provides a local
Postgres instance with the full Alembic schema applied (alembic upgrade head
runs before pytest in the CI test job).
"""

from __future__ import annotations

import os

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

_DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://espresso:espresso@localhost:5432/espresso_logs",
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
