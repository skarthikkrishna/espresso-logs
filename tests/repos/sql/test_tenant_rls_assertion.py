"""Tests for runtime Postgres role and tenant-RLS safety checks."""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock

import pytest

from app.repos.sql.tenant import assert_runtime_rls

_REQUIRED_TABLES = {"brew_log", "catalog", "inventory_bags", "hardware", "maintenance_log"}
_REDACTED_DSN = "postgresql+asyncpg://user:password@db.example.test/espresso"


class _RoleResult:
    def __init__(self, *, rolsuper: bool, rolbypassrls: bool) -> None:
        self._row = SimpleNamespace(rolsuper=rolsuper, rolbypassrls=rolbypassrls)

    def one_or_none(self) -> SimpleNamespace:
        return self._row


class _TableResult:
    def __init__(self, rows: list[SimpleNamespace]) -> None:
        self._rows = rows

    def all(self) -> list[SimpleNamespace]:
        return self._rows


def _rows(
    *,
    missing: set[str] | None = None,
    unsafe: dict[str, tuple[bool, bool]] | None = None,
) -> list[SimpleNamespace]:
    missing = missing or set()
    unsafe = unsafe or {}
    rows = []
    for relname in sorted(_REQUIRED_TABLES - missing):
        rls_enabled, force_rls = unsafe.get(relname, (True, True))
        rows.append(
            SimpleNamespace(
                relname=relname,
                relrowsecurity=rls_enabled,
                relforcerowsecurity=force_rls,
            )
        )
    return rows


def _session_for(
    *,
    rolsuper: bool = False,
    rolbypassrls: bool = False,
    table_rows: list[SimpleNamespace] | None = None,
) -> Any:
    session = SimpleNamespace()
    session.execute = AsyncMock(
        side_effect=[
            _RoleResult(rolsuper=rolsuper, rolbypassrls=rolbypassrls),
            _TableResult(table_rows if table_rows is not None else _rows()),
        ]
    )
    return session


@pytest.mark.parametrize(
    ("rolsuper", "rolbypassrls"),
    [
        (True, False),
        (False, True),
    ],
)
async def test_assert_runtime_rls_rejects_privileged_runtime_roles(
    rolsuper: bool,
    rolbypassrls: bool,
    caplog: pytest.LogCaptureFixture,
) -> None:
    db = _session_for(rolsuper=rolsuper, rolbypassrls=rolbypassrls)

    with pytest.raises(RuntimeError) as exc_info:
        await assert_runtime_rls(db)

    message = str(exc_info.value)
    assert "Unsafe database runtime role" in message
    assert "password" not in message.lower()
    assert _REDACTED_DSN not in message
    assert not caplog.records
    assert db.execute.await_count == 1


@pytest.mark.parametrize(
    ("table_rows", "expected_details"),
    [
        (_rows(missing={"catalog"}), ("missing tables: catalog",)),
        (_rows(unsafe={"brew_log": (False, True)}), ("brew_log", "RLS disabled")),
        (
            _rows(unsafe={"inventory_bags": (True, False)}),
            ("inventory_bags", "FORCE RLS disabled"),
        ),
    ],
)
async def test_assert_runtime_rls_rejects_missing_or_non_forced_tenant_tables(
    table_rows: list[SimpleNamespace],
    expected_details: tuple[str, ...],
    caplog: pytest.LogCaptureFixture,
) -> None:
    db = _session_for(table_rows=table_rows)

    with pytest.raises(RuntimeError) as exc_info:
        await assert_runtime_rls(db)

    message = str(exc_info.value)
    assert "Unsafe tenant RLS configuration" in message
    assert "RLS and FORCE RLS must both be enabled" in message
    for expected_detail in expected_details:
        assert expected_detail in message
    assert "password" not in message.lower()
    assert _REDACTED_DSN not in message
    assert not caplog.records
    assert db.execute.await_count == 2


async def test_assert_runtime_rls_passes_for_non_bypass_role_with_forced_rls() -> None:
    db = _session_for()

    await assert_runtime_rls(db)

    assert db.execute.await_count == 2
