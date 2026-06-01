"""
Defaults API router — JSON endpoint for smart pre-fill.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app.deps import (
    _DualWriteBrewLogRepo,
    _DualWriteCatalogRepo,
    _DualWriteInventoryRepo,
    current_household_membership,
    get_brew_log_repo,
    get_catalog_repo,
    get_inventory_repo,
)
from app.services import defaults as defaults_service

router = APIRouter(dependencies=[Depends(current_household_membership)])


@router.get("/api/defaults")
async def get_defaults_api(
    bag_id: str = "",
    brew_log_repo: _DualWriteBrewLogRepo = Depends(get_brew_log_repo),
    inventory_repo: _DualWriteInventoryRepo = Depends(get_inventory_repo),
    catalog_repo: _DualWriteCatalogRepo = Depends(get_catalog_repo),
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
