"""Add sheets_catalog_id to inventory_bags for Sheets Catalog_ID cross-reference.

Revision ID: 0006
Revises: 0005
Create Date: 2026-05-15
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("inventory_bags", sa.Column("sheets_catalog_id", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("inventory_bags", "sheets_catalog_id")
