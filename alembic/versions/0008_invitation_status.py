"""Add invitation status and invited_role columns.

Revision ID: 0008
Revises: 0007
Create Date: 2026-05-23
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "pending_invitations",
        sa.Column("invited_role", sa.Text(), nullable=False, server_default="member"),
    )
    op.add_column(
        "pending_invitations",
        sa.Column("status", sa.Text(), nullable=False, server_default="pending"),
    )
    op.create_check_constraint(
        "pending_invitations_invited_role_check",
        "pending_invitations",
        "invited_role IN ('admin', 'member')",
    )
    op.create_check_constraint(
        "pending_invitations_status_check",
        "pending_invitations",
        "status IN ('pending', 'accepted', 'declined', 'revoked')",
    )
    op.alter_column("pending_invitations", "invited_role", server_default=None)
    op.alter_column("pending_invitations", "status", server_default=None)


def downgrade() -> None:
    op.drop_constraint(
        "pending_invitations_status_check",
        "pending_invitations",
        type_="check",
    )
    op.drop_constraint(
        "pending_invitations_invited_role_check",
        "pending_invitations",
        type_="check",
    )
    op.drop_column("pending_invitations", "status")
    op.drop_column("pending_invitations", "invited_role")
