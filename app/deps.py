from __future__ import annotations

import builtins
import logging
import os
import threading
from typing import TYPE_CHECKING, Annotated, Any, cast

if TYPE_CHECKING:
    from app.services.inference import LLMClient

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.base import get_db
from app.repos.base import TTLCache, get_process_cache
from app.repos.brew_log import BrewLogRepo
from app.repos.catalog import CatalogRepo
from app.repos.hardware import HardwareRepo
from app.repos.inventory import InventoryRepo
from app.repos.maintenance import MaintenanceRepo
from app.repos.sheets_client import RealSheetsClient, SheetsClientProtocol
from app.testing.fake_sheets import (
    FakeSheetsClient as _FakeSheetsClient,
    make_e2e_sheets_client as _make_e2e_sheets_client,
)
from app.repos.sql.brew_log import SqlBrewLogRepo
from app.repos.sql.catalog import SqlCatalogRepo
from app.repos.sql.hardware import SqlHardwareRepo
from app.repos.sql.inventory import SqlInventoryRepo
from app.repos.sql.maintenance import SqlMaintenanceRepo
from app.services.idempotency_store import IdempotencyStore

_dw_log = logging.getLogger("app.deps.dual_write")

# E2E_AUTH_BYPASS=1 makes _get_current_user return a synthetic test user without
# requiring a real OAuth session.  Only permitted when APP_ENV is explicitly
# "test" or "local" — any other environment (staging, preview, production) is
# rejected at startup to prevent an unauthenticated bypass on live deployments.
_E2E_AUTH_BYPASS = os.environ.get("E2E_AUTH_BYPASS") == "1"

_PERMITTED_E2E_ENVS: frozenset[str] = frozenset({"test", "local"})

if _E2E_AUTH_BYPASS:
    _app_env = os.environ.get("APP_ENV", "")
    if _app_env not in _PERMITTED_E2E_ENVS:
        raise RuntimeError(
            f"E2E_AUTH_BYPASS=1 is only permitted when APP_ENV is 'test' or 'local' "
            f"(got APP_ENV={_app_env!r}). Remove E2E_AUTH_BYPASS before deploying to "
            "staging, preview, or production environments."
        )


class _RequiresLogin(Exception):
    """Raised by require_user when no authenticated session is present."""


async def _get_current_user(request: Request) -> dict[str, Any]:
    if _E2E_AUTH_BYPASS:
        return {"email": "e2e-test@localhost", "name": "E2E Test User"}
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
_sheets_client: RealSheetsClient | _FakeSheetsClient | None = None


def get_sheets_client() -> RealSheetsClient | _FakeSheetsClient:
    """Return the process-level Sheets client singleton (lazy, thread-safe).

    When E2E_AUTH_BYPASS=1 this returns an in-memory FakeSheetsClient pre-seeded
    with representative test data.  No real Google Sheets API calls are made.
    """
    global _sheets_client
    if _sheets_client is None:
        with _sheets_lock:
            if _sheets_client is None:
                if _E2E_AUTH_BYPASS:
                    _sheets_client = _make_e2e_sheets_client()
                else:
                    from app.config import (
                        settings,
                    )  # local import avoids circular deps at module load

                    _sheets_client = RealSheetsClient(settings.spreadsheet_id)
    return _sheets_client


# ---------------------------------------------------------------------------
# Dual-write wrapper classes (Sheets-first, Postgres-second)
# ---------------------------------------------------------------------------


class _DualWriteCatalogRepo:
    """Dual-write wrapper: writes to Sheets first, then Postgres.

    Reads route to Postgres when USE_POSTGRES=true; fall back to Sheets otherwise.
    When ``sql`` is ``None`` (i.e. ``USE_POSTGRES=False``), all write operations
    go to Sheets only — no Postgres connection is opened.
    """

    def __init__(self, sheets: CatalogRepo, sql: SqlCatalogRepo | None) -> None:
        self._sheets = sheets
        self._sql = sql

    async def list(self) -> builtins.list[dict[str, Any]]:
        if settings.use_postgres and self._sql is not None:
            return await self._sql.list()
        return self._sheets.list()

    async def get(self, catalog_id: str) -> dict[str, Any] | None:
        if settings.use_postgres and self._sql is not None:
            return await self._sql.get(catalog_id)
        return self._sheets.get(catalog_id)

    async def _fetch_all(self) -> builtins.list[dict[str, Any]]:
        if settings.use_postgres and self._sql is not None:
            return await self._sql._fetch_all()
        return self._sheets._fetch_all()

    async def upsert(self, row: dict[str, Any]) -> None:
        self._sheets.upsert(row)
        if self._sql is None:
            return
        try:
            await self._sql.upsert(row)
        except Exception as exc:
            await self._sql._db.rollback()
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
        if self._sql is None:
            return
        for row in rows:
            try:
                await self._sql.upsert(row)
            except Exception as exc:
                await self._sql._db.rollback()
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

    def delete_by_pk(self, pk_col: str, pk_val: str) -> None:
        self._sheets.delete_by_pk(pk_col, pk_val)


class _DualWriteBrewLogRepo:
    """Dual-write wrapper for BrewLog: Sheets-first, Postgres-second.

    Reads route to Postgres when USE_POSTGRES=true; fall back to Sheets otherwise.
    When ``sql`` is ``None`` (i.e. ``USE_POSTGRES=False``), all write operations
    go to Sheets only.
    """

    def __init__(self, sheets: BrewLogRepo, sql: SqlBrewLogRepo | None) -> None:
        self._sheets = sheets
        self._sql = sql

    async def list(self) -> builtins.list[dict[str, Any]]:
        if settings.use_postgres and self._sql is not None:
            return await self._sql.list()
        return self._sheets.list()

    async def list_recent(self, n: int = 20) -> builtins.list[dict[str, Any]]:
        if settings.use_postgres and self._sql is not None:
            return await self._sql.list_recent(n)
        return self._sheets.list_recent(n)

    async def list_paginated(
        self, page: int, per_page: int
    ) -> tuple[builtins.list[dict[str, Any]], int]:
        """Paginated list — delegates to SQL when USE_POSTGRES=true, else in-memory pagination."""
        if settings.use_postgres and self._sql is not None:
            return await self._sql.list_paginated(page, per_page)
        all_rows = self._sheets.list_recent(9999)
        total_count = len(all_rows)
        offset = (page - 1) * per_page
        return all_rows[offset : offset + per_page], total_count

    async def list_for_bag(self, bag_id: str) -> builtins.list[dict[str, Any]]:
        if settings.use_postgres and self._sql is not None:
            return await self._sql.list_for_bag(bag_id)
        return self._sheets.list_for_bag(bag_id)

    async def list_existing_ids(self) -> builtins.list[str]:
        if settings.use_postgres and self._sql is not None:
            return await self._sql.list_existing_ids()
        return self._sheets.list_existing_ids()

    async def get(self, shot_id: str) -> dict[str, Any] | None:
        if settings.use_postgres and self._sql is not None:
            return await self._sql.get(shot_id)
        return self._sheets.get(shot_id)

    async def add(self, row: dict[str, Any]) -> None:
        self._sheets.add(row)
        if self._sql is None:
            return
        try:
            await self._sql.add(row)
        except Exception as exc:
            await self._sql._db.rollback()
            _dw_log.warning(
                "Postgres write failed",
                extra={
                    "component": "dual_write",
                    "entity_type": "brew_log",
                    "operation": "add",
                    "error": str(exc),
                },
            )
            raise

    async def add_many(self, rows: builtins.list[dict[str, Any]]) -> None:
        self._sheets.add_many(rows)
        if self._sql is None:
            return
        for row in rows:
            try:
                await self._sql.add(row)
            except Exception as exc:
                await self._sql._db.rollback()
                _dw_log.warning(
                    "Postgres write failed (add_many)",
                    extra={
                        "component": "dual_write",
                        "entity_type": "brew_log",
                        "operation": "add_many",
                        "error": str(exc),
                    },
                )
                raise

    async def update_feedback(self, shot_id: str, ai_feedback: str) -> None:
        self._sheets.update_feedback(shot_id, ai_feedback)
        if self._sql is not None and settings.use_postgres:
            try:
                await self._sql.update_feedback(shot_id, ai_feedback)
            except Exception as exc:
                await self._sql._db.rollback()
                _dw_log.warning(
                    "Postgres write failed",
                    extra={
                        "component": "dual_write",
                        "entity_type": "brew_log",
                        "operation": "update_feedback",
                        "error": str(exc),
                    },
                )

    def delete_rows(self, start_row: int, end_row: int) -> None:
        self._sheets.delete_rows(start_row, end_row)


class _DualWriteInventoryRepo:
    """Dual-write wrapper for InventoryBag: Sheets-first, Postgres-second.

    Reads route to Postgres when USE_POSTGRES=true; fall back to Sheets otherwise.
    When ``sql`` is ``None`` (i.e. ``USE_POSTGRES=False``), all write operations
    go to Sheets only.
    """

    def __init__(self, sheets: InventoryRepo, sql: SqlInventoryRepo | None) -> None:
        self._sheets = sheets
        self._sql = sql

    async def list(self, status: str | None = "Active") -> builtins.list[dict[str, Any]]:
        if settings.use_postgres and self._sql is not None:
            return await self._sql.list(status=status)
        return self._sheets.list(status=status)

    async def list_all(self) -> builtins.list[dict[str, Any]]:
        if settings.use_postgres and self._sql is not None:
            return await self._sql.list_all()
        return self._sheets.list_all()

    async def get(self, bag_id: str) -> dict[str, Any] | None:
        if settings.use_postgres and self._sql is not None:
            return await self._sql.get(bag_id)
        return self._sheets.get(bag_id)

    async def upsert(self, row: dict[str, Any]) -> None:
        self._sheets.upsert(row)
        if self._sql is None:
            return
        try:
            await self._sql.upsert(row)
        except Exception as exc:
            await self._sql._db.rollback()
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
        if self._sql is None:
            return
        for row in rows:
            try:
                await self._sql.upsert(row)
            except Exception as exc:
                await self._sql._db.rollback()
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

    def delete_by_pk(self, pk_col: str, pk_val: str) -> None:
        self._sheets.delete_by_pk(pk_col, pk_val)


class _DualWriteHardwareRepo:
    """Dual-write wrapper for Hardware: Sheets-first, Postgres-second.

    Reads route to Postgres when USE_POSTGRES=true; fall back to Sheets otherwise.
    ``next_id()`` always delegates to Sheets unconditionally.
    When ``sql`` is ``None`` (i.e. ``USE_POSTGRES=False``), all write operations
    go to Sheets only.
    """

    def __init__(self, sheets: HardwareRepo, sql: SqlHardwareRepo | None) -> None:
        self._sheets = sheets
        self._sql = sql

    async def list(self, category: str | None = None) -> builtins.list[dict[str, Any]]:
        if settings.use_postgres and self._sql is not None:
            return await self._sql.list(category=category)
        return self._sheets.list(category=category)

    async def get(self, hardware_id: str) -> dict[str, Any] | None:
        if settings.use_postgres and self._sql is not None:
            return await self._sql.get(hardware_id)
        return self._sheets.get(hardware_id)

    def next_id(self, category: str) -> str:
        return self._sheets.next_id(category)

    async def upsert(self, row: dict[str, Any]) -> None:
        self._sheets.upsert(row)
        if self._sql is None:
            return
        try:
            await self._sql.upsert(row)
        except Exception as exc:
            await self._sql._db.rollback()
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
        if self._sql is None:
            return
        for row in rows:
            try:
                await self._sql.upsert(row)
            except Exception as exc:
                await self._sql._db.rollback()
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
    """Dual-write wrapper for MaintenanceLog: Sheets-first, Postgres-second.

    Reads route to Postgres when USE_POSTGRES=true; fall back to Sheets otherwise.
    When ``sql`` is ``None`` (i.e. ``USE_POSTGRES=False``), all write operations
    go to Sheets only.
    """

    def __init__(self, sheets: MaintenanceRepo, sql: SqlMaintenanceRepo | None) -> None:
        self._sheets = sheets
        self._sql = sql

    async def list(self, hardware_id: str | None = None) -> builtins.list[dict[str, Any]]:
        if settings.use_postgres and self._sql is not None:
            return await self._sql.list(hardware_id=hardware_id)
        return self._sheets.list(hardware_id=hardware_id)

    async def get(self, maintenance_id: str) -> dict[str, Any] | None:
        if settings.use_postgres and self._sql is not None:
            return await self._sql.get(maintenance_id)
        return self._sheets.get(maintenance_id)

    async def add(self, row: dict[str, Any]) -> None:
        self._sheets.add(row)
        if self._sql is None:
            return
        try:
            await self._sql.add(row)
        except Exception as exc:
            await self._sql._db.rollback()
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
        if self._sql is None:
            return
        for row in rows:
            try:
                await self._sql.add(row)
            except Exception as exc:
                await self._sql._db.rollback()
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
    db: AsyncSession | None = Depends(get_db),
) -> _DualWriteCatalogRepo:
    """FastAPI dependency providing a dual-write CatalogRepo wrapper."""
    sheets = CatalogRepo(client=client, cache=cache)
    sql = SqlCatalogRepo(db=db) if db is not None else None
    return _DualWriteCatalogRepo(sheets=sheets, sql=sql)


async def get_inventory_repo(
    client: Annotated[SheetsClientProtocol, Depends(get_sheets_client)],
    cache: TTLCache = Depends(get_process_cache),
    db: AsyncSession | None = Depends(get_db),
) -> _DualWriteInventoryRepo:
    """FastAPI dependency providing a dual-write InventoryRepo wrapper."""
    sheets = InventoryRepo(client=client, cache=cache)
    sql = SqlInventoryRepo(db=db) if db is not None else None
    return _DualWriteInventoryRepo(sheets=sheets, sql=sql)


async def get_hardware_repo(
    client: Annotated[SheetsClientProtocol, Depends(get_sheets_client)],
    cache: TTLCache = Depends(get_process_cache),
    db: AsyncSession | None = Depends(get_db),
) -> _DualWriteHardwareRepo:
    """FastAPI dependency providing a dual-write HardwareRepo wrapper."""
    sheets = HardwareRepo(client=client, cache=cache)
    sql = SqlHardwareRepo(db=db) if db is not None else None
    return _DualWriteHardwareRepo(sheets=sheets, sql=sql)


async def get_maintenance_repo(
    client: Annotated[SheetsClientProtocol, Depends(get_sheets_client)],
    cache: TTLCache = Depends(get_process_cache),
    db: AsyncSession | None = Depends(get_db),
) -> _DualWriteMaintenanceRepo:
    """FastAPI dependency providing a dual-write MaintenanceRepo wrapper."""
    sheets = MaintenanceRepo(client=client, cache=cache)
    sql = SqlMaintenanceRepo(db=db) if db is not None else None
    return _DualWriteMaintenanceRepo(sheets=sheets, sql=sql)


async def get_brew_log_repo(
    client: Annotated[SheetsClientProtocol, Depends(get_sheets_client)],
    cache: TTLCache = Depends(get_process_cache),
    db: AsyncSession | None = Depends(get_db),
) -> _DualWriteBrewLogRepo:
    """FastAPI dependency providing a dual-write BrewLogRepo wrapper."""
    sheets = BrewLogRepo(client=client, cache=cache)
    sql = SqlBrewLogRepo(db=db) if db is not None else None
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
