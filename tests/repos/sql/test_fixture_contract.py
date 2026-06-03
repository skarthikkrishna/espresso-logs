from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def test_db_session_sets_tenant_context(db_session: AsyncSession, test_household_id) -> None:
    result = await db_session.execute(
        text("SELECT current_setting('app.current_household_id', true)")
    )
    assert result.scalar_one() == str(test_household_id)


async def test_db_session_tenant_context_has_household_row(
    db_session: AsyncSession, test_household_id
) -> None:
    result = await db_session.execute(
        text("SELECT EXISTS (SELECT 1 FROM households WHERE id = :hid)"),
        {"hid": test_household_id},
    )
    assert result.scalar_one() is True
