"""Unit tests for RefreshTokenRepo (US-2.3).

Requires DATABASE_URL env var pointing to a live Postgres instance.
Tests are auto-skipped when DATABASE_URL is not set (see tests/repos/sql/conftest.py).
"""

from __future__ import annotations

import datetime
import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.repos.sql.refresh_tokens import RefreshTokenRepo
from app.repos.sql.user import UserRepo


async def _make_user(db: AsyncSession) -> uuid.UUID:
    repo = UserRepo()
    user = await repo.create(
        db,
        username=f"rtuser_{uuid.uuid4().hex[:8]}",
        password_hash="pw",
        google_sub=None,
        email=None,
        display_name="RT User",
        picture_url=None,
    )
    await db.commit()
    return user.id


def _future() -> datetime.datetime:
    return datetime.datetime.now(tz=datetime.timezone.utc) + datetime.timedelta(hours=1)


@pytest.mark.anyio
async def test_create_and_get_refresh_token(db_session: AsyncSession) -> None:
    user_id = await _make_user(db_session)
    repo = RefreshTokenRepo()

    token = await repo.create(
        db_session,
        user_id=user_id,
        token_hash="somehash_abc",
        expires_at=_future(),
    )
    await db_session.commit()

    fetched = await repo.get_by_hash(db_session, "somehash_abc")
    assert fetched is not None
    assert fetched.id == token.id
    assert fetched.revoked is False

    missing = await repo.get_by_hash(db_session, "nonexistent_hash")
    assert missing is None


@pytest.mark.anyio
async def test_revoke_single_token(db_session: AsyncSession) -> None:
    user_id = await _make_user(db_session)
    repo = RefreshTokenRepo()

    token = await repo.create(
        db_session,
        user_id=user_id,
        token_hash="revoke_me",
        expires_at=_future(),
    )
    await db_session.commit()

    await repo.revoke(db_session, token.id)
    await db_session.commit()

    fetched = await repo.get_by_hash(db_session, "revoke_me")
    assert fetched is not None
    assert fetched.revoked is True


@pytest.mark.anyio
async def test_revoke_all_for_user_nukes_all_active_tokens(
    db_session: AsyncSession,
) -> None:
    user_id = await _make_user(db_session)
    repo = RefreshTokenRepo()

    await repo.create(db_session, user_id=user_id, token_hash="nuke_a", expires_at=_future())
    await repo.create(db_session, user_id=user_id, token_hash="nuke_b", expires_at=_future())
    await repo.create(db_session, user_id=user_id, token_hash="nuke_c", expires_at=_future())
    await db_session.commit()

    await repo.revoke_all_for_user(db_session, user_id)
    await db_session.commit()

    for h in ("nuke_a", "nuke_b", "nuke_c"):
        fetched = await repo.get_by_hash(db_session, h)
        assert fetched is not None
        assert fetched.revoked is True
