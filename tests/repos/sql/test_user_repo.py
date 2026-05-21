"""Unit tests for UserRepo (US-2.1).

Requires DATABASE_URL env var pointing to a live Postgres instance.
Tests are auto-skipped when DATABASE_URL is not set (see tests/repos/sql/conftest.py).
"""

from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.repos.sql.user import UserRepo


@pytest.mark.anyio
async def test_create_user_with_username(db_session: AsyncSession) -> None:
    repo = UserRepo()
    user = await repo.create(
        db_session,
        username="testuser",
        password_hash="hashed_pw",
        google_sub=None,
        email="test@example.com",
        display_name="Test User",
        picture_url=None,
    )
    await db_session.commit()

    fetched = await repo.get_by_id(db_session, user.id)
    assert fetched is not None
    assert fetched.username == "testuser"
    assert fetched.display_name == "Test User"


@pytest.mark.anyio
async def test_get_by_username_case_insensitive(db_session: AsyncSession) -> None:
    repo = UserRepo()
    await repo.create(
        db_session,
        username="Alice",
        password_hash="pw",
        google_sub=None,
        email=None,
        display_name="Alice",
        picture_url=None,
    )
    await db_session.commit()

    found = await repo.get_by_username(db_session, "alice")
    assert found is not None
    assert found.username == "Alice"


@pytest.mark.anyio
async def test_increment_login_attempts_sets_locked_until_at_10(
    db_session: AsyncSession,
) -> None:
    repo = UserRepo()
    user = await repo.create(
        db_session,
        username="lockme",
        password_hash="pw",
        google_sub=None,
        email=None,
        display_name="Lockme",
        picture_url=None,
    )
    await db_session.commit()

    for _ in range(10):
        await repo.increment_login_attempts(db_session, user.id)
    await db_session.commit()

    refreshed = await repo.get_by_id(db_session, user.id)
    assert refreshed is not None
    assert refreshed.login_attempts >= 10
    assert refreshed.locked_until is not None


@pytest.mark.anyio
async def test_reset_login_state_clears_attempts_and_lock(
    db_session: AsyncSession,
) -> None:
    repo = UserRepo()
    user = await repo.create(
        db_session,
        username="resetme",
        password_hash="pw",
        google_sub=None,
        email=None,
        display_name="Resetme",
        picture_url=None,
    )
    await db_session.commit()

    for _ in range(10):
        await repo.increment_login_attempts(db_session, user.id)
    await db_session.commit()

    await repo.reset_login_state(db_session, user.id)
    await db_session.commit()

    refreshed = await repo.get_by_id(db_session, user.id)
    assert refreshed is not None
    assert refreshed.login_attempts == 0
    assert refreshed.locked_until is None
