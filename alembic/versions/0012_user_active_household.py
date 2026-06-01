"""Add active_household_id to users.

Revision ID: 0012
Revises: 0011
Create Date: 2026-06-01
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0012"
down_revision: Union[str, None] = "0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("active_household_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_users_active_household_id_households",
        "users",
        "households",
        ["active_household_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_users_active_household_id_households", "users", type_="foreignkey")
    op.drop_column("users", "active_household_id")
