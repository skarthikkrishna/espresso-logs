"""SqlHardwareRepo — Postgres read/write mirror for the hardware entity (M4)."""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.hardware import Hardware
from app.repos.sql.tenant import household_read_scope, row_household_id_or_context


class SqlHardwareRepo:
    """SQL mirror for Hardware rows — write always, reads when use_postgres=True."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def upsert(self, row: dict[str, Any]) -> None:
        """Insert or update a hardware row by sheets_id, inheriting tenant context."""
        sheets_id = row.get("Hardware_ID")
        household_id = await row_household_id_or_context(self._db, row)
        if sheets_id:
            result = await self._db.execute(
                select(Hardware).where(
                    Hardware.sheets_id == sheets_id,
                    Hardware.household_id == household_id,
                )
            )
            existing = result.scalar_one_or_none()
        else:
            existing = None

        if existing is not None:
            existing.household_id = household_id
            existing.name = row.get("Name", "")
            existing.category = row.get("Category", "")
            existing.product_url = row.get("Product_URL")
            existing.local_image_path = row.get("Local_Image_Path")
        else:
            item = Hardware(
                household_id=household_id,
                sheets_id=sheets_id,
                name=row.get("Name", ""),
                category=row.get("Category", ""),
                product_url=row.get("Product_URL"),
                local_image_path=row.get("Local_Image_Path"),
            )
            self._db.add(item)

        await self._db.commit()

    async def add_many(self, rows: list[dict[str, Any]]) -> None:
        """Bulk upsert."""
        for row in rows:
            await self.upsert(row)

    def delete_rows(self, start_row: int, end_row: int) -> None:
        """No-op."""

    def next_id(self, category: str) -> str:
        """No-op stub — ID generation is Sheets-specific."""
        return ""

    async def list(self, category: str | None = None) -> list[dict[str, Any]]:
        """Return active-household hardware items, optionally filtered by category."""
        scope = await household_read_scope(self._db, Hardware)
        if not scope.has_context:
            return []
        q = select(Hardware).where(scope.require_predicate())
        if category is not None:
            q = q.where(Hardware.category == category)
        result = await self._db.execute(q)
        return [self._to_dict(r) for r in result.scalars().all()]

    async def get(self, hardware_id: str) -> dict[str, Any] | None:
        """Fetch a single hardware item by Sheets Hardware_ID within the active household."""
        scope = await household_read_scope(self._db, Hardware)
        if not scope.has_context:
            return None
        result = await self._db.execute(
            select(Hardware).where(scope.require_predicate(), Hardware.sheets_id == hardware_id)
        )
        row = result.scalar_one_or_none()
        return self._to_dict(row) if row else None

    def _to_dict(self, row: Hardware) -> dict[str, Any]:
        return {
            "Hardware_ID": row.sheets_id or "",
            "Name": row.name or "",
            "Category": row.category or "",
            "Product_URL": row.product_url or "",
            "Local_Image_Path": row.local_image_path or "",
            "Notes": row.notes or "",
        }
