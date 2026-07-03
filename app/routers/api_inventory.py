"""JSON inventory endpoints."""

from __future__ import annotations

from datetime import date
from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict

from app.deps import (
    _DualWriteCatalogRepo,
    _DualWriteInventoryRepo,
    current_household_membership,
    get_catalog_repo,
    get_inventory_repo,
)
from app.models.household import HouseholdMember
from app.models.api import InventoryBagOut

router = APIRouter(prefix="/api", tags=["inventory"])


async def _resolve_display_name(bag: dict[str, Any], catalog_repo: _DualWriteCatalogRepo) -> str:
    cat_id = bag.get("Catalog_ID")
    if cat_id:
        cat = await catalog_repo.get(cat_id)
        if cat:
            return f"{cat['Roaster']} — {cat['Bean_Name']}"
    return str(bag.get("Display_Name") or bag.get("Beans", bag.get("Bag_ID", "")))


def _bag_to_out(bag: dict[str, Any], display_name: str) -> InventoryBagOut:
    return InventoryBagOut(
        bag_id=bag.get("Bag_ID", ""),
        display_name=display_name,
        beans=bag.get("Beans", ""),
        roast_date=bag.get("RoastDate") or None,
        roast_level=bag.get("RoastLevel") or None,
        catalog_id=bag.get("Catalog_ID", ""),
        status=bag.get("Status", ""),
        storage_method=bag.get("Storage_Method") or None,
    )


@router.get("/inventory", response_model=List[InventoryBagOut])
async def api_inventory_list(
    _: HouseholdMember = Depends(current_household_membership),
    status: str | None = "Active",
    inventory_repo: _DualWriteInventoryRepo = Depends(get_inventory_repo),
    catalog_repo: _DualWriteCatalogRepo = Depends(get_catalog_repo),
) -> list[InventoryBagOut]:
    if status == "all":
        bags = await inventory_repo.list(status=None)
    elif status in ("Active", "Finished", None):
        bags = await inventory_repo.list(status=status)
    else:
        bags = await inventory_repo.list(status=status)

    result = []
    for b in bags:
        result.append(_bag_to_out(b, await _resolve_display_name(b, catalog_repo)))
    return result


@router.get("/inventory/{bag_id}", response_model=InventoryBagOut)
async def api_inventory_detail(
    bag_id: str,
    _: HouseholdMember = Depends(current_household_membership),
    inventory_repo: _DualWriteInventoryRepo = Depends(get_inventory_repo),
    catalog_repo: _DualWriteCatalogRepo = Depends(get_catalog_repo),
) -> InventoryBagOut:
    bag = await inventory_repo.get(bag_id)
    if bag is None:
        raise HTTPException(status_code=404, detail="Bag not found")
    return _bag_to_out(bag, await _resolve_display_name(bag, catalog_repo))


_VALID_PATCH_STATUSES = {"Active", "Finished"}
_ROAST_LEVELS = {"Light", "Light / Medium", "Medium", "Medium / Dark", "Dark"}


class _BagPatchBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    beans: str | None = None
    roast_date: str | None = None
    roast_level: str | None = None
    status: str | None = None
    storage_method: str | None = None


async def _validate_bag_patch(
    body: _BagPatchBody,
    bag: dict[str, Any],
    catalog_repo: _DualWriteCatalogRepo,
) -> dict[str, Any]:
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=422, detail="At least one editable field is required.")

    if "status" in updates and body.status is None:
        raise HTTPException(
            status_code=422,
            detail=f"status must be one of: {sorted(_VALID_PATCH_STATUSES)}",
        )
    if body.status is not None and body.status not in _VALID_PATCH_STATUSES:
        raise HTTPException(
            status_code=422,
            detail=f"status must be one of: {sorted(_VALID_PATCH_STATUSES)}",
        )

    if "roast_date" in updates and body.roast_date is None:
        raise HTTPException(status_code=422, detail="roast_date must be ISO format (YYYY-MM-DD)")
    if body.roast_date is not None:
        try:
            date.fromisoformat(body.roast_date)
        except ValueError:
            raise HTTPException(
                status_code=422, detail="roast_date must be ISO format (YYYY-MM-DD)"
            )

    if "roast_level" in updates and body.roast_level is None:
        raise HTTPException(status_code=422, detail="roast_level is required.")
    if body.roast_level is not None:
        roast_level = body.roast_level.strip()
        catalog_roast_level = ""
        catalog_id = bag.get("Catalog_ID")
        if catalog_id:
            catalog = await catalog_repo.get(catalog_id)
            catalog_roast_level = (catalog.get("Roast_Level") if catalog else "") or ""
            catalog_roast_level = catalog_roast_level.strip()
        if catalog_roast_level:
            if roast_level != catalog_roast_level:
                raise HTTPException(
                    status_code=422,
                    detail=f"roast_level must match catalog roast level: {catalog_roast_level}",
                )
        elif not roast_level:
            raise HTTPException(status_code=422, detail="roast_level is required.")
        elif roast_level not in _ROAST_LEVELS:
            raise HTTPException(status_code=422, detail="Invalid roast level.")

    return updates


@router.patch("/inventory/{bag_id}", response_model=InventoryBagOut)
async def api_inventory_patch(
    bag_id: str,
    body: _BagPatchBody,
    _: HouseholdMember = Depends(current_household_membership),
    inventory_repo: _DualWriteInventoryRepo = Depends(get_inventory_repo),
    catalog_repo: _DualWriteCatalogRepo = Depends(get_catalog_repo),
) -> InventoryBagOut:
    bag = await inventory_repo.get(bag_id)
    if bag is None:
        raise HTTPException(status_code=404, detail="Bag not found")
    updates = await _validate_bag_patch(body, bag, catalog_repo)
    updated = dict(bag)
    if "beans" in updates:
        updated["Beans"] = (updates["beans"] or "").strip()
    if "roast_date" in updates:
        updated["RoastDate"] = updates["roast_date"].strip()
    if "roast_level" in updates:
        updated["RoastLevel"] = updates["roast_level"].strip()
    if "status" in updates:
        updated["Status"] = updates["status"]
    if "storage_method" in updates:
        updated["Storage_Method"] = (updates["storage_method"] or "").strip()
    await inventory_repo.upsert(updated)
    return _bag_to_out(updated, await _resolve_display_name(updated, catalog_repo))
