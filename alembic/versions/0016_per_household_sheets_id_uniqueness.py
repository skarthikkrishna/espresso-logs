"""Make Sheets IDs unique per household for tenant tables.

Postgres treats NULL values as distinct in composite unique constraints, so
rows with NULL household_id or NULL sheets_id do not collide. Multiple
NULL-household rows with the same sheets_id are therefore possible under this
constraint; that is acceptable for this non-destructive migration because the
validated local database has 0 such rows and household ownership is enforced by
the write paths and tenant/RLS gates.

Revision ID: 0016
Revises: 0015
Create Date: 2026-06-13
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0016"
down_revision: Union[str, None] = "0015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLES: tuple[tuple[str, str, str], ...] = (
    ("catalog", "uq_catalog_sheets_id", "uq_catalog_household_sheets_id"),
    (
        "inventory_bags",
        "uq_inventory_bags_sheets_id",
        "uq_inventory_bags_household_sheets_id",
    ),
    ("hardware", "uq_hardware_sheets_id", "uq_hardware_household_sheets_id"),
    (
        "maintenance_log",
        "uq_maintenance_log_sheets_id",
        "uq_maintenance_log_household_sheets_id",
    ),
    ("brew_log", "uq_brew_log_sheets_id", "uq_brew_log_household_sheets_id"),
)


def upgrade() -> None:
    """Replace global Sheets ID uniqueness with household-local uniqueness."""
    for table_name, old_constraint, new_constraint in TABLES:
        op.drop_constraint(old_constraint, table_name, type_="unique")
        op.create_unique_constraint(
            new_constraint,
            table_name,
            ["household_id", "sheets_id"],
        )


def downgrade() -> None:
    """Restore global Sheets ID uniqueness.

    This can fail if cross-household duplicate non-null sheets_id values exist,
    which is expected once household-local Sheets IDs are accepted.
    """
    for table_name, old_constraint, new_constraint in reversed(TABLES):
        op.drop_constraint(new_constraint, table_name, type_="unique")
        op.create_unique_constraint(old_constraint, table_name, ["sheets_id"])
