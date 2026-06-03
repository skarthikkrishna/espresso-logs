"""Tests for the RefreshToken ORM model.

Unit tests — no database connection required.
"""

from __future__ import annotations

from app.models.auth import RefreshToken


def test_refresh_token_table_name() -> None:
    assert RefreshToken.__tablename__ == "refresh_tokens"


def test_refresh_token_columns() -> None:
    expected = {
        "id",
        "user_id",
        "token_hash",
        "expires_at",
        "revoked",
        "rotated_at",
        "created_at",
    }
    assert expected == set(RefreshToken.__table__.columns.keys())


def test_token_hash_is_unique() -> None:
    col = RefreshToken.__table__.columns["token_hash"]
    assert col.unique


def test_revoked_has_server_default() -> None:
    col = RefreshToken.__table__.columns["revoked"]
    assert col.server_default is not None


def test_user_id_index_exists() -> None:
    index_names = {i.name for i in RefreshToken.__table__.indexes}
    assert "ix_refresh_tokens_user_id" in index_names


def test_token_hash_has_no_redundant_index() -> None:
    # UNIQUE constraint on token_hash creates an implicit Postgres index;
    # the explicit ix_refresh_tokens_token_hash was redundant and has been removed.
    index_names = {i.name for i in RefreshToken.__table__.indexes}
    assert "ix_refresh_tokens_token_hash" not in index_names


def test_rotated_at_has_no_index() -> None:
    index_columns = {
        column.name for index in RefreshToken.__table__.indexes for column in index.columns
    }
    assert "rotated_at" not in index_columns
