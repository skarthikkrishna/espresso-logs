"""
InventoryRepo — Sheets-backed repository for the Inventory tab.

Schema columns (in order):
  Bag_ID, Beans, RoastDate, RoastLevel, Display_Name, Catalog_ID, Status, Storage_Method
"""

from __future__ import annotations

from typing import Any, List

from app.repos.base import BaseRepo, TTLCache
from app.repos.sheets_client import SheetsClientProtocol

_TAB = "Inventory"
_PK = "Bag_ID"
_CACHE_KEY_ACTIVE = "inventory:active"
_CACHE_KEY_ALL = "inventory:all"


class InventoryRepo(BaseRepo):
    """Repository for the Inventory (bean bags) tab."""

    TAB = _TAB
    COLUMNS = (
        "Bag_ID", "Beans", "RoastDate", "RoastLevel", "Display_Name",
        "Catalog_ID", "Status", "Storage_Method",
    )

    def __init__(
        self,
        client: SheetsClientProtocol,
        cache: TTLCache | None = None,
    ) -> None:
        super().__init__(client, cache)

    # ------------------------------------------------------------------
    # Read
    # ------------------------------------------------------------------

    def list(self, status: str | None = "Active") -> List[dict[str, Any]]:
        """Return inventory rows.

        Args:
            status: If ``"Active"`` (default), return only active bags (cached
                60s).  Pass ``None`` to return all rows (not cached).
        """
        if status == "Active":
            rows = self._fetch_cached(_CACHE_KEY_ACTIVE, _TAB)
            return [r for r in rows if r.get("Status") == "Active"]
        # All rows — not cached
        return self._fetch_all(_TAB)

    def list_all(self) -> List[dict[str, Any]]:
        """Return every inventory row regardless of status (TTL-cached 60 s)."""
        return self._fetch_cached(_CACHE_KEY_ALL, _TAB)

    def get(self, bag_id: str) -> dict[str, Any] | None:
        """Return the bag with *bag_id*, or ``None``."""
        for row in self._fetch_all(_TAB):
            if row.get(_PK) == bag_id:
                return row
        return None

    # ------------------------------------------------------------------
    # Write
    # ------------------------------------------------------------------

    def upsert(self, row: dict[str, Any]) -> None:
        """Insert or update an inventory row; invalidates both active-bag and all-bag caches."""
        pk_val = row[_PK]
        existing = self._fetch_all(_TAB)
        found = any(r.get(_PK) == pk_val for r in existing)
        if found:
            self._client.update_row(_TAB, _PK, pk_val, row)
        else:
            self._client.append_row(_TAB, row)
        self._cache.invalidate(_CACHE_KEY_ACTIVE)
        self._cache.invalidate(_CACHE_KEY_ALL)

    def add_many(self, rows: List[dict[str, Any]]) -> None:
        """Bulk-append multiple inventory rows (bootstrapping)."""
        if not rows:
            return
        values = [[row.get(col, "") for col in self.COLUMNS] for row in rows]
        self._client.append_rows(self.TAB, values)

    def delete_rows(self, start_row: int, end_row: int) -> None:
        """Delete sheet rows by 1-indexed position (row 1 = header)."""
        self._client.delete_rows(self.TAB, start_row, end_row)
