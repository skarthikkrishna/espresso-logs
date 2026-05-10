from __future__ import annotations

import builtins
import logging
import threading
from typing import TYPE_CHECKING, Annotated, Any, cast

if TYPE_CHECKING:
    from app.services.inference import LLMClient

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import get_db
from app.repos.base import TTLCache, get_process_cache
from app.repos.brew_log import BrewLogRepo
from app.repos.catalog import CatalogRepo
from app.repos.hardware import HardwareRepo
from app.repos.inventory import InventoryRepo
from app.repos.maintenance import MaintenanceRepo
from app.repos.sheets_client import RealSheetsClient, SheetsClientProtocol
from app.repos.sql.brew_log import SqlBrewLogRepo
from app.repos.sql.catalog import SqlCatalogRepo
from app.repos.sql.hardware import SqlHardwareRepo
from app.repos.sql.inventory import SqlInventoryRepo
from app.repos.sql.maintenance import SqlMaintenanceRepo
from app.services.idempotency_store import IdempotencyStore

_dw_log = logging.getLogger("app.deps.dual_write")


class _RequiresLogin(Exception):
    """Raised by require_user when no authenticated session is present."""


async def _get_current_user(request: Request) -> dict[str, Any]:
    user = request.session.get("user")
    if not user:
        raise _RequiresLogin()
    return cast(dict[str, Any], user)


require_user = Depends(_get_current_user)
CurrentUser = Annotated[dict[str, Any], require_user]

# ---------------------------------------------------------------------------
# Sheets client singleton (double-checked lock)
# ---------------------------------------------------------------------------

_sheets_lock = threading.Lock()
_sheets_client: RealSheetsClient | None = None


def get_sheets_client() -> RealSheetsClient:
    """Return the process-level RealSheetsClient singleton (lazy, thread-safe)."""
    global _sheets_client
    if _sheets_client is None:
        with _sheets_lock:
            if _sheets_client is None:
                from app.config import settings  # local import avoids circular deps at module load

                _sheets_client = RealSheetsClient(settings.spreadsheet_id)
    return _sheets_client


# ---------------------------------------------------------------------------
# Dual-write wrapper classes (Sheets-first, Postgres-second)
# ---------------------------------------------------------------------------


class _DualWriteCatalogRepo:
    """Dual-write wrapper: writes to Sheets first, then Postgres; reads from Sheets."""

    def __init__(self, sheets: CatalogRepo, sql: SqlCatalogRepo) -> None:
        self._sheets = sheets
        self._sql = sql

    def list(self) -> builtins.list[dict[str, Any]]:
        return self._sheets.list()

    def get(self, catalog_id: str) -> dict[str, Any] | None:
        return self._sheets.get(catalog_id)

    def _fetch_all(self) -> builtins.list[dict[str, Any]]:
        return self._sheets._fetch_all()

    async def upsert(self, row: dict[str, Any]) -> None:
        self._sheets.upsert(row)
        try:
            await self._sql.upsert(row)
        except Exception as exc:
            _dw_log.warning(
                "Postgres write failed",
                extra={
                    "component": "dual_write",
                    "entity_type": "catalog",
                    "operation": "upsert",
                    "error": str(exc),
                },
            )

    async def add_many(self, rows: builtins.list[dict[str, Any]]) -> None:
        self._sheets.add_many(rows)
        for row in rows:
            try:
                await self._sql.upsert(row)
            except Exception as exc:
                _dw_log.warning(
                    "Postgres write failed (add_many)",
                    extra={
                        "component": "dual_write",
                        "entity_type": "catalog",
                        "operation": "add_many",
                        "error": str(exc),
                    },
                )

    def delete_rows(self, start_row: int, end_row: int) -> None:
        self._sheets.delete_rows(start_row, end_row)


class _DualWriteBrewLogRepo:
    """Dual-write wrapper for BrewLog: Sheets-first, Postgres-second; reads from Sheets."""

    def __init__(self, sheets: BrewLogRepo, sql: SqlBrewLogRepo) -> None:
        self._sheets = sheets
        self._sql = sql

    def list(self) -> builtins.list[dict[str, Any]]:
        return self._sheets.list()

    def list_recent(self, n: int = 20) -> builtins.list[dict[str, Any]]:
        return self._sheets.list_recent(n)

    def list_for_bag(self, bag_id: str) -> builtins.list[dict[str, Any]]:
        return self._sheets.list_for_bag(bag_id)

    def list_existing_ids(self) -> builtins.list[str]:
        return self._sheets.list_existing_ids()

    def get(self, shot_id: str) -> dict[str, Any] | None:
        return self._sheets.get(shot_id)

    async def add(self, row: dict[str, Any]) -> None:
        self._sheets.add(row)
        try:
            await self._sql.add(row)
        except Exception as exc:
            _dw_log.warning(
                "Postgres write failed",
                extra={
                    "component": "dual_write",
                    "entity_type": "brew_log",
                    "operation": "add",
                    "error": str(exc),
                },
            )

    async def add_many(self, rows: builtins.list[dict[str, Any]]) -> None:
        self._sheets.add_many(rows)
        for row in rows:
            try:
                await self._sql.add(row)
            except Exception as exc:
                _dw_log.warning(
                    "Postgres write failed (add_many)",
                    extra={
                        "component": "dual_write",
                        "entity_type": "brew_log",
                        "operation": "add_many",
                        "error": str(exc),
                    },
                )

    def update_feedback(self, shot_id: str, ai_feedback: str) -> None:
        self._sheets.update_feedback(shot_id, ai_feedback)

    def delete_rows(self, start_row: int, end_row: int) -> None:
        self._sheets.delete_rows(start_row, end_row)


class _DualWriteInventoryRepo:
    """Dual-write wrapper for InventoryBag: Sheets-first, Postgres-second; reads from Sheets."""

    def __init__(self, sheets: InventoryRepo, sql: SqlInventoryRepo) -> None:
        self._sheets = sheets
        self._sql = sql

    def list(self, status: str | None = "Active") -> builtins.list[dict[str, Any]]:
        return self._sheets.list(status=status)

    def list_all(self) -> builtins.list[dict[str, Any]]:
        return self._sheets.list_all()

    def get(self, bag_id: str) -> dict[str, Any] | None:
        return self._sheets.get(bag_id)

    async def upsert(self, row: dict[str, Any]) -> None:
        self._sheets.upsert(row)
        try:
            await self._sql.upsert(row)
        except Exception as exc:
            _dw_log.warning(
                "Postgres write failed",
                extra={
                    "component": "dual_write",
                    "entity_type": "inventory",
                    "operation": "upsert",
                    "error": str(exc),
                },
            )

    async def add_many(self, rows: builtins.list[dict[str, Any]]) -> None:
        self._sheets.add_many(rows)
        for row in rows:
            try:
                await self._sql.upsert(row)
            except Exception as exc:
                _dw_log.warning(
                    "Postgres write failed (add_many)",
                    extra={
                        "component": "dual_write",
                        "entity_type": "inventory",
                        "operation": "add_many",
                        "error": str(exc),
                    },
                )

    def delete_rows(self, start_row: int, end_row: int) -> None:
        self._sheets.delete_rows(start_row, end_row)


class _DualWriteHardwareRepo:
    """Dual-write wrapper for Hardware: Sheets-first, Postgres-second; reads from Sheets."""

    def __init__(self, sheets: HardwareRepo, sql: SqlHardwareRepo) -> None:
        self._sheets = sheets
        self._sql = sql

    def list(self, category: str | None = None) -> builtins.list[dict[str, Any]]:
        return self._sheets.list(category=category)

    def get(self, hardware_id: str) -> dict[str, Any] | None:
        return self._sheets.get(hardware_id)

    def next_id(self, category: str) -> str:
        return self._sheets.next_id(category)

    async def upsert(self, row: dict[str, Any]) -> None:
        self._sheets.upsert(row)
        try:
            await self._sql.upsert(row)
        except Exception as exc:
            _dw_log.warning(
                "Postgres write failed",
                extra={
                    "component": "dual_write",
                    "entity_type": "hardware",
                    "operation": "upsert",
                    "error": str(exc),
                },
            )

    async def add_many(self, rows: builtins.list[dict[str, Any]]) -> None:
        self._sheets.add_many(rows)
        for row in rows:
            try:
                await self._sql.upsert(row)
            except Exception as exc:
                _dw_log.warning(
                    "Postgres write failed (add_many)",
                    extra={
                        "component": "dual_write",
                        "entity_type": "hardware",
                        "operation": "add_many",
                        "error": str(exc),
                    },
                )

    def delete_rows(self, start_row: int, end_row: int) -> None:
        self._sheets.delete_rows(start_row, end_row)


class _DualWriteMaintenanceRepo:
    """Dual-write wrapper for MaintenanceLog: Sheets-first, Postgres-second; reads from Sheets."""

    def __init__(self, sheets: MaintenanceRepo, sql: SqlMaintenanceRepo) -> None:
        self._sheets = sheets
        self._sql = sql

    def list(self, hardware_id: str | None = None) -> builtins.list[dict[str, Any]]:
        return self._sheets.list(hardware_id=hardware_id)

    def get(self, maintenance_id: str) -> dict[str, Any] | None:
        return self._sheets.get(maintenance_id)

    async def add(self, row: dict[str, Any]) -> None:
        self._sheets.add(row)
        try:
            await self._sql.add(row)
        except Exception as exc:
            _dw_log.warning(
                "Postgres write failed",
                extra={
                    "component": "dual_write",
                    "entity_type": "maintenance",
                    "operation": "add",
                    "error": str(exc),
                },
            )

    async def add_many(self, rows: builtins.list[dict[str, Any]]) -> None:
        self._sheets.add_many(rows)
        for row in rows:
            try:
                await self._sql.add(row)
            except Exception as exc:
                _dw_log.warning(
                    "Postgres write failed (add_many)",
                    extra={
                        "component": "dual_write",
                        "entity_type": "maintenance",
                        "operation": "add_many",
                        "error": str(exc),
                    },
                )

    def delete_rows(self, start_row: int, end_row: int) -> None:
        self._sheets.delete_rows(start_row, end_row)


# ---------------------------------------------------------------------------
# Repository factory functions (request-scoped, dual-write)
# ---------------------------------------------------------------------------


async def get_catalog_repo(
    client: Annotated[SheetsClientProtocol, Depends(get_sheets_client)],
    cache: TTLCache = Depends(get_process_cache),
    db: AsyncSession = Depends(get_db),
) -> _DualWriteCatalogRepo:
    """FastAPI dependency providing a dual-write CatalogRepo wrapper."""
    sheets = CatalogRepo(client=client, cache=cache)
    sql = SqlCatalogRepo(db=db)
    return _DualWriteCatalogRepo(sheets=sheets, sql=sql)


async def get_inventory_repo(
    client: Annotated[SheetsClientProtocol, Depends(get_sheets_client)],
    cache: TTLCache = Depends(get_process_cache),
    db: AsyncSession = Depends(get_db),
) -> _DualWriteInventoryRepo:
    """FastAPI dependency providing a dual-write InventoryRepo wrapper."""
    sheets = InventoryRepo(client=client, cache=cache)
    sql = SqlInventoryRepo(db=db)
    return _DualWriteInventoryRepo(sheets=sheets, sql=sql)


async def get_hardware_repo(
    client: Annotated[SheetsClientProtocol, Depends(get_sheets_client)],
    cache: TTLCache = Depends(get_process_cache),
    db: AsyncSession = Depends(get_db),
) -> _DualWriteHardwareRepo:
    """FastAPI dependency providing a dual-write HardwareRepo wrapper."""
    sheets = HardwareRepo(client=client, cache=cache)
    sql = SqlHardwareRepo(db=db)
    return _DualWriteHardwareRepo(sheets=sheets, sql=sql)


async def get_maintenance_repo(
    client: Annotated[SheetsClientProtocol, Depends(get_sheets_client)],
    cache: TTLCache = Depends(get_process_cache),
    db: AsyncSession = Depends(get_db),
) -> _DualWriteMaintenanceRepo:
    """FastAPI dependency providing a dual-write MaintenanceRepo wrapper."""
    sheets = MaintenanceRepo(client=client, cache=cache)
    sql = SqlMaintenanceRepo(db=db)
    return _DualWriteMaintenanceRepo(sheets=sheets, sql=sql)


async def get_brew_log_repo(
    client: Annotated[SheetsClientProtocol, Depends(get_sheets_client)],
    cache: TTLCache = Depends(get_process_cache),
    db: AsyncSession = Depends(get_db),
) -> _DualWriteBrewLogRepo:
    """FastAPI dependency providing a dual-write BrewLogRepo wrapper."""
    sheets = BrewLogRepo(client=client, cache=cache)
    sql = SqlBrewLogRepo(db=db)
    return _DualWriteBrewLogRepo(sheets=sheets, sql=sql)


def get_llm_client() -> "LLMClient":
    """FastAPI dependency that provides the configured LLMClient."""
    from app.config import settings
    from app.services.inference import get_llm_client as _factory

    return _factory(settings.anthropic_api_key, settings.llm_api_key)


# ---------------------------------------------------------------------------
# Idempotency store singleton (double-checked lock)
# ---------------------------------------------------------------------------

_idempotency_store_lock = threading.Lock()
_idempotency_store: IdempotencyStore | None = None


def get_idempotency_store() -> IdempotencyStore:
    """Return the process-level IdempotencyStore singleton (lazy, thread-safe).

    Uses threading.Lock for the initialisation guard (same pattern as
    get_sheets_client).  The asyncio.Lock inside IdempotencyStore protects
    concurrent coroutine access.
    """
    global _idempotency_store
    if _idempotency_store is None:
        with _idempotency_store_lock:
            if _idempotency_store is None:
                _idempotency_store = IdempotencyStore()
    return _idempotency_store
