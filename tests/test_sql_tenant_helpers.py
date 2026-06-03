"""Tests for app/repos/sql/tenant.py helpers."""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock

from app.repos.sql.tenant import (
    current_household_id,
    parse_uuid,
    row_household_id_or_context,
)


class TestParseUuid:
    """parse_uuid — sync helper used throughout SQL tenant repos."""

    def test_none_returns_none(self) -> None:
        assert parse_uuid(None) is None

    def test_empty_string_returns_none(self) -> None:
        assert parse_uuid("") is None

    def test_uuid_instance_returned_unchanged(self) -> None:
        val = uuid.uuid4()
        assert parse_uuid(val) is val

    def test_string_uuid_parsed(self) -> None:
        val = uuid.uuid4()
        result = parse_uuid(str(val))
        assert result == val
        assert isinstance(result, uuid.UUID)


class TestCurrentHouseholdId:
    """current_household_id — async DB helper."""

    async def test_returns_uuid_when_setting_present(self) -> None:
        val = uuid.uuid4()
        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = str(val)
        db.execute.return_value = mock_result

        result = await current_household_id(db)

        assert result == val
        db.execute.assert_awaited_once()

    async def test_returns_none_when_setting_empty(self) -> None:
        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        db.execute.return_value = mock_result

        result = await current_household_id(db)

        assert result is None


class TestRowHouseholdIdOrContext:
    """row_household_id_or_context — prefer row column, fall back to DB setting."""

    async def test_uses_row_household_id_key(self) -> None:
        val = uuid.uuid4()
        db = AsyncMock()
        row = {"household_id": str(val)}

        result = await row_household_id_or_context(db, row)

        assert result == val
        db.execute.assert_not_awaited()

    async def test_uses_row_Household_ID_key(self) -> None:
        val = uuid.uuid4()
        db = AsyncMock()
        row = {"Household_ID": str(val)}

        result = await row_household_id_or_context(db, row)

        assert result == val

    async def test_falls_back_to_db_setting_when_row_missing(self) -> None:
        val = uuid.uuid4()
        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = str(val)
        db.execute.return_value = mock_result

        result = await row_household_id_or_context(db, {})

        assert result == val
        db.execute.assert_awaited_once()
