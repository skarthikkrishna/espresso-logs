"""SQLAlchemy ORM model for the `refresh_tokens` table.

Raw tokens are never stored — only the token hash (SHA-256 or argon2).
Indexes on user_id and token_hash are declared explicitly for lookup performance.
"""

from __future__ import annotations

import datetime
import uuid
import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class RefreshToken(Base):
    """Persisted refresh token (hash only — raw token discarded after issue)."""

    __tablename__ = "refresh_tokens"
    __table_args__ = (sa.Index("ix_refresh_tokens_user_id", "user_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True),
        primary_key=True,
        server_default=sa.text("gen_random_uuid()"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    token_hash: Mapped[str] = mapped_column(sa.Text, nullable=False, unique=True)
    expires_at: Mapped[datetime.datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True), nullable=False
    )
    revoked: Mapped[bool] = mapped_column(
        sa.Boolean, nullable=False, server_default=sa.text("FALSE")
    )
    rotated_at: Mapped[datetime.datetime | None] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        nullable=True,
        default=None,
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        nullable=False,
        server_default=sa.text("now()"),
    )
