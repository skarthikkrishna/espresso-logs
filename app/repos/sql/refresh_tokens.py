"""RefreshTokenRepo — async SQLAlchemy data access for `refresh_tokens` (M5)."""

from __future__ import annotations

import datetime
import uuid

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auth import RefreshToken


class RefreshTokenRepo:
    """Lifecycle management for persisted refresh tokens."""

    async def create(
        self,
        db: AsyncSession,
        *,
        user_id: uuid.UUID,
        token_hash: str,
        expires_at: datetime.datetime,
    ) -> RefreshToken:
        """Insert a new refresh token row. Caller commits."""
        token = RefreshToken(
            user_id=user_id,
            token_hash=token_hash,
            expires_at=expires_at,
        )
        db.add(token)
        await db.flush()
        await db.refresh(token)
        return token

    async def get_by_hash(self, db: AsyncSession, token_hash: str) -> RefreshToken | None:
        result = await db.execute(
            sa.select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )
        return result.scalar_one_or_none()

    async def revoke(self, db: AsyncSession, token_id: uuid.UUID) -> None:
        """Mark a single token as revoked."""
        await db.execute(
            sa.update(RefreshToken).where(RefreshToken.id == token_id).values(revoked=True)
        )
        await db.flush()

    async def revoke_all_for_user(self, db: AsyncSession, user_id: uuid.UUID) -> None:
        """Revoke all non-revoked tokens for a user (AC-032 — replay nuclear option)."""
        await db.execute(
            sa.update(RefreshToken)
            .where(
                RefreshToken.user_id == user_id,
                RefreshToken.revoked.is_(False),
            )
            .values(revoked=True)
        )
        await db.flush()
