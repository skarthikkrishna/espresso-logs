"""
HardwareRepo — Sheets-backed repository for the Hardware tab.

Schema columns (in order): Hardware_ID, Category, Name, Product_URL, Local_Image_Path
"""

from __future__ import annotations

from typing import Any, List

from app.repos.base import BaseRepo, TTLCache
from app.repos.sheets_client import SheetsClientProtocol

_TAB = "Hardware"
_PK = "Hardware_ID"
_CACHE_KEY = "all_hardware"


class HardwareRepo(BaseRepo):
    """Repository for the Hardware (equipment inventory) tab."""

    TAB = _TAB
    COLUMNS = ("Hardware_ID", "Category", "Name", "Product_URL", "Local_Image_Path")

    def __init__(
        self,
        client: SheetsClientProtocol,
        cache: TTLCache | None = None,
    ) -> None:
        super().__init__(client, cache)

    # ------------------------------------------------------------------
    # Read
    # ------------------------------------------------------------------

    def list(self, category: str | None = None) -> List[dict[str, Any]]:
        """Return hardware rows, optionally filtered by *category* (cached for 60s)."""
        rows = self._fetch_cached(_CACHE_KEY, _TAB)
        if category is not None:
            rows = [r for r in rows if r.get("Category") == category]
        return rows

    def get(self, hardware_id: str) -> dict[str, Any] | None:
        """Return the hardware item with *hardware_id*, or ``None``."""
        for row in self.list():
            if row.get(_PK) == hardware_id:
                return row
        return None

    # ------------------------------------------------------------------
    # Write
    # ------------------------------------------------------------------

    def upsert(self, row: dict[str, Any]) -> None:
        """Insert or update a hardware row; invalidates the list cache."""
        pk_val = row[_PK]
        existing = self._fetch_all(_TAB)
        found = any(r.get(_PK) == pk_val for r in existing)
        if found:
            self._client.update_row(_TAB, _PK, pk_val, row)
        else:
            self._client.append_row(_TAB, row)
        self._cache.invalidate(_CACHE_KEY)

    def add_many(self, rows: List[dict[str, Any]]) -> None:
        """Bulk-append multiple hardware rows (bootstrapping)."""
        if not rows:
            return
        values = [[row.get(col, "") for col in self.COLUMNS] for row in rows]
        self._client.append_rows(self.TAB, values)
        self._cache.invalidate(_CACHE_KEY)

    def delete_rows(self, start_row: int, end_row: int) -> None:
        """Delete sheet rows by 1-indexed position (row 1 = header)."""
        self._client.delete_rows(self.TAB, start_row, end_row)
        self._cache.invalidate(_CACHE_KEY)

    # ------------------------------------------------------------------
    # ID generation
    # ------------------------------------------------------------------

    def next_id(self, category: str) -> str:
        """Return the next sequential Hardware_ID for *category*.

        Category → prefix mapping:
          ``"Machine"`` → ``"M"``, ``"Grinder"`` → ``"G"``, ``"Basket"`` → ``"B"``,
          ``"Storage"`` → ``"S"``

        Scans existing ``Hardware_ID`` values for the prefix and returns
        ``"{prefix}{max+1:02d}"``.  Returns ``"{prefix}01"`` when no IDs exist
        for the category.

        Args:
            category: One of ``"Machine"``, ``"Grinder"``, ``"Basket"``, or ``"Storage"``.

        Raises:
            KeyError: If *category* is not in the prefix map.
        """
        # next_id() uses a local prefix_map dict — "Storage": "S" added in T005
        prefix_map = {"Machine": "M", "Grinder": "G", "Basket": "B", "Storage": "S"}
        prefix = prefix_map[category]
        existing = [
            r["Hardware_ID"]
            for r in self.list()
            if r.get("Hardware_ID", "").startswith(prefix)
        ]
        nums = []
        for hid in existing:
            try:
                nums.append(int(hid[len(prefix):]))
            except ValueError:
                continue
        if not nums:
            return f"{prefix}01"
        max_n = max(nums)
        return f"{prefix}{max_n + 1:02d}"
