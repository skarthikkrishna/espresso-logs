"""Spec-035 backend regression tests for refresh-token replay handling."""

from __future__ import annotations

import datetime
from pathlib import Path
from typing import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.models.auth import RefreshToken
from app.models.base import get_db
from app.routers import api_auth
from app.repos.sql.refresh_tokens import RefreshTokenRepo


pytestmark = pytest.mark.skipif(
    not hasattr(RefreshToken, "rotated_at"),
    reason="spec-035 backend implementation pending: RefreshToken.rotated_at is not present yet",
)


class _FakeRefreshTokenRepo:
    def __init__(self, existing: MagicMock | None) -> None:
        self.existing = existing
        self.rotate_calls: list[str] = []
        self.get_by_hash_calls: list[str] = []
        self.revoke_all_for_user = AsyncMock()

    async def rotate(self, _db: AsyncMock, token_hash: str) -> None:
        self.rotate_calls.append(token_hash)
        return None

    async def get_by_hash(self, _db: AsyncMock, token_hash: str) -> MagicMock | None:
        self.get_by_hash_calls.append(token_hash)
        return self.existing


def _revoked_token(*, rotated_at: datetime.datetime | None) -> MagicMock:
    token = MagicMock()
    token.revoked = True
    token.rotated_at = rotated_at
    token.user_id = "user-1"
    return token


async def _post_refresh_with_repo(repo: _FakeRefreshTokenRepo) -> tuple[int, AsyncMock]:
    db = AsyncMock()

    async def _fake_db_dep() -> AsyncGenerator[AsyncMock, None]:
        yield db

    app.dependency_overrides[get_db] = _fake_db_dep
    try:
        with patch.object(api_auth, "RefreshTokenRepo", return_value=repo):
            async with AsyncClient(
                transport=ASGITransport(app=app),
                base_url="http://test",
                follow_redirects=False,
            ) as client:
                response = await client.post(
                    "/auth/refresh",
                    json={"refresh_token": "raw-refresh-token"},
                )
    finally:
        app.dependency_overrides.pop(get_db, None)

    return response.status_code, db


def test_migration_adds_nullable_rotated_at_without_index() -> None:
    migration_files = list(Path("alembic/versions").glob("*rotated_at*.py"))

    assert migration_files, "Expected an Alembic migration for refresh_tokens.rotated_at"

    migration_text = "\n".join(path.read_text() for path in migration_files)
    assert "op.add_column" in migration_text
    assert '"refresh_tokens"' in migration_text
    assert '"rotated_at"' in migration_text
    assert "sa.TIMESTAMP(timezone=True)" in migration_text
    assert "nullable=True" in migration_text
    assert 'op.drop_column("refresh_tokens", "rotated_at")' in migration_text
    assert "create_index" not in migration_text


@pytest.mark.asyncio
async def test_rotate_sets_rotated_at_with_database_time() -> None:
    db = AsyncMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = MagicMock(spec=RefreshToken)
    db.execute = AsyncMock(return_value=result)

    await RefreshTokenRepo().rotate(db, "token-hash")

    statement = db.execute.await_args.args[0]
    compiled = str(statement.compile(compile_kwargs={"literal_binds": True})).lower()
    assert "rotated_at" in compiled
    assert "now()" in compiled


@pytest.mark.asyncio
async def test_replay_within_5_seconds_returns_401_without_revoking_all_sessions() -> None:
    repo = _FakeRefreshTokenRepo(
        _revoked_token(
            rotated_at=datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(seconds=2),
        )
    )

    status_code, db = await _post_refresh_with_repo(repo)

    assert status_code == 401
    repo.revoke_all_for_user.assert_not_awaited()
    db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_replay_after_5_seconds_returns_401_and_revokes_all_sessions() -> None:
    repo = _FakeRefreshTokenRepo(
        _revoked_token(
            rotated_at=datetime.datetime.now(datetime.timezone.utc)
            - datetime.timedelta(seconds=10),
        )
    )

    status_code, db = await _post_refresh_with_repo(repo)

    assert status_code == 401
    repo.revoke_all_for_user.assert_awaited_once_with(db, "user-1")
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_replay_with_null_rotated_at_returns_401_and_revokes_all_sessions() -> None:
    repo = _FakeRefreshTokenRepo(_revoked_token(rotated_at=None))

    status_code, db = await _post_refresh_with_repo(repo)

    assert status_code == 401
    repo.revoke_all_for_user.assert_awaited_once_with(db, "user-1")
    db.commit.assert_awaited_once()
