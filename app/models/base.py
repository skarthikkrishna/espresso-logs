"""SQLAlchemy async engine, session factory, and declarative base.

This module provides the ORM foundation for the Postgres data layer (Phase M4+).
The engine and session factory are module-level singletons — created once on first
use and reused across all requests. This prevents connection pool exhaustion under
USE_POSTGRES=true.

When DATABASE_URL uses the Cloud SQL Unix socket path (host=/cloudsql/<instance>),
the engine is built via the Cloud SQL Python Connector, which authenticates using
Application Default Credentials and manages TLS internally — no proxy sidecar needed.

See plan.md §AD-M1-01 for the engine startup guard rationale.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import Any
from urllib.parse import parse_qs, urlparse

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Shared declarative base for all SQLAlchemy ORM models."""

    pass


_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None
_connector: Any | None = None  # google.cloud.sql.connector.Connector, held for close_async()


def _is_cloud_sql_url(url: str) -> bool:
    """Return True when DATABASE_URL uses the Cloud SQL Unix socket path."""
    parsed = urlparse(url)
    qs = parse_qs(parsed.query)
    host = qs.get("host", [""])[0]
    return host.startswith("/cloudsql/")


def _parse_cloud_sql_url(url: str) -> tuple[str, str, str, str]:
    """Parse a Cloud SQL Unix socket DATABASE_URL.

    Returns (instance_connection_name, user, password, database).
    """
    parsed = urlparse(url)
    qs = parse_qs(parsed.query)
    host = qs.get("host", [""])[0]
    instance = host.removeprefix("/cloudsql/")
    user = parsed.username or ""
    password = parsed.password or ""
    database = parsed.path.lstrip("/")
    return instance, user, password, database


def _build_engine_with_connector(url: str) -> AsyncEngine:
    """Build an async SQLAlchemy engine using the Cloud SQL Python Connector.

    The connector authenticates via ADC and manages TLS, eliminating the need
    for a Cloud SQL Auth Proxy sidecar in Cloud Run.
    """
    global _connector
    from google.cloud.sql.connector import Connector

    instance, user, password, database = _parse_cloud_sql_url(url)
    _connector = Connector()

    async def getconn() -> Any:
        return await _connector.connect_async(
            instance,
            "asyncpg",
            user=user,
            password=password,
            db=database,
        )

    return create_async_engine(
        "postgresql+asyncpg://",
        async_creator=getconn,
        pool_size=5,
        max_overflow=5,
        echo=False,
    )


def get_engine() -> AsyncEngine:
    """Return the shared async SQLAlchemy engine, creating it on first call.

    Raises:
        RuntimeError: When DATABASE_URL is not configured.
    """
    global _engine
    if _engine is None:
        from app.config import settings  # lazy import to avoid circular dep at module level

        if not settings.database_url:
            raise RuntimeError("DATABASE_URL is not set. Cannot create database engine.")

        if _is_cloud_sql_url(settings.database_url):
            _engine = _build_engine_with_connector(settings.database_url)
        else:
            _engine = create_async_engine(
                settings.database_url,
                pool_size=5,
                max_overflow=5,
                echo=False,
            )
    return _engine


async def close_engine() -> None:
    """Dispose the engine pool and close the Cloud SQL Connector if active.

    Call this from the FastAPI lifespan on shutdown to avoid leaking the
    Connector's background thread pool on Cloud Run scale-to-zero.
    """
    global _engine, _connector
    if _engine is not None:
        await _engine.dispose()
    if _connector is not None:
        await _connector.close_async()


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    """Return the shared async session factory, creating it on first call."""
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(get_engine(), expire_on_commit=False)
    assert _session_factory is not None
    return _session_factory


async def get_db() -> AsyncGenerator[AsyncSession | None, None]:
    """FastAPI dependency: yield an async database session, or None when Postgres is disabled.

    When ``USE_POSTGRES=False`` (the current Sheets-backed mode), yields ``None``
    immediately so no Postgres connection is opened and no idle pool connections are
    held. Callers (deps.py factory functions) must handle ``None`` and skip SQL repo
    instantiation accordingly.

    Usage::

        @router.get("/items")
        async def list_items(db: AsyncSession | None = Depends(get_db)):
            ...
    """
    from app.config import settings  # lazy import to avoid circular dep at module level

    if not settings.use_postgres:
        yield None
        return
    async with get_session_factory()() as session:
        yield session
