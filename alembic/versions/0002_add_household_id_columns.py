"""Add FK constraints on household_id for 5 entity tables.

Migration 0001 created the household_id column as a plain UUID column on the 5 entity
tables (catalog, brew_log, inventory_bags, hardware, maintenance_log). This migration
adds the FK constraint REFERENCES households(id) to enforce household scoping.

This split prevents FK violation during M2 data insertion before households are seeded.
See plan.md R-2 and DEC-T02.

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-11
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_foreign_key(
        "fk_catalog_household_id", "catalog", "households", ["household_id"], ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_brew_log_household_id", "brew_log", "households", ["household_id"], ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_inventory_bags_household_id",
        "inventory_bags",
        "households",
        ["household_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_hardware_household_id", "hardware", "households", ["household_id"], ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_maintenance_log_household_id",
        "maintenance_log",
        "households",
        ["household_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint("fk_maintenance_log_household_id", "maintenance_log", type_="foreignkey")
    op.drop_constraint("fk_hardware_household_id", "hardware", type_="foreignkey")
    op.drop_constraint(
        "fk_inventory_bags_household_id", "inventory_bags", type_="foreignkey"
    )
    op.drop_constraint("fk_brew_log_household_id", "brew_log", type_="foreignkey")
    op.drop_constraint("fk_catalog_household_id", "catalog", type_="foreignkey")
