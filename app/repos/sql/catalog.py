"""SqlCatalogRepo — Postgres write mirror for the catalog entity (M2)."""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.catalog import CatalogBean

log = logging.getLogger(__name__)


class SqlCatalogRepo:
    """Write-only SQL mirror for CatalogBean rows.

    Reads return empty results — the SheetsRepo is the read source of truth
    through M3. All write methods are async (SQLAlchemy async ORM requires
    await on all DB operations).
    """

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def upsert(self, row: dict[str, Any]) -> None:
        """Insert a catalog row. household_id intentionally NULL (M5 concern)."""
        bean = CatalogBean(
            roaster=row.get("Roaster", ""),
            bean_name=row.get("Bean_Name", ""),
            origin=row.get("Origin"),
            process=row.get("Process"),
            roast_level=row.get("Roast_Level"),
            # FIXME(M4): notes column stores Catalog_ID as a Sheets cross-reference.
            # When M4 switches reads to Postgres, callers expecting tasting notes here
            # will receive the ID string instead. Resolve before M4 by either adding a
            # dedicated `sheets_catalog_id` column or clearing this field in M4 migration.
            notes=row.get("Catalog_ID"),
        )
        self._db.add(bean)
        await self._db.commit()
        await self._db.refresh(bean)

    async def add_many(self, rows: list[dict[str, Any]]) -> None:
        """Bulk insert; not called by routers in M2 but implemented for interface parity."""
        for row in rows:
            await self.upsert(row)

    def delete_rows(self, start_row: int, end_row: int) -> None:
        """No-op — Sheets row deletion has no SQL equivalent in M2."""

    def list(self) -> list[dict[str, Any]]:
        """Not used in M2 (reads come from Sheets). Returns empty list."""
        return []

    def get(self, catalog_id: str) -> dict[str, Any] | None:
        """Not used in M2 (reads come from Sheets). Returns None."""
        return None
