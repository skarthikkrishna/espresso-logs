"""Add brew-log idempotency keys and fail-closed RLS policies.

Revision ID: 0014
Revises: 0013
Create Date: 2026-06-06

Downgrade notes: rollback removes the idempotency columns/index and restores the
previous household_isolation predicate shape. It does not mutate production data;
operator-approved cleanup remains out of scope.
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0014"
down_revision: Union[str, None] = "0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TENANT_SCOPED_TABLES: tuple[str, ...] = (
    "brew_log",
    "catalog",
    "inventory_bags",
    "hardware",
    "maintenance_log",
)

_FAIL_CLOSED_HOUSEHOLD_EXPR = (
    "household_id = NULLIF(current_setting('app.current_household_id', TRUE), '')::uuid"
)
_PREVIOUS_HOUSEHOLD_EXPR = "household_id = current_setting('app.current_household_id', TRUE)::uuid"


def _replace_household_policy(predicate: str) -> None:
    for table in TENANT_SCOPED_TABLES:
        op.execute(f"DROP POLICY IF EXISTS household_isolation ON {table}")
        op.execute(
            f"""
            CREATE POLICY household_isolation ON {table}
              USING ({predicate})
              WITH CHECK ({predicate})
            """
        )


def upgrade() -> None:
    op.add_column("brew_log", sa.Column("idempotency_key", sa.Text(), nullable=True))
    op.add_column("brew_log", sa.Column("idempotency_request_hash", sa.Text(), nullable=True))
    op.create_index(
        "uq_brew_log_household_idempotency_key",
        "brew_log",
        ["household_id", "idempotency_key"],
        unique=True,
        postgresql_where=sa.text("idempotency_key IS NOT NULL"),
    )
    _replace_household_policy(_FAIL_CLOSED_HOUSEHOLD_EXPR)


def downgrade() -> None:
    _replace_household_policy(_PREVIOUS_HOUSEHOLD_EXPR)
    op.drop_index("uq_brew_log_household_idempotency_key", table_name="brew_log")
    op.drop_column("brew_log", "idempotency_request_hash")
    op.drop_column("brew_log", "idempotency_key")
