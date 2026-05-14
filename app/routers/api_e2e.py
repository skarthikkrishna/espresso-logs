"""Test-only endpoints for E2E teardown.

This router is only registered when ``E2E_AUTH_BYPASS=1`` is set.  It must
never be mounted in production.
"""

from __future__ import annotations

from typing import Any, Protocol

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.deps import get_catalog_repo, get_inventory_repo

router = APIRouter(prefix="/api/e2e", tags=["e2e"])


class _RepoPkDelete(Protocol):
    """Structural protocol for repos that support deletion by primary-key value."""

    def delete_by_pk(self, pk_col: str, pk_val: str) -> None: ...


class _CleanupBody(BaseModel):
    catalog_id: str | None = None
    bag_id: str | None = None


@router.delete("/cleanup", status_code=204)
async def api_e2e_cleanup(
    body: _CleanupBody,
    catalog_repo: Any = Depends(get_catalog_repo),
    inventory_repo: Any = Depends(get_inventory_repo),
) -> None:
    """Delete E2E seed records by ID.

    Deletes the inventory bag (if *bag_id* provided) and then the catalog item
    (if *catalog_id* provided).  Unknown IDs are silently ignored — the endpoint
    is idempotent so re-running a failed teardown never errors.

    Only reachable when the server is started with ``E2E_AUTH_BYPASS=1``.
    """
    if body.bag_id:
        inventory_repo.delete_by_pk("Bag_ID", body.bag_id)

    if body.catalog_id:
        catalog_repo.delete_by_pk("Catalog_ID", body.catalog_id)
