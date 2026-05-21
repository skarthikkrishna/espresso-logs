"""UserRepo — async SQLAlchemy data access for the `users` table (M5)."""

from __future__ import annotations

import uuid

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


class UserRepo:
    """CRUD and state-management methods for User rows."""

    async def get_by_id(self, db: AsyncSession, user_id: uuid.UUID) -> User | None:
        result = await db.execute(sa.select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_by_username(self, db: AsyncSession, username: str) -> User | None:
        """Case-insensitive lookup (AC-012)."""
        result = await db.execute(
            sa.select(User).where(sa.func.lower(User.username) == sa.func.lower(username))
        )
        return result.scalar_one_or_none()

    async def get_by_google_sub(self, db: AsyncSession, google_sub: str) -> User | None:
        result = await db.execute(sa.select(User).where(User.google_sub == google_sub))
        return result.scalar_one_or_none()

    async def create(
        self,
        db: AsyncSession,
        *,
        username: str | None,
        password_hash: str | None,
        google_sub: str | None,
        email: str | None,
        display_name: str,
        picture_url: str | None,
    ) -> User:
        """Insert a new user row. Caller is responsible for committing."""
        user = User(
            username=username,
            password_hash=password_hash,
            google_sub=google_sub,
            email=email,
            display_name=display_name,
            picture_url=picture_url,
        )
        db.add(user)
        await db.flush()
        await db.refresh(user)
        return user

    async def increment_login_attempts(self, db: AsyncSession, user_id: uuid.UUID) -> None:
        """Increment failed login counter; lock account at 10 attempts (AC-023)."""
        # First increment
        await db.execute(
            sa.update(User).where(User.id == user_id).values(login_attempts=User.login_attempts + 1)
        )
        # Then lock if now at or above 10
        await db.execute(
            sa.update(User)
            .where(User.id == user_id, User.login_attempts >= 10, User.locked_until.is_(None))
            .values(locked_until=sa.text("NOW() + INTERVAL '15 minutes'"))
        )
        await db.flush()

    async def reset_login_state(self, db: AsyncSession, user_id: uuid.UUID) -> None:
        """Clear failed-login counter and any lock (AC-024)."""
        await db.execute(
            sa.update(User).where(User.id == user_id).values(login_attempts=0, locked_until=None)
        )
        await db.flush()

    async def update_password_hash(
        self, db: AsyncSession, user_id: uuid.UUID, new_hash: str
    ) -> None:
        await db.execute(sa.update(User).where(User.id == user_id).values(password_hash=new_hash))
        await db.flush()

    async def update_last_seen(self, db: AsyncSession, user_id: uuid.UUID) -> None:
        await db.execute(
            sa.update(User).where(User.id == user_id).values(last_seen_at=sa.text("NOW()"))
        )
        await db.flush()
