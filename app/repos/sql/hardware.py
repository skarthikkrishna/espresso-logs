"""SqlHardwareRepo — Postgres write mirror for the hardware entity (M2)."""

from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.hardware import Hardware


class SqlHardwareRepo:
    """Write-only SQL mirror for Hardware rows.

    Reads return empty results — the SheetsRepo is the read source of truth
    through M3.
    """

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def upsert(self, row: dict[str, Any]) -> None:
        """Insert a hardware row. household_id intentionally NULL (M5)."""
        item = Hardware(
            name=row.get("Name", ""),
            category=row.get("Category", ""),
        )
        self._db.add(item)
        await self._db.commit()
        await self._db.refresh(item)

    async def add_many(self, rows: list[dict[str, Any]]) -> None:
        """Bulk insert."""
        for row in rows:
            await self.upsert(row)

    def delete_rows(self, start_row: int, end_row: int) -> None:
        """No-op."""

    def next_id(self, category: str) -> str:
        """No-op stub — ID generation is Sheets-specific."""
        return ""

    def list(self, category: str | None = None) -> list[dict[str, Any]]:
        """Not used in M2 (reads come from Sheets). Returns empty list."""
        return []

    def get(self, hardware_id: str) -> dict[str, Any] | None:
        """Not used in M2. Returns None."""
        return None
