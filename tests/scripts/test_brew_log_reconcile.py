from __future__ import annotations

from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.repos.base import get_process_cache
from tests.doubles import FakeSheetsClient


def _make_fake_sheets(shot_ids: list[str]) -> FakeSheetsClient:
    return FakeSheetsClient(
        {
            "Brew_Log": [
                {"Shot_ID": shot_id, "Date": "2026-05-15", "Bag_ID": "BAG-001"}
                for shot_id in shot_ids
            ]
        }
    )


def _session_factory(mock_session: MagicMock):
    @asynccontextmanager
    async def _cm():
        yield mock_session

    return lambda: _cm()


@pytest.mark.asyncio
async def test_reconcile_dry_run_reports_missing(capsys: pytest.CaptureFixture[str]) -> None:
    import scripts.brew_log_reconcile as reconcile

    fake_sheets = _make_fake_sheets(["SH-001", "SH-002", "SH-003"])
    get_process_cache()._store.clear()

    with (
        patch.object(reconcile, "_get_database_url", return_value="postgresql://test"),
        patch.object(reconcile, "_is_cloud_sql_url", return_value=False),
        patch.object(reconcile, "get_sheets_client", return_value=fake_sheets),
        patch.object(reconcile, "get_session_factory", return_value=_session_factory(MagicMock())),
        patch.object(reconcile.SqlBrewLogRepo, "list_existing_ids", AsyncMock(return_value=["SH-001"])),
    ):
        exit_code = await reconcile._run([])

    get_process_cache()._store.clear()
    captured = capsys.readouterr()
    assert exit_code == 1
    assert "Missing in Postgres: 2" in captured.out
    assert "SH-002" in captured.err
    assert "SH-003" in captured.err


@pytest.mark.asyncio
async def test_reconcile_no_drift(capsys: pytest.CaptureFixture[str]) -> None:
    import scripts.brew_log_reconcile as reconcile

    fake_sheets = _make_fake_sheets(["SH-001", "SH-002"])
    get_process_cache()._store.clear()

    with (
        patch.object(reconcile, "_get_database_url", return_value="postgresql://test"),
        patch.object(reconcile, "_is_cloud_sql_url", return_value=False),
        patch.object(reconcile, "get_sheets_client", return_value=fake_sheets),
        patch.object(reconcile, "get_session_factory", return_value=_session_factory(MagicMock())),
        patch.object(
            reconcile.SqlBrewLogRepo,
            "list_existing_ids",
            AsyncMock(return_value=["SH-001", "SH-002"]),
        ),
    ):
        exit_code = await reconcile._run([])

    get_process_cache()._store.clear()
    captured = capsys.readouterr()
    assert exit_code == 0
    assert "Missing in Postgres: 0" in captured.out
    assert "No drift detected." in captured.out


@pytest.mark.asyncio
async def test_reconcile_apply_inserts_only_missing() -> None:
    import scripts.brew_log_reconcile as reconcile

    fake_sheets = _make_fake_sheets(["SH-001", "SH-002", "SH-003"])
    inserted: list[str] = []
    get_process_cache()._store.clear()

    async def _track_add(self, row: dict[str, str]) -> None:
        inserted.append(row["Shot_ID"])

    with (
        patch.object(reconcile, "_get_database_url", return_value="postgresql://test"),
        patch.object(reconcile, "_is_cloud_sql_url", return_value=False),
        patch.object(reconcile, "get_sheets_client", return_value=fake_sheets),
        patch.object(reconcile, "get_session_factory", return_value=_session_factory(MagicMock())),
        patch.object(reconcile.SqlBrewLogRepo, "list_existing_ids", AsyncMock(return_value=["SH-001"])),
        patch.object(reconcile.SqlBrewLogRepo, "add", _track_add),
    ):
        exit_code = await reconcile._run(["--apply"])

    get_process_cache()._store.clear()
    assert exit_code == 0
    assert inserted == ["SH-002", "SH-003"]
