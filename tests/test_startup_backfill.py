"""Unit tests for the startup backfill runtime guard."""

from __future__ import annotations

import logging
from unittest.mock import MagicMock, patch

import pytest


def _no_db_access() -> MagicMock:
    """Return a session factory mock that fails if startup backfill opens a DB."""
    session_factory = MagicMock(name="session_factory")
    session_factory.side_effect = AssertionError("startup backfill must not open a DB session")
    return session_factory


async def test_use_postgres_false_skips_backfill_without_db_or_sheets_access() -> None:
    """use_postgres=False returns immediately without DB, Sheets, or helper access."""
    import app.main as main

    session_factory = _no_db_access()

    with (
        patch("app.main.settings") as mock_settings,
        patch("app.main.get_session_factory", return_value=session_factory) as get_factory,
        patch("app.main.get_sheets_client", create=True) as get_sheets_client,
    ):
        mock_settings.use_postgres = False
        await main.run_startup_backfill()

    get_factory.assert_not_called()
    session_factory.assert_not_called()
    get_sheets_client.assert_not_called()
    assert not hasattr(main, "_backfill_maintenance_logs")
    assert not hasattr(main, "_backfill_inventory_bags")


async def test_use_postgres_true_logs_disabled_without_db_or_sheets_access(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Postgres startup backfill is intentionally disabled in multi-tenant mode."""
    import app.main as main

    session_factory = _no_db_access()

    with (
        patch("app.main.settings") as mock_settings,
        patch("app.main.get_session_factory", return_value=session_factory) as get_factory,
        patch("app.main.get_sheets_client", create=True) as get_sheets_client,
        caplog.at_level(logging.INFO, logger="app.main"),
    ):
        mock_settings.use_postgres = True
        await main.run_startup_backfill()

    get_factory.assert_not_called()
    session_factory.assert_not_called()
    get_sheets_client.assert_not_called()
    assert not hasattr(main, "_backfill_maintenance_logs")
    assert not hasattr(main, "_backfill_inventory_bags")
    assert [
        record.message
        for record in caplog.records
        if "Startup backfill disabled in multi-tenant Postgres runtime" in record.message
    ] == [
        "Startup backfill disabled in multi-tenant Postgres runtime; "
        "use an explicit operator backfill for legacy NULL link fields"
    ]
