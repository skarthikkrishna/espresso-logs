"""Tests for the User ORM model.

These tests are unit tests — they do NOT require a database connection.
They verify the model's metadata (columns, constraints) are declared correctly.
"""

from __future__ import annotations


from app.models.user import User


def test_user_table_name() -> None:
    assert User.__tablename__ == "users"


def test_user_columns() -> None:
    expected_columns = {
        "id",
        "username",
        "password_hash",
        "google_sub",
        "email",
        "display_name",
        "picture_url",
        "active_household_id",
        "created_at",
        "last_seen_at",
        "login_attempts",
        "locked_until",
    }
    actual_columns = set(User.__table__.columns.keys())
    assert expected_columns == actual_columns


def test_user_has_identity_check_constraint() -> None:
    constraint_names = {c.name for c in User.__table__.constraints}
    assert "users_has_identity" in constraint_names


def test_user_login_attempts_has_server_default() -> None:
    col = User.__table__.columns["login_attempts"]
    assert col.server_default is not None


def test_user_username_is_unique() -> None:
    col = User.__table__.columns["username"]
    assert col.unique


def test_user_google_sub_is_unique() -> None:
    col = User.__table__.columns["google_sub"]
    assert col.unique


def test_user_active_household_has_set_null_foreign_key() -> None:
    col = User.__table__.columns["active_household_id"]
    foreign_keys = list(col.foreign_keys)
    assert len(foreign_keys) == 1
    assert foreign_keys[0].column.table.name == "households"
    assert foreign_keys[0].ondelete == "SET NULL"
