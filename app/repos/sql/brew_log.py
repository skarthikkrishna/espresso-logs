"""SqlBrewLogRepo — Postgres write mirror for the brew_log entity (M2)."""

from __future__ import annotations

import builtins
import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.brew_log import BrewLog

log = logging.getLogger(__name__)


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


class SqlBrewLogRepo:
    """Write-only SQL mirror for BrewLog rows.

    Reads return empty results — the SheetsRepo is the read source of truth
    through M3.
    """

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def add(self, row: dict[str, Any]) -> None:
        """Append a brew log row. household_id intentionally NULL (M5)."""
        entry = BrewLog(
            brew_method=row.get("Brew_Method"),
            dose_g=_to_float(row.get("Dose_In_g")),
            yield_g=_to_float(row.get("Yield_Out_g")),
            time_sec=_to_int(row.get("Time_Sec")),
            notes=row.get("User_Notes") or row.get("Taste_Summary"),
        )
        self._db.add(entry)
        await self._db.commit()
        await self._db.refresh(entry)

    async def add_many(self, rows: list[dict[str, Any]]) -> None:
        """Bulk insert."""
        for row in rows:
            await self.add(row)

    def update_feedback(self, shot_id: str, ai_feedback: str) -> None:
        """No-op in M2 — AI feedback write-back not wired to SQL yet (deferred to M4)."""

    def delete_rows(self, start_row: int, end_row: int) -> None:
        """No-op."""

    def list(self) -> builtins.list[dict[str, Any]]:
        """Not used in M2 (reads come from Sheets). Returns empty list."""
        return []

    def list_recent(self, n: int = 20) -> builtins.list[dict[str, Any]]:
        """Not used in M2. Returns empty list."""
        return []

    def list_for_bag(self, bag_id: str) -> builtins.list[dict[str, Any]]:
        """Not used in M2. Returns empty list."""
        return []

    def list_existing_ids(self) -> builtins.list[str]:
        """Not used in M2. Returns empty list."""
        return []

    def get(self, shot_id: str) -> dict[str, Any] | None:
        """Not used in M2. Returns None."""
        return None
