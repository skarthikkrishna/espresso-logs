"""SQLAlchemy ORM models for household management.

Tables: households, household_members, pending_invitations, guest_tokens, oauth_states.
Role constraint uses canonical term 'admin' (not 'manager') per DEC-T01.
M5: token_hash columns replace UUID token columns; invited_by FK corrected to users(id).
"""

from __future__ import annotations

import datetime
import uuid
from typing import Any, Literal, TypeAlias

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

HouseholdRole: TypeAlias = Literal["admin", "member"]
InvitationStatus: TypeAlias = Literal["pending", "accepted", "declined", "revoked"]


class Household(Base):
    """A household groups users sharing a coffee setup."""

    __tablename__ = "households"

    id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True),
        primary_key=True,
        server_default=sa.text("gen_random_uuid()"),
    )
    name: Mapped[str] = mapped_column(sa.Text, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        nullable=False,
        server_default=sa.text("now()"),
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True),
        sa.ForeignKey("users.id"),
        nullable=False,
    )
    is_guest_accessible: Mapped[bool] = mapped_column(
        sa.Boolean,
        nullable=False,
        server_default=sa.text("FALSE"),
    )
    deleted_at: Mapped[datetime.datetime | None] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        nullable=True,
    )


class HouseholdMember(Base):
    """Membership record linking a user to a household with a role."""

    __tablename__ = "household_members"
    __table_args__ = (
        sa.CheckConstraint("role IN ('admin', 'member')", name="household_members_role_check"),
        sa.UniqueConstraint("household_id", "user_id", name="uq_household_members_household_user"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True),
        primary_key=True,
        server_default=sa.text("gen_random_uuid()"),
    )
    household_id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True),
        sa.ForeignKey("households.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True),
        sa.ForeignKey("users.id"),
        nullable=False,
    )
    role: Mapped[str] = mapped_column(sa.Text, nullable=False)
    invited_by: Mapped[uuid.UUID | None] = mapped_column(
        sa.UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    invited_at: Mapped[datetime.datetime | None] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        nullable=True,
    )
    accepted_at: Mapped[datetime.datetime | None] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        nullable=True,
    )
    joined_at: Mapped[datetime.datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        nullable=False,
        server_default=sa.text("now()"),
    )


class PendingInvitation(Base):
    """A pending invitation to join a household, identified by a hashed token."""

    __tablename__ = "pending_invitations"
    __table_args__ = (
        sa.CheckConstraint(
            "invited_role IN ('admin', 'member')",
            name="pending_invitations_invited_role_check",
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'accepted', 'declined', 'revoked')",
            name="pending_invitations_status_check",
        ),
        sa.Index(
            "ix_pending_invitations_household_status_expires",
            "household_id",
            "status",
            "expires_at",
        ),
        sa.Index(
            "ix_pending_invitations_household_email_status",
            "household_id",
            sa.func.lower(sa.column("invited_email")),
            "status",
            postgresql_where=sa.text("invited_email IS NOT NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True),
        primary_key=True,
        server_default=sa.text("gen_random_uuid()"),
    )
    household_id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True),
        sa.ForeignKey("households.id", ondelete="CASCADE"),
        nullable=False,
    )
    invited_email: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    invited_role: Mapped[HouseholdRole] = mapped_column(
        sa.Text,
        nullable=False,
        server_default="member",
    )
    status: Mapped[InvitationStatus] = mapped_column(
        sa.Text,
        nullable=False,
        server_default="pending",
    )
    token_hash: Mapped[str] = mapped_column(sa.Text, nullable=False, unique=True)
    display_token_ciphertext: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    invited_by_user_id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True),
        sa.ForeignKey("users.id"),
        nullable=False,
    )
    invited_at: Mapped[datetime.datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        nullable=False,
        server_default=sa.text("now()"),
    )
    expires_at: Mapped[datetime.datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        nullable=False,
        server_default=sa.text("now() + INTERVAL '72 hours'"),
    )
    accepted_at: Mapped[datetime.datetime | None] = mapped_column(
        sa.TIMESTAMP(timezone=True), nullable=True
    )
    revoked_at: Mapped[datetime.datetime | None] = mapped_column(
        sa.TIMESTAMP(timezone=True), nullable=True
    )


class GuestToken(Base):
    """A guest access token granting read-only access to a household's data."""

    __tablename__ = "guest_tokens"
    __table_args__ = (
        sa.Index("ix_guest_tokens_household_id", "household_id"),
        sa.Index(
            "uq_guest_tokens_active_household",
            "household_id",
            unique=True,
            postgresql_where=sa.text("revoked_at IS NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True),
        primary_key=True,
        server_default=sa.text("gen_random_uuid()"),
    )
    household_id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True),
        sa.ForeignKey("households.id", ondelete="CASCADE"),
        nullable=False,
    )
    token_hash: Mapped[str] = mapped_column(sa.Text, nullable=False, unique=True)
    display_token_ciphertext: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    created_by_user_id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True),
        sa.ForeignKey("users.id"),
        nullable=False,
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        nullable=False,
        server_default=sa.text("now()"),
    )
    expires_at: Mapped[datetime.datetime | None] = mapped_column(
        sa.TIMESTAMP(timezone=True), nullable=True
    )
    revoked_at: Mapped[datetime.datetime | None] = mapped_column(
        sa.TIMESTAMP(timezone=True), nullable=True
    )


class ImportSession(Base):
    """DB-backed import wizard session state."""

    __tablename__ = "import_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True),
        primary_key=True,
        server_default=sa.text("gen_random_uuid()"),
    )
    household_id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True),
        sa.ForeignKey("households.id", ondelete="CASCADE"),
        nullable=False,
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True),
        sa.ForeignKey("users.id"),
        nullable=False,
    )
    state: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        server_default=sa.text("'{}'::jsonb"),
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        nullable=False,
        server_default=sa.text("now()"),
    )
    expires_at: Mapped[datetime.datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        nullable=False,
        server_default=sa.text("now() + interval '2 hours'"),
    )


class OAuthState(Base):
    """PKCE OAuth state record — replaces SessionMiddleware for verifier storage."""

    __tablename__ = "oauth_states"
    __table_args__ = (sa.Index("ix_oauth_states_state_hash", "state_hash"),)

    id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True),
        primary_key=True,
        server_default=sa.text("gen_random_uuid()"),
    )
    state_hash: Mapped[str] = mapped_column(sa.Text, nullable=False, unique=True)
    pkce_verifier: Mapped[str] = mapped_column(sa.Text, nullable=False)
    expires_at: Mapped[datetime.datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True), nullable=False
    )
