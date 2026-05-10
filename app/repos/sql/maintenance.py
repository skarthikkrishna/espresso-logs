"""SqlMaintenanceRepo — Postgres write mirror for the maintenance_log entity (M2)."""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.maintenance import MaintenanceLog

log = logging.getLogger(__name__)


class SqlMaintenanceRepo:
    """Write-only SQL mirror for MaintenanceLog rows.

    Reads return empty results — the SheetsRepo is the read source of truth
    through M3.
    """

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def add(self, row: dict[str, Any]) -> None:
        """Append a maintenance event. household_id intentionally NULL (M5)."""
        event = MaintenanceLog(
            action=row.get("Action_Type", ""),
            notes=row.get("Notes"),
        )
        self._db.add(event)
        await self._db.commit()
        await self._db.refresh(event)

    async def add_many(self, rows: list[dict[str, Any]]) -> None:
        """Bulk insert."""
        for row in rows:
            await self.add(row)

    def delete_rows(self, start_row: int, end_row: int) -> None:
        """No-op."""

    def list(self, hardware_id: str | None = None) -> list[dict[str, Any]]:
        """Not used in M2 (reads come from Sheets). Returns empty list."""
        return []

    def get(self, maintenance_id: str) -> dict[str, Any] | None:
        """Not used in M2. Returns None."""
        return None
