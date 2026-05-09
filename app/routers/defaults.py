"""
Defaults API router — JSON endpoint for smart pre-fill.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app.deps import (
    get_brew_log_repo,
    get_catalog_repo,
    get_inventory_repo,
    require_user,
)
from app.repos.brew_log import BrewLogRepo
from app.repos.catalog import CatalogRepo
from app.repos.inventory import InventoryRepo
from app.services import defaults as defaults_service

router = APIRouter(dependencies=[require_user])


@router.get("/api/defaults")
async def get_defaults_api(
    bag_id: str = "",
    brew_log_repo: BrewLogRepo = Depends(get_brew_log_repo),
    inventory_repo: InventoryRepo = Depends(get_inventory_repo),
    catalog_repo: CatalogRepo = Depends(get_catalog_repo),
) -> JSONResponse:
    """Return smart pre-fill defaults for *bag_id* as JSON.

    Always returns HTTP 200.  Returns ``{}`` for unknown bag IDs.
    The response never includes ``shot_eligibility``.
    """
    if not bag_id:
        return JSONResponse({})
    defaults_dict = await defaults_service.get_defaults(
        bag_id, brew_log_repo, inventory_repo, catalog_repo
    )
    return JSONResponse(defaults_dict)
