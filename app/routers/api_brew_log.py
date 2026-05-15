"""JSON brew log endpoints."""

from __future__ import annotations

import asyncio
import logging
from datetime import date
from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.deps import (
    CurrentUser,
    _DualWriteBrewLogRepo,
    _DualWriteCatalogRepo,
    _DualWriteHardwareRepo,
    _DualWriteInventoryRepo,
    _DualWriteMaintenanceRepo,
    get_brew_log_repo,
    get_catalog_repo,
    get_hardware_repo,
    get_idempotency_store,
    get_inventory_repo,
    get_llm_client,
    get_maintenance_repo,
)
from app.models.api import BrewLogEntryOut, FeedbackOut
from app.services.idempotency_store import IdempotencyStore
from app.services.ids import make_shot_id
from app.services.inference import LLMClient, get_ai_feedback

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["brew-log"])


def _float(v: object) -> float | None:
    try:
        return float(v)  # type: ignore[arg-type]
    except Exception:
        return None


async def _build_lookups(
    inventory_repo: _DualWriteInventoryRepo,
    catalog_repo: _DualWriteCatalogRepo,
    hardware_repo: _DualWriteHardwareRepo,
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    """Pre-fetch all lookup tables once; return (bags, catalog, hardware) dicts.

    Duplicate PKs use first-row-wins semantics (insertion order preserved).
    """
    bags: dict[str, Any] = {}
    for r in await inventory_repo.list_all():
        bags.setdefault(r["Bag_ID"], r)
    catalog: dict[str, Any] = {}
    for r in await catalog_repo.list():
        catalog.setdefault(r["Catalog_ID"], r)
    hardware: dict[str, Any] = {}
    for r in await hardware_repo.list():
        hardware.setdefault(r["Hardware_ID"], r)
    return bags, catalog, hardware


def _resolve_names_from_dicts(
    shot: dict[str, Any],
    bags: dict[str, Any],
    catalog: dict[str, Any],
    hardware: dict[str, Any],
) -> dict[str, Any]:
    """Resolve display names from pre-fetched lookup dicts (zero Sheets reads)."""
    bag_id = shot.get("Bag_ID") or ""
    bag_row = bags.get(bag_id, {})
    catalog_row = catalog.get(bag_row.get("Catalog_ID", ""), {})

    machine_id = shot.get("Machine_ID") or ""
    grinder_id = shot.get("Grinder_ID") or ""
    basket_id = shot.get("Basket_ID") or ""

    roaster = catalog_row.get("Roaster", "")
    bean_name = catalog_row.get("Bean_Name", "")
    bag_display = f"{roaster} — {bean_name}".strip(" —") if (roaster or bean_name) else bag_id

    return {
        **shot,
        "bag_display": bag_display or bag_id or "",
        "roast_level": bag_row.get("RoastLevel") or catalog_row.get("Roast_Level") or None,
        "machine_name": hardware.get(machine_id, {}).get("Name") or None,
        "grinder_name": hardware.get(grinder_id, {}).get("Name") or None,
        "basket_name": hardware.get(basket_id, {}).get("Name") or None,
    }


def _shot_to_out(shot: dict[str, Any], names: dict[str, Any]) -> BrewLogEntryOut:
    return BrewLogEntryOut(
        shot_id=shot.get("Shot_ID", ""),
        date=shot.get("Date", ""),
        bag_display=names["bag_display"],
        roast_level=names.get("roast_level"),
        machine_name=names.get("machine_name"),
        grinder_name=names.get("grinder_name"),
        basket_name=names.get("basket_name"),
        storage_method=shot.get("Storage_Method") or None,
        dose_in_g=_float(shot.get("Dose_In_g")),
        yield_out_g=_float(shot.get("Yield_Out_g")),
        time_sec=_float(shot.get("Time_Sec")),
        grind_setting=str(shot["Grind_Setting"])
        if shot.get("Grind_Setting") not in (None, "")
        else None,
        shot_eligibility=shot.get("Shot_Eligibility") or None,
        taste_summary=shot.get("Taste_Summary") or None,
        user_notes=shot.get("User_Notes") or None,
        ai_feedback=shot.get("AI_Feedback") or None,
    )


@router.get("/brew-log", response_model=List[BrewLogEntryOut])
async def api_brew_log_list(
    user: CurrentUser,
    brew_log_repo: _DualWriteBrewLogRepo = Depends(get_brew_log_repo),
    inventory_repo: _DualWriteInventoryRepo = Depends(get_inventory_repo),
    catalog_repo: _DualWriteCatalogRepo = Depends(get_catalog_repo),
    hardware_repo: _DualWriteHardwareRepo = Depends(get_hardware_repo),
) -> list[BrewLogEntryOut]:
    shots = await brew_log_repo.list_recent(20)
    bags, catalog, hardware = await _build_lookups(inventory_repo, catalog_repo, hardware_repo)
    return [_shot_to_out(s, _resolve_names_from_dicts(s, bags, catalog, hardware)) for s in shots]


@router.get("/brew-log/{shot_id}/feedback", response_model=FeedbackOut)
async def api_brew_log_feedback(
    shot_id: str,
    user: CurrentUser,
    brew_log_repo: _DualWriteBrewLogRepo = Depends(get_brew_log_repo),
) -> FeedbackOut:
    shot = await brew_log_repo.get(shot_id)
    if shot is None:
        raise HTTPException(status_code=404, detail="Shot not found")
    return FeedbackOut(ai_feedback=shot.get("AI_Feedback") or None)


@router.get("/brew-log/{shot_id}", response_model=BrewLogEntryOut)
async def api_brew_log_detail(
    shot_id: str,
    user: CurrentUser,
    brew_log_repo: _DualWriteBrewLogRepo = Depends(get_brew_log_repo),
    inventory_repo: _DualWriteInventoryRepo = Depends(get_inventory_repo),
    catalog_repo: _DualWriteCatalogRepo = Depends(get_catalog_repo),
    hardware_repo: _DualWriteHardwareRepo = Depends(get_hardware_repo),
) -> BrewLogEntryOut:
    shot = await brew_log_repo.get(shot_id)
    if shot is None:
        raise HTTPException(status_code=404, detail="Shot not found")
    bags, catalog, hardware = await _build_lookups(inventory_repo, catalog_repo, hardware_repo)
    names = _resolve_names_from_dicts(shot, bags, catalog, hardware)
    return _shot_to_out(shot, names)


class _BrewLogCreateBody(BaseModel):
    bag_id: str
    machine_id: str = ""
    grinder_id: str = ""
    basket_id: str = ""
    dose_in_g: float
    yield_out_g: float
    time_sec: float
    grind_setting: str
    shot_eligibility: str
    taste_summary: str = ""
    user_notes: str = ""
    storage_method: str = ""
    shot_date: str | None = None
    idempotency_key: str | None = None  # stripped before repo layer; never written to Sheets


@router.post("/brew-log", response_model=BrewLogEntryOut, status_code=201)
async def api_brew_log_create(
    body: _BrewLogCreateBody,
    user: CurrentUser,
    brew_log_repo: _DualWriteBrewLogRepo = Depends(get_brew_log_repo),
    inventory_repo: _DualWriteInventoryRepo = Depends(get_inventory_repo),
    catalog_repo: _DualWriteCatalogRepo = Depends(get_catalog_repo),
    hardware_repo: _DualWriteHardwareRepo = Depends(get_hardware_repo),
    maintenance_repo: _DualWriteMaintenanceRepo = Depends(get_maintenance_repo),
    llm_client: LLMClient = Depends(get_llm_client),
    store: IdempotencyStore = Depends(get_idempotency_store),
) -> BrewLogEntryOut:
    shot_date = date.today()
    if body.shot_date:
        try:
            shot_date = date.fromisoformat(body.shot_date)
        except ValueError:
            raise HTTPException(status_code=422, detail="shot_date must be ISO format (YYYY-MM-DD)")

    # Idempotency check — fail-open: skip entirely if key is absent/null/empty
    if body.idempotency_key:
        cached = await store.check_and_set_sentinel(body.idempotency_key)
        if cached is not None:
            return JSONResponse(status_code=200, content=cached)  # type: ignore[return-value]

    existing_ids = await brew_log_repo.list_existing_ids()
    shot_id = make_shot_id(shot_date, body.bag_id, existing_ids)

    row = {
        "Shot_ID": shot_id,
        "Date": shot_date.isoformat(),
        "Bag_ID": body.bag_id,
        "Machine_ID": body.machine_id,
        "Grinder_ID": body.grinder_id,
        "Basket_ID": body.basket_id,
        "Dose_In_g": body.dose_in_g,
        "Yield_Out_g": body.yield_out_g,
        "Time_Sec": body.time_sec,
        "Grind_Setting": body.grind_setting,
        "Shot_Eligibility": body.shot_eligibility,
        "Taste_Summary": body.taste_summary,
        "User_Notes": body.user_notes,
        "Storage_Method": body.storage_method,
    }
    await brew_log_repo.add(row)

    # Fire-and-forget AI feedback
    bags, catalog, hardware = await _build_lookups(inventory_repo, catalog_repo, hardware_repo)
    names = _resolve_names_from_dicts(row, bags, catalog, hardware)
    extra_context = {
        "machine_name": names.get("machine_name") or "",
        "grinder_name": names.get("grinder_name") or "",
        "basket_name": names.get("basket_name") or "",
        "roast_level": names.get("roast_level") or "",
        "taste_summary": body.taste_summary,
        "storage_method": body.storage_method or "",
    }
    asyncio.create_task(
        get_ai_feedback(
            shot_id, brew_log_repo, maintenance_repo, llm_client, extra_context=extra_context
        )
    )

    shot_out = _shot_to_out(row, names)

    # Cache the response for idempotent replay — only on the successful path
    if body.idempotency_key:
        await store.store(body.idempotency_key, shot_out.model_dump())

    return shot_out
