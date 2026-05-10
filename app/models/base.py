"""SQLAlchemy async engine, session factory, and declarative base.

This module provides the ORM foundation for the Postgres data layer (Phase M4+).
The engine factory is lazy — it is never called at import time, ensuring that
importing app/models/ does not crash when DATABASE_URL is absent (USE_POSTGRES=false).

See plan.md §AD-M1-01 for the engine startup guard rationale.
"""
from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import Optional

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Shared declarative base for all SQLAlchemy ORM models."""

    pass


def get_engine(database_url: Optional[str] = None):
    """Create and return an async SQLAlchemy engine.

    Args:
        database_url: Connection string. Reads from settings if not provided.

    Raises:
        RuntimeError: When DATABASE_URL is not configured.
    """
    from app.config import settings  # lazy import to avoid circular dep at module level

    url = database_url or settings.database_url
    if not url:
        raise RuntimeError(
            "DATABASE_URL is not configured. "
            "Set USE_POSTGRES=true and provide a valid DATABASE_URL."
        )
    return create_async_engine(
        url,
        pool_size=5,
        max_overflow=5,
        echo=False,
    )


def get_session_factory(database_url: Optional[str] = None) -> async_sessionmaker[AsyncSession]:
    """Return an async session factory bound to the engine."""
    return async_sessionmaker(get_engine(database_url), expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency: yield an async database session.

    Usage::

        @router.get("/items")
        async def list_items(db: AsyncSession = Depends(get_db)):
            ...
    """
    factory = get_session_factory()
    async with factory() as session:
        yield session
