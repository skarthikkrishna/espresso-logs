"""SQLAlchemy async engine, session factory, and declarative base.

This module provides the ORM foundation for the Postgres data layer (Phase M4+).
The engine and session factory are module-level singletons — created once on first
use and reused across all requests. This prevents connection pool exhaustion under
USE_POSTGRES=true.

See plan.md §AD-M1-01 for the engine startup guard rationale.
"""
from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Shared declarative base for all SQLAlchemy ORM models."""

    pass


_engine = None
_session_factory = None


def get_engine():
    """Return the shared async SQLAlchemy engine, creating it on first call.

    Raises:
        RuntimeError: When DATABASE_URL is not configured.
    """
    global _engine
    if _engine is None:
        from app.config import get_settings  # lazy import to avoid circular dep at module level

        settings = get_settings()
        if not settings.database_url:
            raise RuntimeError(
                "DATABASE_URL is not set. Cannot create database engine."
            )
        _engine = create_async_engine(
            settings.database_url,
            pool_size=5,
            max_overflow=5,
            echo=False,
        )
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    """Return the shared async session factory, creating it on first call."""
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(get_engine(), expire_on_commit=False)
    return _session_factory


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency: yield an async database session.

    Usage::

        @router.get("/items")
        async def list_items(db: AsyncSession = Depends(get_db)):
            ...
    """
    async with get_session_factory()() as session:
        yield session
