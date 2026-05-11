"""Make household_id nullable on 5 entity tables for M2 dual-write shadow.

M2 writes with household_id=NULL (intentional — M5 will populate this column
after the household model is implemented). The M1 schema defined household_id
as NOT NULL, which would reject every M2 write. This migration drops the NOT
NULL constraint while preserving the FK constraint added in 0002.

Revision ID: 0003
Revises: 0002
"""
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for table in ("catalog", "brew_log", "inventory_bags", "hardware", "maintenance_log"):
        op.alter_column(table, "household_id", nullable=True)


def downgrade() -> None:
    for table in ("catalog", "brew_log", "inventory_bags", "hardware", "maintenance_log"):
        op.alter_column(table, "household_id", nullable=False)
