from __future__ import annotations

import base64
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from itsdangerous import TimestampSigner

from app.deps import _DualWriteBrewLogRepo, get_sheets_client
from app.main import app
from app.repos.sql.brew_log import SqlBrewLogRepo
from tests.doubles import FakeSheetsClient

_TEST_SECRET = "dev-insecure-secret-for-testing-only"
_TEST_USER = {"email": "tester@example.com", "name": "Tester", "picture": ""}

_POST_BODY = {
    "bag_id": "BAG-TEST-01",
    "dose_in_g": 18.0,
    "yield_out_g": 36.0,
    "time_sec": 28.0,
    "grind_setting": "12",
    "shot_eligibility": "Good Espresso",
}


def _make_session_cookie(data: dict, secret: str = _TEST_SECRET) -> str:
    signer = TimestampSigner(secret)
    payload = base64.b64encode(json.dumps(data).encode("utf-8"))
    return signer.sign(payload).decode("utf-8")


_AUTHED_COOKIE = _make_session_cookie({"user": _TEST_USER})


async def test_dual_write_surfaces_postgres_failure() -> None:
    """A Postgres write failure must not be silently swallowed when SQL mirror is active."""
    sheets = MagicMock()
    sql = AsyncMock()
    sql.add.side_effect = Exception("simulated PG failure")
    sql._db.rollback = AsyncMock()
    repo = _DualWriteBrewLogRepo(sheets=sheets, sql=sql)
    row = {"Shot_ID": "SH-FAIL-001", "Date": "2026-05-15"}

    with pytest.raises(Exception, match="simulated PG failure"):
        await repo.add(row)

    # M5 write-disable: Sheets is NOT written to; SQL is attempted and raises
    sheets.add.assert_not_called()
    sql._db.rollback.assert_awaited_once()


async def test_dual_write_postgres_none_no_exception() -> None:
    """When Postgres is not configured, add() is a no-op (M5: Sheets writes disabled)."""
    sheets = MagicMock()
    repo = _DualWriteBrewLogRepo(sheets=sheets, sql=None)
    row = {"Shot_ID": "SH-NO-SQL-001", "Date": "2026-05-15"}

    # Must not raise, and Sheets must NOT be called (M5 write-disable)
    await repo.add(row)

    sheets.add.assert_not_called()


async def test_post_brew_log_surfaces_sql_failure_as_http_500() -> None:
    """A Postgres mirror failure must surface to the caller as HTTP 500, not silent 201."""
    fake = FakeSheetsClient({"Brew_Log": [], "Inventory": [], "Catalog": [], "Hardware": []})
    app.dependency_overrides[get_sheets_client] = lambda: fake

    try:
        with (
            patch("app.config.settings.use_postgres", True),
            patch.object(SqlBrewLogRepo, "list_existing_ids", AsyncMock(return_value=[])),
            patch.object(SqlBrewLogRepo, "add", AsyncMock(side_effect=Exception("PG down"))),
        ):
            async with AsyncClient(
                transport=ASGITransport(app=app, raise_app_exceptions=False),
                base_url="http://test",
            ) as client:
                client.cookies.set("session", _AUTHED_COOKIE)
                response = await client.post("/api/brew-log", json=_POST_BODY)
    finally:
        app.dependency_overrides.pop(get_sheets_client, None)

    assert response.status_code == 500


async def test_add_many_surfaces_postgres_failure() -> None:
    """A Postgres batch-write failure in add_many() must not be silently swallowed.

    Intent: add_many() is used by the reconciliation script to backfill rows.
    If the SQL mirror raises during batch insert, the exception must propagate
    so the caller knows the batch did not fully land in Postgres.
    """
    sheets = MagicMock()
    sql = AsyncMock()
    # add_many iterates and calls sql.add() per row — patch that method
    sql.add.side_effect = Exception("simulated PG batch failure")
    sql._db.rollback = AsyncMock()
    repo = _DualWriteBrewLogRepo(sheets=sheets, sql=sql)
    rows = [
        {"Shot_ID": "SH-BATCH-001", "Date": "2026-05-15"},
        {"Shot_ID": "SH-BATCH-002", "Date": "2026-05-16"},
    ]

    with pytest.raises(Exception, match="simulated PG batch failure"):
        await repo.add_many(rows)

    # M5 write-disable: Sheets is NOT written to; SQL is attempted and raises
    sheets.add_many.assert_not_called()
    sql._db.rollback.assert_awaited_once()


async def test_add_many_postgres_none_no_exception() -> None:
    """When Postgres is not configured, add_many() is a no-op (M5: Sheets writes disabled)."""
    sheets = MagicMock()
    repo = _DualWriteBrewLogRepo(sheets=sheets, sql=None)
    rows = [{"Shot_ID": "SH-NO-SQL-001", "Date": "2026-05-15"}]

    # Must not raise, and Sheets must NOT be called (M5 write-disable)
    await repo.add_many(rows)

    sheets.add_many.assert_not_called()
