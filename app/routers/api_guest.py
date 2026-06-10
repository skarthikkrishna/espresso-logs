"""Public guest read-only household views."""

from __future__ import annotations

import datetime
import uuid
from typing import Any

import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import (
    _DualWriteBrewLogRepo,
    _DualWriteCatalogRepo,
    _DualWriteHardwareRepo,
    _DualWriteInventoryRepo,
    get_brew_log_repo,
    get_catalog_repo,
    get_hardware_repo,
    get_inventory_repo,
)
from app.models.base import get_db
from app.repos.sql.household import HouseholdRepo
from app.services.auth import hash_token

router = APIRouter(prefix="/api/guest", tags=["guest"])


class GuestHouseholdOut(BaseModel):
    name: str


class GuestCapabilitiesOut(BaseModel):
    can_write: bool = False


class GuestViewOut(BaseModel):
    household: GuestHouseholdOut
    banner: str
    dashboard: dict[str, Any]
    brew_log: dict[str, Any]
    catalog: dict[str, Any]
    capabilities: GuestCapabilitiesOut


def _float(value: object) -> float | None:
    try:
        return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None


async def _set_guest_household_context(db: AsyncSession, household_id: uuid.UUID) -> None:
    await db.execute(
        sa.text("SELECT set_config('app.current_household_id', :hid, true)"),
        {"hid": str(household_id)},
    )


def _catalog_lookup(catalog_rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {row.get("Catalog_ID", ""): row for row in catalog_rows if row.get("Catalog_ID")}


def _bag_lookup(inventory_rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {row.get("Bag_ID", ""): row for row in inventory_rows if row.get("Bag_ID")}


def _hardware_lookup(hardware_rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {row.get("Hardware_ID", ""): row for row in hardware_rows if row.get("Hardware_ID")}


def _bag_display(
    bag_id: str,
    bags: dict[str, dict[str, Any]],
    catalog: dict[str, dict[str, Any]],
) -> str:
    bag = bags.get(bag_id, {})
    catalog_row = catalog.get(bag.get("Catalog_ID", ""), {})
    roaster = catalog_row.get("Roaster", "")
    bean_name = catalog_row.get("Bean_Name", "")
    if roaster or bean_name:
        return f"{roaster} — {bean_name}".strip(" —")
    return str(bag.get("Display_Name") or bag.get("Beans") or "Coffee")


def _shot_display(
    shot: dict[str, Any],
    bags: dict[str, dict[str, Any]],
    catalog: dict[str, dict[str, Any]],
    hardware: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    bag_id = shot.get("Bag_ID") or ""
    bag = bags.get(bag_id, {})
    catalog_row = catalog.get(bag.get("Catalog_ID", ""), {})
    machine_id = shot.get("Machine_ID") or ""
    grinder_id = shot.get("Grinder_ID") or ""
    basket_id = shot.get("Basket_ID") or ""
    return {
        "date": shot.get("Date", ""),
        "bag_display": _bag_display(bag_id, bags, catalog),
        "roast_level": bag.get("RoastLevel") or catalog_row.get("Roast_Level") or None,
        "machine_name": hardware.get(machine_id, {}).get("Name") or None,
        "grinder_name": hardware.get(grinder_id, {}).get("Name") or None,
        "basket_name": hardware.get(basket_id, {}).get("Name") or None,
        "storage_method": shot.get("Storage_Method") or None,
        "dose_in_g": _float(shot.get("Dose_In_g")),
        "yield_out_g": _float(shot.get("Yield_Out_g")),
        "time_sec": _float(shot.get("Time_Sec")),
        "shot_eligibility": shot.get("Shot_Eligibility") or None,
        "taste_summary": shot.get("Taste_Summary") or None,
    }


def _bag_display_summary(
    bag: dict[str, Any],
    catalog: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    catalog_row = catalog.get(bag.get("Catalog_ID", ""), {})
    roaster = catalog_row.get("Roaster", "")
    bean_name = catalog_row.get("Bean_Name", "")
    display_name = (
        f"{roaster} — {bean_name}".strip(" —")
        if roaster or bean_name
        else str(bag.get("Display_Name") or bag.get("Beans") or "Coffee")
    )
    return {
        "display_name": display_name,
        "beans": bag.get("Beans") or None,
        "roast_level": bag.get("RoastLevel") or catalog_row.get("Roast_Level") or None,
        "status": bag.get("Status") or None,
        "storage_method": bag.get("Storage_Method") or None,
    }


def _catalog_display(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "roaster": row.get("Roaster", ""),
        "bean_name": row.get("Bean_Name", ""),
        "roast_level": row.get("Roast_Level", ""),
        "image_path": row.get("Local_Image_Path") or None,
    }


@router.get("/households/{household_id}/view", response_model=GuestViewOut)
async def guest_household_view(
    household_id: uuid.UUID,
    key: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
    brew_log_repo: _DualWriteBrewLogRepo = Depends(get_brew_log_repo),
    inventory_repo: _DualWriteInventoryRepo = Depends(get_inventory_repo),
    catalog_repo: _DualWriteCatalogRepo = Depends(get_catalog_repo),
    hardware_repo: _DualWriteHardwareRepo = Depends(get_hardware_repo),
) -> GuestViewOut:
    repo = HouseholdRepo()
    guest_token = await repo.get_guest_token_by_hash_include_expired(db, hash_token(key))
    if guest_token is None:
        raise HTTPException(status_code=401, detail="Invalid or expired guest token")
    if guest_token.household_id != household_id:
        raise HTTPException(status_code=404, detail="Guest view not found")
    if guest_token.expires_at is not None and guest_token.expires_at <= datetime.datetime.now(
        datetime.timezone.utc
    ):
        raise HTTPException(status_code=410, detail="Guest link expired")
    household = await repo.get_by_id(db, household_id)
    if household is None:
        raise HTTPException(status_code=404, detail="Household not found")

    await _set_guest_household_context(db, household_id)

    active_bags = await inventory_repo.list(status="Active")
    all_bags = await inventory_repo.list(status=None)
    catalog_rows = await catalog_repo.list()
    hardware_rows = await hardware_repo.list()
    shots, total_count = await brew_log_repo.list_paginated(page=1, per_page=25)

    catalog = _catalog_lookup(catalog_rows)
    bags = _bag_lookup(all_bags)
    hardware = _hardware_lookup(hardware_rows)
    entries = [_shot_display(shot, bags, catalog, hardware) for shot in shots]
    return GuestViewOut(
        household=GuestHouseholdOut(name=household.name),
        banner=f"You're viewing {household.name} as a guest. Sign in or create an account to log shots.",
        dashboard={
            "active_bags": [_bag_display_summary(bag, catalog) for bag in active_bags],
            "recent_shots": entries[:5],
            "stats": {
                "active_bag_count": len(active_bags),
                "recent_shot_count": total_count,
            },
        },
        brew_log={
            "entries": entries,
            "pagination": {"page": 1, "per_page": 25, "total": total_count},
        },
        catalog={
            "beans": [_catalog_display(row) for row in catalog_rows],
            "compass_summary": {},
        },
        capabilities=GuestCapabilitiesOut(can_write=False),
    )
