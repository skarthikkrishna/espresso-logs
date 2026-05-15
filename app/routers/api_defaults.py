"""JSON defaults endpoint — smart pre-fill by bag_id path param."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.deps import (
    CurrentUser,
    _DualWriteBrewLogRepo,
    _DualWriteCatalogRepo,
    _DualWriteInventoryRepo,
    get_brew_log_repo,
    get_catalog_repo,
    get_inventory_repo,
)
from app.models.api import DefaultsOut
from app.services import defaults as defaults_service

router = APIRouter(prefix="/api", tags=["defaults"])


@router.get("/defaults/{bag_id}", response_model=DefaultsOut)
async def api_get_defaults(
    bag_id: str,
    user: CurrentUser,
    basket_id: str | None = Query(default=None),
    brew_log_repo: _DualWriteBrewLogRepo = Depends(get_brew_log_repo),
    inventory_repo: _DualWriteInventoryRepo = Depends(get_inventory_repo),
    catalog_repo: _DualWriteCatalogRepo = Depends(get_catalog_repo),
) -> DefaultsOut:
    defaults_dict = await defaults_service.get_defaults(
        bag_id, brew_log_repo, inventory_repo, catalog_repo, basket_id=basket_id
    )
    return DefaultsOut(
        machine_id=defaults_dict.get("machine_id"),
        grinder_id=defaults_dict.get("grinder_id"),
        basket_id=defaults_dict.get("basket_id"),
        storage_method=defaults_dict.get("storage_method"),
        dose_in_g=str(defaults_dict["dose_in_g"])
        if defaults_dict.get("dose_in_g") is not None
        else None,
        yield_out_g=str(defaults_dict["yield_out_g"])
        if defaults_dict.get("yield_out_g") is not None
        else None,
        grind_setting=str(defaults_dict["grind_setting"])
        if defaults_dict.get("grind_setting") is not None
        else None,
    )
