from __future__ import annotations

import os

import pytest
from sqlalchemy import text

_GLOBAL_TEST_HOUSEHOLD_ID = "00000000-0000-0000-0000-000000000002"


@pytest.mark.skipif(
    bool(os.getenv("DATABASE_URL")),
    reason="DATABASE_URL activates the real global tenant SQL fixture",
)
@pytest.mark.asyncio
async def test_patched_session_factory_fails_loud_on_unexpected_sql() -> None:
    """Root DB fixture must not silently return empty SQL results in no-DB tests."""
    from app.models.base import get_session_factory

    async with get_session_factory()() as session:
        with pytest.raises(AssertionError, match="Unexpected database access"):
            await session.execute(text("SELECT 1"))


@pytest.mark.skipif(
    not os.getenv("DATABASE_URL"),
    reason="DATABASE_URL not set — global tenant SQL fixture inactive",
)
@pytest.mark.asyncio
async def test_patched_session_factory_sets_global_tenant_context() -> None:
    """Root SQL fixture sets tenant context without weakening RLS policies."""
    from app.models.base import get_session_factory

    async with get_session_factory()() as session:
        result = await session.execute(
            text("SELECT current_setting('app.current_household_id', true)")
        )
        assert result.scalar_one() == _GLOBAL_TEST_HOUSEHOLD_ID

        result = await session.execute(
            text("SELECT EXISTS (SELECT 1 FROM households WHERE id = :hid)"),
            {"hid": _GLOBAL_TEST_HOUSEHOLD_ID},
        )
        assert result.scalar_one() is True
