"""Tenant helpers for SQL repositories under strict Postgres RLS."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


def parse_uuid(val: Any) -> uuid.UUID | None:
    if val in (None, ""):
        return None
    if isinstance(val, uuid.UUID):
        return val
    return uuid.UUID(str(val))


async def current_household_id(db: AsyncSession) -> uuid.UUID | None:
    result = await db.execute(text("SELECT current_setting('app.current_household_id', true)"))
    return parse_uuid(result.scalar_one_or_none())


async def row_household_id_or_context(db: AsyncSession, row: dict[str, Any]) -> uuid.UUID | None:
    return parse_uuid(
        row.get("household_id") or row.get("Household_ID")
    ) or await current_household_id(db)
