"""
MaintenanceRepo — Sheets-backed repository for the Maintenance tab.

Schema columns (in order): Maintenance_ID, Hardware_ID, Date, Action_Type, Notes
"""

from __future__ import annotations

from app.repos.base import BaseRepo, TTLCache
from app.repos.sheets_client import SheetsClientProtocol

_TAB = "Maintenance"
_PK = "Maintenance_ID"
_CACHE_KEY = "all_maintenance"


class MaintenanceRepo(BaseRepo):
    """Repository for the Maintenance (hardware events) tab."""

    TAB = _TAB
    COLUMNS = ("Maintenance_ID", "Hardware_ID", "Date", "Action_Type", "Notes")

    def __init__(
        self,
        client: SheetsClientProtocol,
        cache: TTLCache | None = None,
    ) -> None:
        super().__init__(client, cache)

    # ------------------------------------------------------------------
    # Read
    # ------------------------------------------------------------------

    def list(self, hardware_id: str | None = None) -> list[dict]:
        """Return maintenance rows, optionally filtered by *hardware_id* (cached for 60s)."""
        rows = self._fetch_cached(_CACHE_KEY, _TAB)
        if hardware_id is not None:
            rows = [r for r in rows if r.get("Hardware_ID") == hardware_id]
        return rows

    def get(self, maintenance_id: str) -> dict | None:
        """Return the maintenance event with *maintenance_id*, or ``None``."""
        for row in self.list():
            if row.get(_PK) == maintenance_id:
                return row
        return None

    # ------------------------------------------------------------------
    # Write
    # ------------------------------------------------------------------

    def add(self, row: dict) -> None:
        """Append a new maintenance event row; invalidates the list cache."""
        self._client.append_row(_TAB, row)
        self._cache.invalidate(_CACHE_KEY)

    def add_many(self, rows: list[dict]) -> None:
        """Bulk-append multiple maintenance rows (bootstrapping)."""
        if not rows:
            return
        values = [[row.get(col, "") for col in self.COLUMNS] for row in rows]
        self._client.append_rows(self.TAB, values)
        self._cache.invalidate(_CACHE_KEY)

    def delete_rows(self, start_row: int, end_row: int) -> None:
        """Delete sheet rows by 1-indexed position (row 1 = header)."""
        self._client.delete_rows(self.TAB, start_row, end_row)
        self._cache.invalidate(_CACHE_KEY)
