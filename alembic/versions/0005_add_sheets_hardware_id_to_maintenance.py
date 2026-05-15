"""Add sheets_hardware_id to maintenance_log for cross-reference filtering.

The maintenance_log.hardware_id column stores a Postgres UUID FK. Routers
pass Sheets Hardware_IDs (e.g. "HW001") when filtering maintenance events.
This column bridges the gap so list(hardware_id=hw_id) can filter by the
Sheets string identifier without a join.

Revision ID: 0005
Revises: 0004
Create Date: 2026-05-14
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("maintenance_log", sa.Column("sheets_hardware_id", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("maintenance_log", "sheets_hardware_id")
