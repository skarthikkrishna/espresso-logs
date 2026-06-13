"""SqlMaintenanceRepo — Postgres read/write mirror for the maintenance_log entity (M4)."""

from __future__ import annotations

import datetime
from typing import Any

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.hardware import Hardware
from app.models.maintenance import MaintenanceLog
from app.repos.sql.tenant import household_read_scope, row_household_id_or_context


def _parse_datetime(val: Any) -> datetime.datetime | None:
    """Parse an ISO date/datetime string to a UTC datetime. Returns None on failure."""
    if val is None or val == "":
        return None
    try:
        dt = datetime.datetime.fromisoformat(str(val))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=datetime.timezone.utc)
        return dt
    except (TypeError, ValueError):
        return None


class SqlMaintenanceRepo:
    """SQL mirror for MaintenanceLog rows — write always, reads when use_postgres=True."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def upsert(self, row: dict[str, Any]) -> None:
        """Insert or update a maintenance event by sheets_id.

        Behaviour:
        - If no row with ``sheets_id`` exists → INSERT with all fields from *row*.
        - If a row exists and ``sheets_hardware_id`` is NULL → UPDATE only that field.
        - If a row exists and ``sheets_hardware_id`` is already set → no-op.

        ``performed_at``, ``action``, and ``notes`` are never overwritten on
        existing rows — the update scope is strictly limited to ``sheets_hardware_id``.
        """
        sheets_id = row.get("Maintenance_ID")
        household_id = await row_household_id_or_context(self._db, row)
        existing: MaintenanceLog | None = None
        if sheets_id:
            result = await self._db.execute(
                select(MaintenanceLog).where(
                    MaintenanceLog.sheets_id == sheets_id,
                    MaintenanceLog.household_id == household_id,
                )
            )
            existing = result.scalar_one_or_none()

        if existing is not None:
            if existing.sheets_hardware_id is None:
                existing.household_id = household_id
                existing.sheets_hardware_id = row.get("Hardware_ID")
                await self._db.commit()
            # else: sheets_hardware_id already set — no-op
        else:
            event = MaintenanceLog(
                household_id=household_id,
                sheets_id=sheets_id,
                sheets_hardware_id=row.get("Hardware_ID"),
                performed_at=_parse_datetime(row.get("Date")),
                action=row.get("Action_Type", ""),
                notes=row.get("Notes"),
            )
            self._db.add(event)
            await self._db.commit()

    async def add(self, row: dict[str, Any]) -> None:
        """Append a maintenance event, inheriting tenant context when omitted."""
        household_id = await row_household_id_or_context(self._db, row)
        event = MaintenanceLog(
            household_id=household_id,
            sheets_id=row.get("Maintenance_ID"),
            sheets_hardware_id=row.get("Hardware_ID"),
            performed_at=_parse_datetime(row.get("Date")),
            action=row.get("Action_Type", ""),
            notes=row.get("Notes"),
        )
        self._db.add(event)
        await self._db.commit()
        await self._db.refresh(event)

    async def add_many(self, rows: list[dict[str, Any]]) -> None:
        """Bulk insert."""
        for row in rows:
            await self.add(row)

    def delete_rows(self, start_row: int, end_row: int) -> None:
        """No-op."""

    async def list(self, hardware_id: str | None = None) -> list[dict[str, Any]]:
        """Return active-household maintenance events, optionally filtered by hardware ID."""
        scope = await household_read_scope(self._db, MaintenanceLog)
        if not scope.has_context:
            return []
        q = (
            select(MaintenanceLog, Hardware.sheets_id.label("hardware_sheets_id"))
            .outerjoin(
                Hardware,
                and_(
                    MaintenanceLog.hardware_id == Hardware.id,
                    Hardware.household_id == scope.household_id,
                ),
            )
            .where(scope.require_predicate())
        )
        if hardware_id is not None:
            q = q.where(
                or_(
                    MaintenanceLog.sheets_hardware_id == hardware_id,
                    Hardware.sheets_id == hardware_id,
                )
            )
        result = await self._db.execute(q)
        return [self._to_dict(log, hw_id) for log, hw_id in result.all()]

    async def get(self, maintenance_id: str) -> dict[str, Any] | None:
        """Fetch a single maintenance event by Sheets Maintenance_ID within the active household."""
        scope = await household_read_scope(self._db, MaintenanceLog)
        if not scope.has_context:
            return None
        result = await self._db.execute(
            select(MaintenanceLog).where(
                scope.require_predicate(), MaintenanceLog.sheets_id == maintenance_id
            )
        )
        row = result.scalar_one_or_none()
        return self._to_dict(row) if row else None

    def _to_dict(
        self, row: MaintenanceLog, hardware_sheets_id: str | None = None
    ) -> dict[str, Any]:
        return {
            "Maintenance_ID": row.sheets_id or "",
            "Hardware_ID": hardware_sheets_id or row.sheets_hardware_id or "",
            "Date": row.performed_at.date().isoformat() if row.performed_at else "",
            "Action_Type": row.action or "",
            "Notes": row.notes or "",
        }
