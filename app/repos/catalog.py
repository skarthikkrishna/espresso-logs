"""
CatalogRepo — Sheets-backed repository for the Catalog tab.

Schema columns (in order):
  Catalog_ID, Roaster, Bean_Name, Roast_Level, Product_URL, Local_Image_Path
"""

from __future__ import annotations

from app.repos.base import BaseRepo, TTLCache
from app.repos.sheets_client import SheetsClientProtocol

_TAB = "Catalog"
_PK = "Catalog_ID"
_CACHE_KEY = "catalog:all"


class CatalogRepo(BaseRepo):
    """Repository for the Catalog (bean reference library) tab."""

    TAB = _TAB
    COLUMNS = (
        "Catalog_ID", "Roaster", "Bean_Name", "Roast_Level",
        "Product_URL", "Local_Image_Path",
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

    def list(self) -> list[dict]:
        """Return all catalog entries (cached for 60s)."""
        return self._fetch_cached(_CACHE_KEY, _TAB)

    def get(self, catalog_id: str) -> dict | None:
        """Return the catalog entry with *catalog_id*, or ``None``."""
        for row in self.list():
            if row.get(_PK) == catalog_id:
                return row
        return None

    # ------------------------------------------------------------------
    # Write
    # ------------------------------------------------------------------

    def upsert(self, row: dict) -> None:
        """Insert or update a catalog row; invalidates the list cache."""
        pk_val = row[_PK]
        existing = self._fetch_all(_TAB)
        found = any(r.get(_PK) == pk_val for r in existing)
        if found:
            self._client.update_row(_TAB, _PK, pk_val, row)
        else:
            self._client.append_row(_TAB, row)
        self._cache.invalidate(_CACHE_KEY)

    def add_many(self, rows: list[dict]) -> None:
        """Bulk-append multiple catalog rows (bootstrapping)."""
        if not rows:
            return
        values = [[row.get(col, "") for col in self.COLUMNS] for row in rows]
        self._client.append_rows(self.TAB, values)

    def delete_rows(self, start_row: int, end_row: int) -> None:
        """Delete sheet rows by 1-indexed position (row 1 = header)."""
        self._client.delete_rows(self.TAB, start_row, end_row)
