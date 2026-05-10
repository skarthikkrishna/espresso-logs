"""Alembic environment — async migration pattern for asyncpg/SQLAlchemy 2.x.

Key design decisions (see plan.md):
- AD-M1-02: sqlalchemy.url is empty in alembic.ini; DATABASE_URL read from env at runtime.
- AD-M1-03: async run_migrations_online() using asyncio.run() + connection.run_sync().
- R-3: run_migrations_offline() implemented to support alembic check and SQL generation.
- R-8: noqa F401 on model imports (side-effect imports to register models with Base.metadata).
"""
from __future__ import annotations

import asyncio
import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

# ---------------------------------------------------------------------------
# Explicit model imports — required for autogenerate and run_migrations_online.
# These imports register all mapped classes with Base.metadata.
# F401 suppressed: imports are for side effects (metadata registration), not direct use.
# ---------------------------------------------------------------------------
from app.models import user, auth, household, catalog, brew_log, inventory, hardware, maintenance  # noqa: F401
from app.models.base import Base

# Alembic Config object — provides access to alembic.ini values.
config = context.config

# Set up Python logging from alembic.ini [loggers] section.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Metadata for autogenerate support.
target_metadata = Base.metadata


def get_database_url() -> str:
    """Read DATABASE_URL from the environment (never from alembic.ini)."""
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError(
            "DATABASE_URL environment variable is required for Alembic migrations. "
            "Set it to a valid postgresql+asyncpg:// connection string."
        )
    return url


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode — generates SQL to stdout without a DB connection.

    Useful for DBA review: `DATABASE_URL=... alembic upgrade head --sql`
    """
    url = get_database_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:  # type: ignore[no-untyped-def]
    """Execute migrations synchronously within the provided async connection."""
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode using an async engine (asyncpg driver)."""
    url = get_database_url()
    connectable = create_async_engine(url)

    async def do_migrations() -> None:
        async with connectable.connect() as connection:
            await connection.run_sync(do_run_migrations)
        await connectable.dispose()

    asyncio.run(do_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
