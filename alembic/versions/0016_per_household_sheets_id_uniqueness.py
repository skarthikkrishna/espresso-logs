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
import sqlalchemy as sa

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


def _preflight_tenant_sheets_ids() -> None:
    """Fail closed if existing data cannot satisfy household-local uniqueness."""
    bind = op.get_bind()
    for table_name, _, _ in TABLES:
        null_household_count = bind.execute(
            sa.text(
                f"""
                SELECT count(*)
                FROM {table_name}
                WHERE sheets_id IS NOT NULL
                  AND household_id IS NULL
                """
            )
        ).scalar_one()
        if null_household_count:
            raise RuntimeError(
                f"Migration 0016 preflight failed for {table_name}: "
                "rows with sheets_id and NULL household_id exist"
            )

        duplicate_count = bind.execute(
            sa.text(
                f"""
                SELECT count(*)
                FROM (
                    SELECT household_id, sheets_id
                    FROM {table_name}
                    WHERE household_id IS NOT NULL
                      AND sheets_id IS NOT NULL
                    GROUP BY household_id, sheets_id
                    HAVING count(*) > 1
                ) duplicates
                """
            )
        ).scalar_one()
        if duplicate_count:
            raise RuntimeError(
                f"Migration 0016 preflight failed for {table_name}: "
                "duplicate non-null household_id/sheets_id pairs exist"
            )


def upgrade() -> None:
    """Replace global Sheets ID uniqueness with household-local uniqueness."""
    _preflight_tenant_sheets_ids()
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
