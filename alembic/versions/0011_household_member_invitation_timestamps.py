"""Add invited_at and accepted_at to household_members.

Revision ID: 0011
Revises: 0010
Create Date: 2026-05-23
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0011"
down_revision: Union[str, None] = "0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("household_members", sa.Column("invited_at", sa.TIMESTAMP(timezone=True), nullable=True))
    op.add_column("household_members", sa.Column("accepted_at", sa.TIMESTAMP(timezone=True), nullable=True))
    op.execute(
        sa.text(
            """
            UPDATE household_members
            SET invited_at = joined_at,
                accepted_at = joined_at
            WHERE invited_by IS NOT NULL
            """
        )
    )


def downgrade() -> None:
    op.drop_column("household_members", "accepted_at")
    op.drop_column("household_members", "invited_at")
