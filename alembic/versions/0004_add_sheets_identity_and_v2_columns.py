"""Add sheets_id identity columns and missing v2 application columns.

All M2 SQL repos have FIXME comments noting that Sheets string PKs are
not stored and must be added before M4 read switchover. M3 requires these
same columns as upsert conflict targets one phase earlier.

sheets_id columns are added as TEXT UNIQUE NULLABLE so they can be
backfilled by the M3 migration script without a default. A subsequent
migration (post-M3 gate) will add NOT NULL constraints once backfill
is confirmed complete.

Revision ID: 0004
Revises: 0003
Create Date: 2026-05-10
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # catalog: identity + Sheets-only columns
    op.add_column("catalog", sa.Column("sheets_id", sa.Text(), nullable=True))
    op.add_column("catalog", sa.Column("product_url", sa.Text(), nullable=True))
    op.add_column("catalog", sa.Column("local_image_path", sa.Text(), nullable=True))
    op.create_unique_constraint("uq_catalog_sheets_id", "catalog", ["sheets_id"])

    # inventory_bags: identity + Sheets-only v2 columns
    op.add_column("inventory_bags", sa.Column("sheets_id", sa.Text(), nullable=True))
    op.add_column("inventory_bags", sa.Column("beans", sa.Text(), nullable=True))
    op.add_column("inventory_bags", sa.Column("display_name", sa.Text(), nullable=True))
    op.add_column("inventory_bags", sa.Column("roast_level", sa.Text(), nullable=True))
    op.add_column("inventory_bags", sa.Column("status", sa.Text(), nullable=True))
    op.add_column("inventory_bags", sa.Column("storage_method", sa.Text(), nullable=True))
    op.create_unique_constraint("uq_inventory_bags_sheets_id", "inventory_bags", ["sheets_id"])

    # hardware: identity + Sheets-only columns
    op.add_column("hardware", sa.Column("sheets_id", sa.Text(), nullable=True))
    op.add_column("hardware", sa.Column("product_url", sa.Text(), nullable=True))
    op.add_column("hardware", sa.Column("local_image_path", sa.Text(), nullable=True))
    op.create_unique_constraint("uq_hardware_sheets_id", "hardware", ["sheets_id"])

    # maintenance_log: identity only (action, performed_at, notes already exist)
    op.add_column("maintenance_log", sa.Column("sheets_id", sa.Text(), nullable=True))
    op.create_unique_constraint(
        "uq_maintenance_log_sheets_id", "maintenance_log", ["sheets_id"]
    )

    # brew_log: identity + full Sheets v2 column set
    op.add_column("brew_log", sa.Column("sheets_id", sa.Text(), nullable=True))
    op.add_column("brew_log", sa.Column("bag_id", sa.Text(), nullable=True))
    op.add_column("brew_log", sa.Column("machine_id", sa.Text(), nullable=True))
    op.add_column("brew_log", sa.Column("grinder_id", sa.Text(), nullable=True))
    op.add_column("brew_log", sa.Column("basket_id", sa.Text(), nullable=True))
    op.add_column(
        "brew_log",
        sa.Column("grind_setting", sa.Numeric(precision=5, scale=1), nullable=True),
    )
    op.add_column("brew_log", sa.Column("shot_eligibility", sa.Text(), nullable=True))
    op.add_column("brew_log", sa.Column("taste_summary", sa.Text(), nullable=True))
    op.add_column("brew_log", sa.Column("ai_feedback", sa.Text(), nullable=True))
    op.add_column("brew_log", sa.Column("storage_method", sa.Text(), nullable=True))
    op.create_unique_constraint("uq_brew_log_sheets_id", "brew_log", ["sheets_id"])


def downgrade() -> None:
    op.drop_constraint("uq_brew_log_sheets_id", "brew_log", type_="unique")
    for col in (
        "storage_method",
        "ai_feedback",
        "taste_summary",
        "shot_eligibility",
        "grind_setting",
        "basket_id",
        "grinder_id",
        "machine_id",
        "bag_id",
        "sheets_id",
    ):
        op.drop_column("brew_log", col)

    op.drop_constraint("uq_maintenance_log_sheets_id", "maintenance_log", type_="unique")
    op.drop_column("maintenance_log", "sheets_id")

    op.drop_constraint("uq_hardware_sheets_id", "hardware", type_="unique")
    for col in ("local_image_path", "product_url", "sheets_id"):
        op.drop_column("hardware", col)

    op.drop_constraint("uq_inventory_bags_sheets_id", "inventory_bags", type_="unique")
    for col in (
        "storage_method",
        "status",
        "roast_level",
        "display_name",
        "beans",
        "sheets_id",
    ):
        op.drop_column("inventory_bags", col)

    op.drop_constraint("uq_catalog_sheets_id", "catalog", type_="unique")
    for col in ("local_image_path", "product_url", "sheets_id"):
        op.drop_column("catalog", col)
