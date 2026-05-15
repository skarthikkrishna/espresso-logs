"""JSON inventory endpoints."""

from __future__ import annotations

from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.deps import CurrentUser, get_catalog_repo, get_inventory_repo
from app.models.api import InventoryBagOut
from app.repos.catalog import CatalogRepo
from app.repos.inventory import InventoryRepo

router = APIRouter(prefix="/api", tags=["inventory"])


async def _resolve_display_name(bag: dict[str, Any], catalog_repo: CatalogRepo) -> str:
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
    user: CurrentUser,
    status: str | None = "Active",
    inventory_repo: InventoryRepo = Depends(get_inventory_repo),
    catalog_repo: CatalogRepo = Depends(get_catalog_repo),
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
    user: CurrentUser,
    inventory_repo: InventoryRepo = Depends(get_inventory_repo),
    catalog_repo: CatalogRepo = Depends(get_catalog_repo),
) -> InventoryBagOut:
    bag = await inventory_repo.get(bag_id)
    if bag is None:
        raise HTTPException(status_code=404, detail="Bag not found")
    return _bag_to_out(bag, await _resolve_display_name(bag, catalog_repo))


_VALID_PATCH_STATUSES = {"Active", "Finished"}


class _BagPatchBody(BaseModel):
    status: str


@router.patch("/inventory/{bag_id}", response_model=InventoryBagOut)
async def api_inventory_patch(
    bag_id: str,
    body: _BagPatchBody,
    user: CurrentUser,
    inventory_repo: InventoryRepo = Depends(get_inventory_repo),
    catalog_repo: CatalogRepo = Depends(get_catalog_repo),
) -> InventoryBagOut:
    if body.status not in _VALID_PATCH_STATUSES:
        raise HTTPException(
            status_code=422,
            detail=f"status must be one of: {sorted(_VALID_PATCH_STATUSES)}",
        )
    bag = await inventory_repo.get(bag_id)
    if bag is None:
        raise HTTPException(status_code=404, detail="Bag not found")
    updated = {**bag, "Status": body.status}
    await inventory_repo.upsert(updated)  # type: ignore[misc, func-returns-value]
    return _bag_to_out(updated, await _resolve_display_name(updated, catalog_repo))
