"""Alembic migration round-trip test.

This test REQUIRES a live Postgres connection (CI postgres:15 service container).
It is NOT a unit test. It verifies:
1. alembic upgrade head creates all 11 expected tables.
2. alembic downgrade base removes all tables.

DATABASE_URL is read from the environment (set by CI job from T020).
"""

from __future__ import annotations

import os
import uuid
from collections.abc import Generator

import pytest
import sqlalchemy as sa
from alembic import command
from alembic.config import Config
from sqlalchemy import Engine, inspect


EXPECTED_TABLES = {
    "users",
    "households",
    "household_members",
    "pending_invitations",
    "guest_tokens",
    "refresh_tokens",
    "catalog",
    "brew_log",
    "inventory_bags",
    "hardware",
    "maintenance_log",
    "oauth_states",
    "import_sessions",
}


@pytest.fixture(scope="module")
def alembic_cfg() -> Config:
    """Load alembic.ini from the repo root."""
    cfg = Config("alembic.ini")
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        pytest.skip("DATABASE_URL not set — skipping migration round-trip test")
    # Convert asyncpg URL to synchronous psycopg2-compatible URL for inspect()
    # Alembic command.upgrade uses the async env.py path which handles asyncpg.
    return cfg


@pytest.fixture(scope="module")
def sync_engine(alembic_cfg) -> Generator[Engine, None, None]:
    """Synchronous engine for schema inspection.

    Creates a psycopg2-compatible engine from DATABASE_URL (converting the
    asyncpg scheme) for use with SQLAlchemy ``inspect()`` during Alembic
    migration round-trip tests.  The engine is disposed after the module's
    tests complete.
    """
    database_url = os.environ.get("DATABASE_URL", "")
    # Convert asyncpg URL to synchronous for SQLAlchemy inspect
    sync_url = database_url.replace("postgresql+asyncpg://", "postgresql+psycopg2://", 1)
    try:
        engine = sa.create_engine(sync_url)
        # Test connection
        with engine.connect():
            pass
    except ImportError:
        # Fallback: try without driver specification
        sync_url2 = database_url.replace("postgresql+asyncpg://", "postgresql://", 1)
        engine = sa.create_engine(sync_url2)
    yield engine
    engine.dispose()


def get_table_names(engine) -> set[str]:
    """Return non-alembic table names present in the database."""
    inspector = inspect(engine)
    return {t for t in inspector.get_table_names() if t != "alembic_version"}


def test_migration_round_trip(alembic_cfg, sync_engine) -> None:
    """Full round-trip: upgrade head → verify tables → downgrade base → verify empty."""
    # Ensure clean state
    command.downgrade(alembic_cfg, "base")
    assert get_table_names(sync_engine) == set(), "Database should be empty before upgrade"

    # Upgrade to head
    command.upgrade(alembic_cfg, "head")
    actual_tables = get_table_names(sync_engine)
    assert actual_tables == EXPECTED_TABLES, (
        f"Expected tables: {EXPECTED_TABLES}\n"
        f"Actual tables: {actual_tables}\n"
        f"Missing: {EXPECTED_TABLES - actual_tables}\n"
        f"Extra: {actual_tables - EXPECTED_TABLES}"
    )

    # Downgrade to base
    command.downgrade(alembic_cfg, "base")
    remaining = get_table_names(sync_engine)
    assert remaining == set(), f"Expected empty database after downgrade, got: {remaining}"


def test_0007_downgrade_clears_invited_by_user_reference(alembic_cfg, sync_engine) -> None:
    """0007 downgrade handles invited_by values that reference users.id."""
    command.downgrade(alembic_cfg, "base")

    inviter_user_id = uuid.uuid4()
    invited_user_id = uuid.uuid4()
    household_id = uuid.uuid4()
    inviter_member_id = uuid.uuid4()
    invited_member_id = uuid.uuid4()

    try:
        command.upgrade(alembic_cfg, "0007")

        with sync_engine.begin() as conn:
            conn.execute(
                sa.text(
                    """
                    INSERT INTO users (id, username, display_name)
                    VALUES
                      (:inviter_user_id, 'inviter', 'Inviter'),
                      (:invited_user_id, 'invited', 'Invited')
                    """
                ),
                {
                    "inviter_user_id": inviter_user_id,
                    "invited_user_id": invited_user_id,
                },
            )
            conn.execute(
                sa.text(
                    """
                    INSERT INTO households (id, name, created_by)
                    VALUES (:household_id, 'Migration Household', :inviter_user_id)
                    """
                ),
                {
                    "household_id": household_id,
                    "inviter_user_id": inviter_user_id,
                },
            )
            conn.execute(
                sa.text(
                    """
                    INSERT INTO household_members
                      (id, household_id, user_id, role, invited_by)
                    VALUES
                      (:inviter_member_id, :household_id, :inviter_user_id, 'admin', NULL),
                      (:invited_member_id, :household_id, :invited_user_id, 'member', :inviter_user_id)
                    """
                ),
                {
                    "inviter_member_id": inviter_member_id,
                    "invited_member_id": invited_member_id,
                    "household_id": household_id,
                    "inviter_user_id": inviter_user_id,
                    "invited_user_id": invited_user_id,
                },
            )

        command.downgrade(alembic_cfg, "0006")

        with sync_engine.connect() as conn:
            invited_by = conn.execute(
                sa.text(
                    """
                    SELECT invited_by
                    FROM household_members
                    WHERE id = :invited_member_id
                    """
                ),
                {"invited_member_id": invited_member_id},
            ).scalar_one()

        assert invited_by is None
    finally:
        command.downgrade(alembic_cfg, "base")
