#!/usr/bin/env python3
"""Seed utility functions for the M3 migration.

ensure_system_user — seeds the __migration_system__ user.
ensure_default_household — seeds the default household.

Both functions are idempotent and use SQLAlchemy Core (no ORM).
"""

from __future__ import annotations

import uuid

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncEngine

_metadata = sa.MetaData()

_users = sa.Table(
    "users",
    _metadata,
    sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
    sa.Column("username", sa.Text(), nullable=True),
    sa.Column("display_name", sa.Text(), nullable=False),
    sa.Column("password_hash", sa.Text(), nullable=True),
    sa.Column("google_sub", sa.Text(), nullable=True),
    sa.Column("email", sa.Text(), nullable=True),
    sa.Column("picture_url", sa.Text(), nullable=True),
)

_households = sa.Table(
    "households",
    _metadata,
    sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
    sa.Column("name", sa.Text(), nullable=False),
    sa.Column("created_by", sa.UUID(), nullable=False),
)


async def ensure_system_user(engine: AsyncEngine) -> uuid.UUID:
    """Seed the __migration_system__ user and return its UUID.

    Uses INSERT ... ON CONFLICT (username) DO NOTHING RETURNING id.
    If RETURNING is empty (already existed), fetches via SELECT.
    Satisfies the users_has_identity CHECK constraint (username IS NOT NULL).
    """
    async with engine.begin() as conn:
        stmt = (
            pg_insert(_users)
            .values(
                username="__migration_system__",
                display_name="Migration System",
                password_hash=None,
                google_sub=None,
            )
            .on_conflict_do_nothing(index_elements=["username"])
            .returning(_users.c.id)
        )
        result = await conn.execute(stmt)
        row = result.fetchone()
        if row is not None:
            return uuid.UUID(str(row[0]))
        # Already exists — fetch its id
        select_stmt = sa.select(_users.c.id).where(_users.c.username == "__migration_system__")
        existing = await conn.execute(select_stmt)
        existing_row = existing.fetchone()
        if existing_row is None:
            raise RuntimeError("ensure_system_user: failed to find or insert system user")
        return uuid.UUID(str(existing_row[0]))


async def ensure_default_household(engine: AsyncEngine, system_user_id: uuid.UUID) -> uuid.UUID:
    """Seed the default household and return its UUID.

    Uses SELECT-first pattern (households.name has no UNIQUE constraint).
    If a household named 'default' already exists, returns its UUID.
    Otherwise inserts a new one with created_by=system_user_id.
    """
    async with engine.begin() as conn:
        # SELECT first — households.name has no UNIQUE constraint
        select_stmt = sa.select(_households.c.id).where(_households.c.name == "default").limit(1)
        result = await conn.execute(select_stmt)
        row = result.fetchone()
        if row is not None:
            return uuid.UUID(str(row[0]))
        # Not found — INSERT
        insert_stmt = (
            sa.insert(_households)
            .values(name="default", created_by=system_user_id)
            .returning(_households.c.id)
        )
        insert_result = await conn.execute(insert_stmt)
        new_row = insert_result.fetchone()
        if new_row is None:
            raise RuntimeError("ensure_default_household: INSERT did not return an id")
        return uuid.UUID(str(new_row[0]))
