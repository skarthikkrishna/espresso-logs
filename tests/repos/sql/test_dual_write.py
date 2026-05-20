"""Dual-write wrapper integration tests.

Uses unittest.mock to inject a failing SQL repo alongside a mock Sheets repo.
Tests the _DualWriteCatalogRepo behaviour (representative for all 5 wrappers).
"""

from __future__ import annotations

import logging
from unittest.mock import AsyncMock, MagicMock

from app.deps import _DualWriteBrewLogRepo, _DualWriteCatalogRepo


async def test_postgres_failure_does_not_propagate(caplog) -> None:  # type: ignore[no-untyped-def]
    """Postgres exception must NOT propagate to caller — US-02 AC-5."""
    sheets_mock = MagicMock()
    sql_mock = AsyncMock()
    sql_mock.upsert.side_effect = Exception("connection refused")

    wrapper = _DualWriteCatalogRepo(sheets=sheets_mock, sql=sql_mock)

    with caplog.at_level(logging.WARNING, logger="app.deps.dual_write"):
        await wrapper.upsert({"Roaster": "X", "Bean_Name": "Y"})
        # Must not raise — Postgres failure is suppressed

    sheets_mock.upsert.assert_called_once_with({"Roaster": "X", "Bean_Name": "Y"})
    sql_mock.upsert.assert_called_once()
    assert "Postgres write failed" in caplog.text


async def test_warning_log_contains_required_structured_fields(caplog) -> None:  # type: ignore[no-untyped-def]
    """WARNING log must contain component, entity_type, operation, error fields — US-03 AC-3."""
    sheets_mock = MagicMock()
    sql_mock = AsyncMock()
    sql_mock.upsert.side_effect = RuntimeError("timeout")

    wrapper = _DualWriteCatalogRepo(sheets=sheets_mock, sql=sql_mock)

    with caplog.at_level(logging.WARNING, logger="app.deps.dual_write"):
        await wrapper.upsert({"Roaster": "A", "Bean_Name": "B"})

    warning_records = [r for r in caplog.records if r.levelname == "WARNING"]
    assert len(warning_records) == 1  # Quinn note [1]: use == 1, not >= 1
    record = warning_records[0]
    assert record.component == "dual_write"  # type: ignore[attr-defined]
    assert record.entity_type == "catalog"  # type: ignore[attr-defined]
    assert record.operation == "upsert"  # type: ignore[attr-defined]
    assert "timeout" in record.error  # type: ignore[attr-defined]


async def test_sheets_write_called_before_postgres(caplog) -> None:  # type: ignore[no-untyped-def]
    """Sheets write must be called first (sequential, not concurrent) — plan Decision A."""
    call_order: list[str] = []

    sheets_mock = MagicMock()
    sheets_mock.upsert.side_effect = lambda row: call_order.append("sheets")

    sql_mock = AsyncMock()

    async def fake_upsert(row: dict) -> None:
        call_order.append("postgres")

    sql_mock.upsert.side_effect = fake_upsert

    wrapper = _DualWriteCatalogRepo(sheets=sheets_mock, sql=sql_mock)
    await wrapper.upsert({"Roaster": "A", "Bean_Name": "B"})

    assert call_order == ["sheets", "postgres"]  # Sheets always first


async def test_sheets_write_succeeds_when_postgres_fails() -> None:
    """Sheets write completes even when Postgres raises — Sheets is source of truth."""
    sheets_mock = MagicMock()
    sql_mock = AsyncMock()
    sql_mock.upsert.side_effect = Exception("DB down")

    wrapper = _DualWriteCatalogRepo(sheets=sheets_mock, sql=sql_mock)
    await wrapper.upsert({"Roaster": "A", "Bean_Name": "B"})

    sheets_mock.upsert.assert_called_once()  # Sheets write completed


async def test_read_methods_delegate_to_sheets_only() -> None:
    """Read methods must come from Sheets, never Postgres — US-02 AC-1."""
    sheets_mock = MagicMock()
    sheets_mock.list.return_value = [{"Roaster": "From Sheets"}]
    sql_mock = AsyncMock()

    wrapper = _DualWriteCatalogRepo(sheets=sheets_mock, sql=sql_mock)
    result = await wrapper.list()

    assert result == [{"Roaster": "From Sheets"}]
    sheets_mock.list.assert_called_once()
    sql_mock.list.assert_not_called()  # Postgres never queried for reads


async def test_brew_log_add_postgres_failure_propagates(caplog) -> None:  # type: ignore[no-untyped-def]
    """BrewLog dual-write: Postgres add() failure re-raises after rollback (fail-loud)."""
    import pytest

    sheets_mock = MagicMock()
    sql_mock = AsyncMock()
    sql_mock.add.side_effect = Exception("asyncpg pool exhausted")

    wrapper = _DualWriteBrewLogRepo(sheets=sheets_mock, sql=sql_mock)

    with (
        caplog.at_level(logging.WARNING, logger="app.deps.dual_write"),
        pytest.raises(Exception, match="asyncpg pool exhausted"),
    ):
        await wrapper.add({"Dose_In_g": "18.0", "User_Notes": "Test"})

    sheets_mock.add.assert_called_once()
    assert "Postgres write failed" in caplog.text
