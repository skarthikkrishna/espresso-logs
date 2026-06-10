"""Add Spec-040 link-token display columns and indexes.

Revision ID: 0015
Revises: 0014
Create Date: 2026-06-09
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0015"
down_revision: Union[str, None] = "0014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "pending_invitations",
        sa.Column("display_token_ciphertext", sa.Text(), nullable=True),
    )
    op.add_column(
        "guest_tokens",
        sa.Column("display_token_ciphertext", sa.Text(), nullable=True),
    )
    op.create_index(
        "ix_pending_invitations_household_status_expires",
        "pending_invitations",
        ["household_id", "status", "expires_at"],
    )
    op.create_index(
        "ix_pending_invitations_household_email_status",
        "pending_invitations",
        ["household_id", sa.text("lower(invited_email)"), "status"],
        postgresql_where=sa.text("invited_email IS NOT NULL"),
    )
    op.create_index(
        "uq_guest_tokens_active_household",
        "guest_tokens",
        ["household_id"],
        unique=True,
        postgresql_where=sa.text("revoked_at IS NULL"),
    )
    op.execute(
        """
        UPDATE pending_invitations
        SET status = 'pending'
        WHERE status = 'declined'
          AND expires_at > NOW()
          AND accepted_at IS NULL
          AND revoked_at IS NULL
        """
    )


def downgrade() -> None:
    op.drop_index("uq_guest_tokens_active_household", table_name="guest_tokens")
    op.drop_index(
        "ix_pending_invitations_household_email_status",
        table_name="pending_invitations",
    )
    op.drop_index(
        "ix_pending_invitations_household_status_expires",
        table_name="pending_invitations",
    )
    op.drop_column("guest_tokens", "display_token_ciphertext")
    op.drop_column("pending_invitations", "display_token_ciphertext")
