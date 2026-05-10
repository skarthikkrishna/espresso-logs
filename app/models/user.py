"""SQLAlchemy ORM model for the `users` table.

Schema source: plan.md §4.1, eng-arch-v2 §5.2.
The CHECK constraint (users_has_identity) ensures every user has at least
one identity credential: a username+password OR a Google OAuth sub.
"""
from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class User(Base):
    """One row per authenticated user account."""

    __tablename__ = "users"
    __table_args__ = (
        sa.CheckConstraint(
            "username IS NOT NULL OR google_sub IS NOT NULL",
            name="users_has_identity",
        ),
    )

    id: Mapped[sa.UUID] = mapped_column(
        sa.UUID(as_uuid=True),
        primary_key=True,
        server_default=sa.text("gen_random_uuid()"),
    )
    username: Mapped[str | None] = mapped_column(sa.Text, unique=True, nullable=True)
    password_hash: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    google_sub: Mapped[str | None] = mapped_column(sa.Text, unique=True, nullable=True)
    email: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    display_name: Mapped[str] = mapped_column(sa.Text, nullable=False)
    picture_url: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    created_at: Mapped[sa.DateTime] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        nullable=False,
        server_default=sa.text("now()"),
    )
    last_seen_at: Mapped[sa.DateTime] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        nullable=False,
        server_default=sa.text("now()"),
    )
    # NFR-SEC3: brute-force protection fields
    login_attempts: Mapped[int] = mapped_column(
        sa.Integer,
        nullable=False,
        server_default=sa.text("0"),
    )
    locked_until: Mapped[sa.DateTime | None] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        nullable=True,
    )
