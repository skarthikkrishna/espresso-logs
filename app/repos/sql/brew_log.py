"""SqlBrewLogRepo — Postgres read/write mirror for the brew_log entity (M4)."""

from __future__ import annotations

import builtins
import datetime
import uuid
from typing import Any

from sqlalchemy import delete, func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

from app.models.brew_log import BrewLog


def _to_float(val: Any) -> float | None:
    try:
        return float(val) if val not in (None, "", "N/A") else None
    except (TypeError, ValueError):
        return None


def _to_int(val: Any) -> int | None:
    try:
        return int(val) if val not in (None, "", "N/A") else None
    except (TypeError, ValueError):
        return None


def _parse_datetime(val: Any) -> datetime.datetime | None:
    """Parse an ISO date/datetime string to a UTC datetime. Returns None on failure."""
    if val is None or val == "":
        return None
    try:
        dt = datetime.datetime.fromisoformat(str(val))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=datetime.timezone.utc)
        return dt
    except (TypeError, ValueError):
        return None


def _parse_uuid(val: Any) -> uuid.UUID | None:
    if val in (None, ""):
        return None
    if isinstance(val, uuid.UUID):
        return val
    return uuid.UUID(str(val))


class SqlBrewLogRepo:
    """SQL mirror for BrewLog rows — write always, reads when use_postgres=True."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def _current_household_id(self) -> uuid.UUID | None:
        result = await self._db.execute(
            text("SELECT current_setting('app.current_household_id', true)")
        )
        return _parse_uuid(result.scalar_one_or_none())

    async def set_household_context(self, household_id: uuid.UUID) -> None:
        await self._db.execute(
            text("SELECT set_config('app.current_household_id', :hid, true)"),
            {"hid": str(household_id)},
        )

    async def _current_household_filter(self) -> ColumnElement[bool] | None:
        household_id = await self._current_household_id()
        if household_id is None:
            return None
        return BrewLog.household_id == household_id

    async def commit(self) -> None:
        await self._db.commit()

    async def rollback(self) -> None:
        await self._db.rollback()

    async def add(self, row: dict[str, Any], *, commit: bool = True) -> None:
        """Append a brew log row, inheriting tenant context when omitted."""
        idempotency_key = row.get("idempotency_key") or row.get("Idempotency_Key") or None
        idempotency_request_hash = (
            row.get("idempotency_request_hash") or row.get("Idempotency_Request_Hash") or None
        )
        entry = BrewLog(
            household_id=_parse_uuid(row.get("household_id") or row.get("Household_ID")),
            sheets_id=row.get("Shot_ID"),
            brewed_at=_parse_datetime(row.get("Date")),
            bag_id=row.get("Bag_ID"),
            machine_id=row.get("Machine_ID"),
            grinder_id=row.get("Grinder_ID"),
            basket_id=row.get("Basket_ID"),
            dose_g=_to_float(row.get("Dose_In_g")),
            yield_g=_to_float(row.get("Yield_Out_g")),
            time_sec=_to_int(row.get("Time_Sec")),
            grind_setting=_to_float(row.get("Grind_Setting")),
            shot_eligibility=row.get("Shot_Eligibility"),
            notes=row.get("User_Notes"),
            taste_summary=row.get("Taste_Summary"),
            ai_feedback=row.get("AI_Feedback"),
            storage_method=row.get("Storage_Method"),
            brew_method=row.get("Brew_Method"),
            rating=_to_int(row.get("Rating")),
            idempotency_key=idempotency_key,
            idempotency_request_hash=idempotency_request_hash,
        )
        if entry.household_id is None:
            entry.household_id = await self._current_household_id()
        self._db.add(entry)
        await self._db.flush()
        await self._db.refresh(entry)
        if commit:
            await self._db.commit()

    async def add_many(self, rows: list[dict[str, Any]]) -> None:
        """Bulk insert."""
        for row in rows:
            await self.add(row)

    async def update_feedback(self, shot_id: str, ai_feedback: str) -> None:
        """Update AI feedback for a brew log entry identified by Sheets Shot_ID."""
        await self._db.execute(
            update(BrewLog).where(BrewLog.sheets_id == shot_id).values(ai_feedback=ai_feedback)
        )
        await self._db.commit()

    def delete_rows(self, start_row: int, end_row: int) -> None:
        """No-op."""

    async def list(self) -> builtins.list[dict[str, Any]]:
        """Return all brew log entries ordered by brew date descending."""
        household_filter = await self._current_household_filter()
        if household_filter is None:
            return []
        result = await self._db.execute(
            select(BrewLog).where(household_filter).order_by(BrewLog.brewed_at.desc())
        )
        return [self._to_dict(r) for r in result.scalars().all()]

    async def list_recent(self, n: int = 20) -> builtins.list[dict[str, Any]]:
        """Return the N most recent brew log entries."""
        household_filter = await self._current_household_filter()
        if household_filter is None:
            return []
        result = await self._db.execute(
            select(BrewLog).where(household_filter).order_by(BrewLog.brewed_at.desc()).limit(n)
        )
        return [self._to_dict(r) for r in result.scalars().all()]

    async def list_paginated(
        self, page: int, per_page: int
    ) -> tuple[builtins.list[dict[str, Any]], int]:
        """Return a paginated slice and total count.

        Returns (rows, total_count) where rows is ordered newest-first.
        """
        household_filter = await self._current_household_filter()
        if household_filter is None:
            return [], 0

        count_result = await self._db.execute(
            select(func.count()).select_from(BrewLog).where(household_filter)
        )
        total_count: int = count_result.scalar_one()

        offset = (page - 1) * per_page
        result = await self._db.execute(
            select(BrewLog)
            .where(household_filter)
            .order_by(BrewLog.brewed_at.desc(), BrewLog.id.desc())
            .limit(per_page)
            .offset(offset)
        )
        rows = [self._to_dict(r) for r in result.scalars().all()]
        return rows, total_count

    async def list_for_bag(self, bag_id: str) -> builtins.list[dict[str, Any]]:
        """Return all brew log entries for a given bag."""
        household_filter = await self._current_household_filter()
        if household_filter is None:
            return []
        result = await self._db.execute(
            select(BrewLog).where(household_filter, BrewLog.bag_id == bag_id)
        )
        return [self._to_dict(r) for r in result.scalars().all()]

    async def list_existing_ids(self) -> builtins.list[str]:
        """Return all known Sheets Shot_IDs."""
        result = await self._db.execute(
            select(BrewLog.sheets_id).where(BrewLog.sheets_id.is_not(None))
        )
        return [row[0] for row in result.all()]

    async def get(self, shot_id: str) -> dict[str, Any] | None:
        """Fetch a single brew log entry by Sheets Shot_ID."""
        household_filter = await self._current_household_filter()
        if household_filter is None:
            return None
        result = await self._db.execute(
            select(BrewLog).where(household_filter, BrewLog.sheets_id == shot_id)
        )
        row = result.scalar_one_or_none()
        return self._to_dict(row) if row else None

    async def get_by_idempotency_key(self, idempotency_key: str) -> dict[str, Any] | None:
        """Fetch a brew log entry by household-scoped idempotency key."""
        household_filter = await self._current_household_filter()
        if household_filter is None:
            return None
        result = await self._db.execute(
            select(BrewLog).where(household_filter, BrewLog.idempotency_key == idempotency_key)
        )
        row = result.scalar_one_or_none()
        return self._to_dict(row) if row else None

    async def delete_by_shot_id(self, shot_id: str) -> bool:
        """Delete a brew log entry by Sheets Shot_ID. Returns True if a row was deleted."""
        household_filter = await self._current_household_filter()
        if household_filter is None:
            return False
        check = await self._db.execute(
            select(BrewLog.id).where(household_filter, BrewLog.sheets_id == shot_id)
        )
        if check.scalar_one_or_none() is None:
            return False
        await self._db.execute(
            delete(BrewLog).where(household_filter, BrewLog.sheets_id == shot_id)
        )
        await self._db.commit()
        return True

    def _to_dict(self, row: BrewLog) -> dict[str, Any]:
        return {
            "Shot_ID": row.sheets_id or "",
            "Date": row.brewed_at.date().isoformat() if row.brewed_at else "",
            "Bag_ID": row.bag_id or "",
            "Machine_ID": row.machine_id or "",
            "Grinder_ID": row.grinder_id or "",
            "Basket_ID": row.basket_id or "",
            "Dose_In_g": str(row.dose_g) if row.dose_g is not None else "",
            "Yield_Out_g": str(row.yield_g) if row.yield_g is not None else "",
            "Time_Sec": str(row.time_sec) if row.time_sec is not None else "",
            "Grind_Setting": str(row.grind_setting) if row.grind_setting is not None else "",
            "Shot_Eligibility": row.shot_eligibility or "",
            "Taste_Summary": row.taste_summary or "",
            "User_Notes": row.notes or "",
            "AI_Feedback": row.ai_feedback or "",
            "Storage_Method": row.storage_method or "",
            "Idempotency_Key": row.idempotency_key or "",
            "Idempotency_Request_Hash": row.idempotency_request_hash or "",
        }
