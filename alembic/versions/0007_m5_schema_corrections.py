"""M5 schema corrections — token_hash columns, RLS, oauth_states, invited_by FK fix.

This migration is the complete M5 schema delta:
1. pending_invitations: drop UUID token, add token_hash TEXT + revoked_at
2. guest_tokens: drop UUID token, add token_hash TEXT + expires_at
3. households: add is_guest_accessible BOOLEAN
4. household_members.invited_by: fix FK from household_members.id → users.id
5. oauth_states: new table for PKCE verifier storage (replaces SessionMiddleware)
6. RLS: enable on all 5 tenant tables + household_isolation policy (idempotent)
7. app_admin role: BYPASSRLS for operational queries (idempotent)

Revision ID: 0007
Revises: 0006
Create Date: 2026-05-21
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # 1. Fix pending_invitations: UUID token → token_hash TEXT
    # ------------------------------------------------------------------
    op.drop_column("pending_invitations", "token")
    op.add_column(
        "pending_invitations",
        sa.Column("token_hash", sa.Text(), nullable=False, server_default=""),
    )
    op.create_unique_constraint(
        "uq_pending_invitations_token_hash", "pending_invitations", ["token_hash"]
    )
    op.alter_column("pending_invitations", "token_hash", server_default=None)
    op.add_column(
        "pending_invitations",
        sa.Column("revoked_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_pending_invitations_token_hash", "pending_invitations", ["token_hash"]
    )

    # ------------------------------------------------------------------
    # 2. Fix guest_tokens: UUID token → token_hash TEXT + expires_at
    # ------------------------------------------------------------------
    op.drop_column("guest_tokens", "token")
    op.add_column(
        "guest_tokens",
        sa.Column("token_hash", sa.Text(), nullable=False, server_default=""),
    )
    op.create_unique_constraint(
        "uq_guest_tokens_token_hash", "guest_tokens", ["token_hash"]
    )
    op.alter_column("guest_tokens", "token_hash", server_default=None)
    op.add_column(
        "guest_tokens",
        sa.Column("expires_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )
    op.create_index("ix_guest_tokens_token_hash", "guest_tokens", ["token_hash"])

    # ------------------------------------------------------------------
    # 3. households: add is_guest_accessible
    # ------------------------------------------------------------------
    op.add_column(
        "households",
        sa.Column(
            "is_guest_accessible",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("FALSE"),
        ),
    )

    # ------------------------------------------------------------------
    # 4. Fix household_members.invited_by FK: → users(id)
    # ------------------------------------------------------------------
    op.drop_constraint(
        "household_members_invited_by_fkey",
        "household_members",
        type_="foreignkey",
    )
    op.create_foreign_key(
        "fk_household_members_invited_by_users",
        "household_members",
        "users",
        ["invited_by"],
        ["id"],
        ondelete="SET NULL",
    )

    # ------------------------------------------------------------------
    # 5. Create oauth_states table (PKCE verifier storage)
    # ------------------------------------------------------------------
    op.create_table(
        "oauth_states",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("state_hash", sa.Text(), nullable=False),
        sa.Column("pkce_verifier", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("state_hash"),
    )
    op.create_index("ix_oauth_states_state_hash", "oauth_states", ["state_hash"])

    # ------------------------------------------------------------------
    # 6. Enable RLS on all 5 tenant tables + household_isolation policy
    # ------------------------------------------------------------------
    op.execute("ALTER TABLE brew_log ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE catalog ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE inventory_bags ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE hardware ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE maintenance_log ENABLE ROW LEVEL SECURITY")

    for table in ("brew_log", "catalog", "inventory_bags", "hardware", "maintenance_log"):
        op.execute(
            f"""
            DO $$ BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM pg_policies
                WHERE policyname = 'household_isolation' AND tablename = '{table}'
              ) THEN
                CREATE POLICY household_isolation ON {table}
                  USING (household_id = current_setting('app.current_household_id', TRUE)::uuid);
              END IF;
            END $$
            """
        )

    # ------------------------------------------------------------------
    # 7. app_admin role with BYPASSRLS (idempotent; skipped gracefully if
    #    the migration user lacks superuser privilege — expected in local dev).
    # ------------------------------------------------------------------
    op.execute(
        """
        DO $$ BEGIN
          IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_admin') THEN
            BEGIN
              CREATE ROLE app_admin BYPASSRLS;
            EXCEPTION WHEN insufficient_privilege THEN
              RAISE NOTICE 'Skipping app_admin BYPASSRLS role creation — insufficient privilege (expected in local dev; runs in production with Cloud SQL admin)';
            END;
          END IF;
        END $$
        """
    )
    op.execute(
        """
        DO $$ BEGIN
          IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'coffee_tracker_runtime')
             AND EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_admin') THEN
            BEGIN
              GRANT app_admin TO coffee_tracker_runtime;
            EXCEPTION WHEN insufficient_privilege THEN
              RAISE NOTICE 'Skipping GRANT app_admin TO coffee_tracker_runtime — insufficient privilege';
            END;
          END IF;
        END $$
        """
    )


def downgrade() -> None:
    # ------------------------------------------------------------------
    # 7. Revoke app_admin role
    # ------------------------------------------------------------------
    op.execute(
        """
        DO $$ BEGIN
          IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'coffee_tracker_runtime')
             AND EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_admin') THEN
            REVOKE app_admin FROM coffee_tracker_runtime;
          END IF;
        END $$
        """
    )
    op.execute(
        """
        DO $$ BEGIN
          IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_admin') THEN
            BEGIN
              DROP ROLE app_admin;
            EXCEPTION WHEN insufficient_privilege THEN
              RAISE NOTICE 'Skipping DROP ROLE app_admin — insufficient privilege';
            END;
          END IF;
        END $$
        """
    )

    # ------------------------------------------------------------------
    # 6. Disable RLS and drop policies
    # ------------------------------------------------------------------
    for table in ("brew_log", "catalog", "inventory_bags", "hardware", "maintenance_log"):
        op.execute(f"DROP POLICY IF EXISTS household_isolation ON {table}")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")

    # ------------------------------------------------------------------
    # 5. Drop oauth_states table
    # ------------------------------------------------------------------
    op.drop_index("ix_oauth_states_state_hash", table_name="oauth_states")
    op.drop_table("oauth_states")

    # ------------------------------------------------------------------
    # 4. Restore household_members.invited_by FK → household_members(id)
    # ------------------------------------------------------------------
    op.drop_constraint(
        "fk_household_members_invited_by_users",
        "household_members",
        type_="foreignkey",
    )
    op.create_foreign_key(
        "household_members_invited_by_fkey",
        "household_members",
        "household_members",
        ["invited_by"],
        ["id"],
        ondelete="SET NULL",
    )

    # ------------------------------------------------------------------
    # 3. Drop is_guest_accessible from households
    # ------------------------------------------------------------------
    op.drop_column("households", "is_guest_accessible")

    # ------------------------------------------------------------------
    # 2. Restore guest_tokens: drop token_hash/expires_at, re-add UUID token
    # ------------------------------------------------------------------
    op.drop_index("ix_guest_tokens_token_hash", table_name="guest_tokens")
    op.drop_constraint("uq_guest_tokens_token_hash", "guest_tokens", type_="unique")
    op.drop_column("guest_tokens", "token_hash")
    op.drop_column("guest_tokens", "expires_at")
    op.add_column(
        "guest_tokens",
        sa.Column(
            "token",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
    )
    op.create_unique_constraint("guest_tokens_token_key", "guest_tokens", ["token"])

    # ------------------------------------------------------------------
    # 1. Restore pending_invitations: drop token_hash/revoked_at, re-add UUID token
    # ------------------------------------------------------------------
    op.drop_index("ix_pending_invitations_token_hash", table_name="pending_invitations")
    op.drop_constraint(
        "uq_pending_invitations_token_hash", "pending_invitations", type_="unique"
    )
    op.drop_column("pending_invitations", "token_hash")
    op.drop_column("pending_invitations", "revoked_at")
    op.add_column(
        "pending_invitations",
        sa.Column(
            "token",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
    )
    op.create_unique_constraint("pending_invitations_token_key", "pending_invitations", ["token"])
