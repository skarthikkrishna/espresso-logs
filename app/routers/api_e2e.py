"""Test-only endpoints for E2E teardown.

This router is only registered when ``E2E_AUTH_BYPASS=1`` is set.  It must
never be mounted in production.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.deps import get_catalog_repo, get_inventory_repo
from app.repos.base import BaseRepo
from app.repos.catalog import CatalogRepo
from app.repos.inventory import InventoryRepo

router = APIRouter(prefix="/api/e2e", tags=["e2e"])


class _CleanupBody(BaseModel):
    catalog_id: str | None = None
    bag_id: str | None = None


def _delete_by_id(repo: BaseRepo, pk_col: str, pk_val: str) -> None:
    """Find the row where *pk_col* == *pk_val* and delete it.

    Uses positional row deletion (row 1 = header, data rows start at row 2).
    Silently does nothing if *pk_val* is not found.
    """
    rows: list[dict[str, Any]] = repo._fetch_all()
    for i, row in enumerate(rows):
        if row.get(pk_col) == pk_val:
            repo.delete_rows(i + 2, i + 2)
            break


@router.delete("/cleanup", status_code=204)
async def api_e2e_cleanup(
    body: _CleanupBody,
    catalog_repo: CatalogRepo = Depends(get_catalog_repo),
    inventory_repo: InventoryRepo = Depends(get_inventory_repo),
) -> None:
    """Delete E2E seed records by ID.

    Deletes the inventory bag (if *bag_id* provided) and then the catalog item
    (if *catalog_id* provided).  Unknown IDs are silently ignored — the endpoint
    is idempotent so re-running a failed teardown never errors.

    Only reachable when the server is started with ``E2E_AUTH_BYPASS=1``.
    """
    if body.bag_id:
        _delete_by_id(inventory_repo, "Bag_ID", body.bag_id)

    if body.catalog_id:
        _delete_by_id(catalog_repo, "Catalog_ID", body.catalog_id)
