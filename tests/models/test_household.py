"""Tests for household ORM models.

Unit tests — no database connection required.
"""

from __future__ import annotations

from app.models.household import GuestToken, Household, HouseholdMember, PendingInvitation


def test_household_table_name() -> None:
    assert Household.__tablename__ == "households"


def test_household_member_table_name() -> None:
    assert HouseholdMember.__tablename__ == "household_members"


def test_pending_invitation_table_name() -> None:
    assert PendingInvitation.__tablename__ == "pending_invitations"


def test_guest_token_table_name() -> None:
    assert GuestToken.__tablename__ == "guest_tokens"


def test_household_member_role_check_constraint() -> None:
    constraint_names = {c.name for c in HouseholdMember.__table__.constraints}
    assert "household_members_role_check" in constraint_names


def test_household_member_role_check_includes_admin_and_member() -> None:
    import sqlalchemy as sa

    check = next(
        c
        for c in HouseholdMember.__table__.constraints
        if isinstance(c, sa.CheckConstraint) and c.name == "household_members_role_check"
    )
    sql_text = str(check.sqltext)
    assert "admin" in sql_text
    assert "member" in sql_text


def test_household_member_unique_constraint() -> None:
    constraint_names = {c.name for c in HouseholdMember.__table__.constraints}
    assert "uq_household_members_household_user" in constraint_names


def test_guest_token_has_household_id_index() -> None:
    index_names = {i.name for i in GuestToken.__table__.indexes}
    assert "ix_guest_tokens_household_id" in index_names


def test_guest_token_token_hash_is_unique() -> None:
    # M5: UUID token replaced with token_hash TEXT (SHA-256 hex digest).
    # UNIQUE constraint on token_hash ensures no duplicate hashes are stored.
    col = GuestToken.__table__.columns["token_hash"]
    assert col.unique
