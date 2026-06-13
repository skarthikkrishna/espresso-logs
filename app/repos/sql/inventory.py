"""SqlInventoryRepo — Postgres read/write mirror for the inventory_bags entity (M4)."""

from __future__ import annotations

import builtins
import datetime
from typing import Any

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.catalog import CatalogBean
from app.models.inventory import InventoryBag
from app.repos.sql.tenant import household_read_scope, row_household_id_or_context


def _to_date(val: Any) -> datetime.date | None:
    try:
        return datetime.date.fromisoformat(str(val)) if val not in (None, "") else None
    except ValueError:
        return None


class SqlInventoryRepo:
    """SQL mirror for InventoryBag rows — write always, reads when use_postgres=True."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def upsert(self, row: dict[str, Any]) -> None:
        """Insert or update an inventory bag row by sheets_id, inheriting tenant context."""
        sheets_id = row.get("Bag_ID")
        household_id = await row_household_id_or_context(self._db, row)
        if sheets_id:
            result = await self._db.execute(
                select(InventoryBag).where(
                    InventoryBag.sheets_id == sheets_id,
                    InventoryBag.household_id == household_id,
                )
            )
            existing = result.scalar_one_or_none()
        else:
            existing = None

        if existing is not None:
            existing.household_id = household_id
            existing.roast_date = _to_date(row.get("RoastDate"))
            existing.beans = row.get("Beans")
            existing.display_name = row.get("Display_Name") or row.get("Beans")
            existing.roast_level = row.get("RoastLevel") or row.get("Roast_Level")
            existing.status = row.get("Status", "Active")
            existing.storage_method = row.get("Storage_Method")
            existing.notes = row.get("Notes") or row.get("Beans")
            existing.sheets_catalog_id = row.get("Catalog_ID")
        else:
            bag = InventoryBag(
                household_id=household_id,
                sheets_id=sheets_id,
                sheets_catalog_id=row.get("Catalog_ID"),
                roast_date=_to_date(row.get("RoastDate")),
                beans=row.get("Beans"),
                display_name=row.get("Display_Name") or row.get("Beans"),
                roast_level=row.get("RoastLevel") or row.get("Roast_Level"),
                status=row.get("Status", "Active"),
                storage_method=row.get("Storage_Method"),
                notes=row.get("Notes") or row.get("Beans"),
            )
            self._db.add(bag)

        await self._db.commit()

    async def add_many(self, rows: list[dict[str, Any]]) -> None:
        """Bulk upsert."""
        for row in rows:
            await self.upsert(row)

    def delete_rows(self, start_row: int, end_row: int) -> None:
        """No-op."""

    async def list(self, status: str | None = "Active") -> builtins.list[dict[str, Any]]:
        """Return active-household inventory bags, optionally filtered by status."""
        scope = await household_read_scope(self._db, InventoryBag)
        if not scope.has_context:
            return []
        q = (
            select(InventoryBag, CatalogBean.sheets_id.label("catalog_sheets_id"))
            .outerjoin(
                CatalogBean,
                and_(
                    InventoryBag.catalog_id == CatalogBean.id,
                    CatalogBean.household_id == scope.household_id,
                ),
            )
            .where(scope.require_predicate())
        )
        if status is not None:
            q = q.where(InventoryBag.status == status)
        result = await self._db.execute(q)
        return [self._to_dict(bag, cat_id) for bag, cat_id in result.all()]

    async def list_all(self) -> builtins.list[dict[str, Any]]:
        """Return active-household inventory bags regardless of status."""
        scope = await household_read_scope(self._db, InventoryBag)
        if not scope.has_context:
            return []
        q = (
            select(InventoryBag, CatalogBean.sheets_id.label("catalog_sheets_id"))
            .outerjoin(
                CatalogBean,
                and_(
                    InventoryBag.catalog_id == CatalogBean.id,
                    CatalogBean.household_id == scope.household_id,
                ),
            )
            .where(scope.require_predicate())
        )
        result = await self._db.execute(q)
        return [self._to_dict(bag, cat_id) for bag, cat_id in result.all()]

    async def get(self, bag_id: str) -> dict[str, Any] | None:
        """Fetch a single inventory bag by Sheets Bag_ID within the active household."""
        scope = await household_read_scope(self._db, InventoryBag)
        if not scope.has_context:
            return None
        q = (
            select(InventoryBag, CatalogBean.sheets_id.label("catalog_sheets_id"))
            .outerjoin(
                CatalogBean,
                and_(
                    InventoryBag.catalog_id == CatalogBean.id,
                    CatalogBean.household_id == scope.household_id,
                ),
            )
            .where(scope.require_predicate(), InventoryBag.sheets_id == bag_id)
        )
        result = await self._db.execute(q)
        row = result.one_or_none()
        if row is None:
            return None
        bag, cat_id = row
        return self._to_dict(bag, cat_id)

    def _to_dict(self, row: InventoryBag, catalog_sheets_id: str | None = None) -> dict[str, Any]:
        return {
            "Bag_ID": row.sheets_id or "",
            "Catalog_ID": catalog_sheets_id or row.sheets_catalog_id or "",
            "Beans": row.beans or "",
            "Display_Name": row.display_name or row.beans or "",
            "RoastDate": row.roast_date.isoformat() if row.roast_date else "",
            "RoastLevel": row.roast_level or "",
            "Roast_Level": row.roast_level or "",
            "Status": row.status or "Active",
            "Storage_Method": row.storage_method or "",
            "Notes": row.notes or "",
        }
