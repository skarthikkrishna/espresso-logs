"""SqlInventoryRepo — Postgres write mirror for the inventory_bags entity (M2)."""

from __future__ import annotations

import builtins
import datetime
import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inventory import InventoryBag

log = logging.getLogger(__name__)


def _to_date(val: Any) -> datetime.date | None:
    try:
        return datetime.date.fromisoformat(str(val)) if val not in (None, "") else None
    except ValueError:
        return None


class SqlInventoryRepo:
    """Write-only SQL mirror for InventoryBag rows.

    Reads return empty results — the SheetsRepo is the read source of truth
    through M3.
    """

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def upsert(self, row: dict[str, Any]) -> None:
        """Insert an inventory bag row. household_id intentionally NULL (M5)."""
        bag = InventoryBag(
            roast_date=_to_date(row.get("RoastDate")),
            notes=row.get("Beans"),
        )
        self._db.add(bag)
        await self._db.commit()
        await self._db.refresh(bag)

    async def add_many(self, rows: list[dict[str, Any]]) -> None:
        """Bulk insert."""
        for row in rows:
            await self.upsert(row)

    def delete_rows(self, start_row: int, end_row: int) -> None:
        """No-op."""

    def list(self, status: str | None = "Active") -> builtins.list[dict[str, Any]]:
        """Not used in M2 (reads come from Sheets). Returns empty list."""
        return []

    def list_all(self) -> builtins.list[dict[str, Any]]:
        """Not used in M2. Returns empty list."""
        return []

    def get(self, bag_id: str) -> dict[str, Any] | None:
        """Not used in M2. Returns None."""
        return None
