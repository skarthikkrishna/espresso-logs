"""SqlCatalogRepo — Postgres read/write mirror for the catalog entity (M4)."""

from __future__ import annotations

import builtins
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.catalog import CatalogBean


class SqlCatalogRepo:
    """SQL mirror for CatalogBean rows — write always, reads when use_postgres=True."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def upsert(self, row: dict[str, Any]) -> None:
        """Insert or update a catalog row by sheets_id. household_id intentionally NULL (M5)."""
        sheets_id = row.get("Catalog_ID")
        if sheets_id:
            result = await self._db.execute(
                select(CatalogBean).where(CatalogBean.sheets_id == sheets_id)
            )
            existing = result.scalar_one_or_none()
        else:
            existing = None

        if existing is not None:
            existing.roaster = row.get("Roaster", "")
            existing.bean_name = row.get("Bean_Name", "")
            existing.origin = row.get("Origin")
            existing.process = row.get("Process")
            existing.roast_level = row.get("Roast_Level")
            existing.notes = row.get("Tasting_Notes") or row.get("Notes") or row.get("Catalog_ID")
            existing.product_url = row.get("Product_URL")
            existing.local_image_path = row.get("Local_Image_Path")
        else:
            bean = CatalogBean(
                sheets_id=sheets_id,
                roaster=row.get("Roaster", ""),
                bean_name=row.get("Bean_Name", ""),
                origin=row.get("Origin"),
                process=row.get("Process"),
                roast_level=row.get("Roast_Level"),
                notes=row.get("Tasting_Notes") or row.get("Notes") or row.get("Catalog_ID"),
                product_url=row.get("Product_URL"),
                local_image_path=row.get("Local_Image_Path"),
            )
            self._db.add(bean)

        await self._db.commit()

    async def add_many(self, rows: list[dict[str, Any]]) -> None:
        """Bulk upsert."""
        for row in rows:
            await self.upsert(row)

    def delete_rows(self, start_row: int, end_row: int) -> None:
        """No-op — Sheets row deletion has no SQL equivalent."""

    async def list(self) -> list[dict[str, Any]]:
        """Return all catalog entries."""
        result = await self._db.execute(select(CatalogBean))
        rows = result.scalars().all()
        return [self._to_dict(row) for row in rows]

    async def get(self, catalog_id: str) -> dict[str, Any] | None:
        """Fetch a single catalog entry by Sheets ID."""
        result = await self._db.execute(
            select(CatalogBean).where(CatalogBean.sheets_id == catalog_id)
        )
        row = result.scalar_one_or_none()
        return self._to_dict(row) if row else None

    async def _fetch_all(self) -> builtins.list[dict[str, Any]]:
        """Alias for list() — used by router cache-busting reads."""
        return await self.list()

    def _to_dict(self, row: CatalogBean) -> dict[str, Any]:
        return {
            "Catalog_ID": row.sheets_id or "",
            "Roaster": row.roaster or "",
            "Bean_Name": row.bean_name or "",
            "Roast_Level": row.roast_level or "",
            "Product_URL": row.product_url or "",
            "Local_Image_Path": row.local_image_path or "",
            "Notes": row.notes or "",
        }
