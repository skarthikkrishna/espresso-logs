"""SqlBrewLogRepo — Postgres read/write mirror for the brew_log entity (M4)."""

from __future__ import annotations

import builtins
import datetime
from typing import Any

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

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


class SqlBrewLogRepo:
    """SQL mirror for BrewLog rows — write always, reads when use_postgres=True."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def add(self, row: dict[str, Any]) -> None:
        """Append a brew log row. household_id intentionally NULL (M5)."""
        entry = BrewLog(
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
        )
        self._db.add(entry)
        await self._db.commit()
        await self._db.refresh(entry)

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
        result = await self._db.execute(select(BrewLog).order_by(BrewLog.brewed_at.desc()))
        return [self._to_dict(r) for r in result.scalars().all()]

    async def list_recent(self, n: int = 20) -> builtins.list[dict[str, Any]]:
        """Return the N most recent brew log entries."""
        result = await self._db.execute(select(BrewLog).order_by(BrewLog.brewed_at.desc()).limit(n))
        return [self._to_dict(r) for r in result.scalars().all()]

    async def list_paginated(
        self, page: int, per_page: int
    ) -> tuple[builtins.list[dict[str, Any]], int]:
        """Return a paginated slice and total count.

        Returns (rows, total_count) where rows is ordered newest-first.
        """
        count_result = await self._db.execute(select(func.count()).select_from(BrewLog))
        total_count: int = count_result.scalar_one()

        offset = (page - 1) * per_page
        result = await self._db.execute(
            select(BrewLog)
            .order_by(BrewLog.brewed_at.desc(), BrewLog.id.desc())
            .limit(per_page)
            .offset(offset)
        )
        rows = [self._to_dict(r) for r in result.scalars().all()]
        return rows, total_count

    async def list_for_bag(self, bag_id: str) -> builtins.list[dict[str, Any]]:
        """Return all brew log entries for a given bag."""
        result = await self._db.execute(select(BrewLog).where(BrewLog.bag_id == bag_id))
        return [self._to_dict(r) for r in result.scalars().all()]

    async def list_existing_ids(self) -> builtins.list[str]:
        """Return all known Sheets Shot_IDs."""
        result = await self._db.execute(
            select(BrewLog.sheets_id).where(BrewLog.sheets_id.is_not(None))
        )
        return [row[0] for row in result.all()]

    async def get(self, shot_id: str) -> dict[str, Any] | None:
        """Fetch a single brew log entry by Sheets Shot_ID."""
        result = await self._db.execute(select(BrewLog).where(BrewLog.sheets_id == shot_id))
        row = result.scalar_one_or_none()
        return self._to_dict(row) if row else None

    async def delete_by_shot_id(self, shot_id: str) -> bool:
        """Delete a brew log entry by Sheets Shot_ID. Returns True if a row was deleted."""
        check = await self._db.execute(select(BrewLog.id).where(BrewLog.sheets_id == shot_id))
        if check.scalar_one_or_none() is None:
            return False
        await self._db.execute(delete(BrewLog).where(BrewLog.sheets_id == shot_id))
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
        }
