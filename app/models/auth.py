"""SQLAlchemy ORM model for the `refresh_tokens` table.

Raw tokens are never stored — only the token hash (SHA-256 or argon2).
Indexes on user_id and token_hash are declared explicitly for lookup performance.
"""
from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class RefreshToken(Base):
    """Persisted refresh token (hash only — raw token discarded after issue)."""

    __tablename__ = "refresh_tokens"
    __table_args__ = (
        sa.Index("ix_refresh_tokens_user_id", "user_id"),
        sa.Index("ix_refresh_tokens_token_hash", "token_hash"),
    )

    id: Mapped[sa.UUID] = mapped_column(
        sa.UUID(as_uuid=True),
        primary_key=True,
        server_default=sa.text("gen_random_uuid()"),
    )
    user_id: Mapped[sa.UUID] = mapped_column(
        sa.UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    token_hash: Mapped[str] = mapped_column(sa.Text, nullable=False, unique=True)
    expires_at: Mapped[sa.DateTime] = mapped_column(
        sa.TIMESTAMP(timezone=True), nullable=False
    )
    revoked: Mapped[bool] = mapped_column(
        sa.Boolean, nullable=False, server_default=sa.text("FALSE")
    )
    created_at: Mapped[sa.DateTime] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        nullable=False,
        server_default=sa.text("now()"),
    )
