from __future__ import annotations

import threading
from typing import TYPE_CHECKING, Annotated, Any, cast

if TYPE_CHECKING:
    from app.services.inference import LLMClient

from fastapi import Depends, Request

from app.repos.base import TTLCache, get_process_cache
from app.repos.brew_log import BrewLogRepo
from app.repos.catalog import CatalogRepo
from app.repos.hardware import HardwareRepo
from app.repos.inventory import InventoryRepo
from app.repos.maintenance import MaintenanceRepo
from app.repos.sheets_client import RealSheetsClient, SheetsClientProtocol
from app.services.idempotency_store import IdempotencyStore


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
# Repository factory functions (request-scoped)
# ---------------------------------------------------------------------------


def get_catalog_repo(
    client: Annotated[SheetsClientProtocol, Depends(get_sheets_client)],
    cache: TTLCache = Depends(get_process_cache),
) -> CatalogRepo:
    """FastAPI dependency that provides a CatalogRepo."""
    return CatalogRepo(client=client, cache=cache)


def get_inventory_repo(
    client: Annotated[SheetsClientProtocol, Depends(get_sheets_client)],
    cache: TTLCache = Depends(get_process_cache),
) -> InventoryRepo:
    """FastAPI dependency that provides an InventoryRepo."""
    return InventoryRepo(client=client, cache=cache)


def get_hardware_repo(
    client: Annotated[SheetsClientProtocol, Depends(get_sheets_client)],
    cache: TTLCache = Depends(get_process_cache),
) -> HardwareRepo:
    """FastAPI dependency that provides a HardwareRepo."""
    return HardwareRepo(client=client, cache=cache)


def get_maintenance_repo(
    client: Annotated[SheetsClientProtocol, Depends(get_sheets_client)],
    cache: TTLCache = Depends(get_process_cache),
) -> MaintenanceRepo:
    """FastAPI dependency that provides a MaintenanceRepo."""
    return MaintenanceRepo(client=client, cache=cache)


def get_brew_log_repo(
    client: Annotated[SheetsClientProtocol, Depends(get_sheets_client)],
    cache: TTLCache = Depends(get_process_cache),
) -> BrewLogRepo:
    """FastAPI dependency that provides a BrewLogRepo."""
    return BrewLogRepo(client=client, cache=cache)


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
