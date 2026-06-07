"""JSON brew log endpoints."""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import math
from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict
from sqlalchemy.exc import IntegrityError

from app.config import settings
from app.deps import (
    _DualWriteBrewLogRepo,
    _DualWriteCatalogRepo,
    _DualWriteHardwareRepo,
    _DualWriteInventoryRepo,
    _DualWriteMaintenanceRepo,
    current_household_membership,
    get_brew_log_repo,
    get_catalog_repo,
    get_hardware_repo,
    get_idempotency_store,
    get_inventory_repo,
    get_llm_client,
    get_maintenance_repo,
    require_admin,
    resolve_guest_or_member,
)
from app.models.api import BrewLogEntryOut, BrewLogPageOut, FeedbackOut
from app.models.household import GuestToken, HouseholdMember
from app.services.idempotency_store import IdempotencyStore
from app.services.ids import make_shot_id
from app.services.inference import LLMClient, LLMError, get_ai_feedback

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["brew-log"])

_SHOT_ELIGIBILITIES = frozenset({"Reject", "Passable", "Good Espresso", "God Shot"})


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


@router.get("/brew-log", response_model=BrewLogPageOut)
async def api_brew_log_list(
    _: HouseholdMember | GuestToken = Depends(resolve_guest_or_member),
    page: int = 1,
    per_page: int = 100,
    brew_log_repo: _DualWriteBrewLogRepo = Depends(get_brew_log_repo),
    inventory_repo: _DualWriteInventoryRepo = Depends(get_inventory_repo),
    catalog_repo: _DualWriteCatalogRepo = Depends(get_catalog_repo),
    hardware_repo: _DualWriteHardwareRepo = Depends(get_hardware_repo),
) -> BrewLogPageOut:
    page = max(1, page)
    per_page = max(1, min(per_page, 100))
    shots, total_count = await brew_log_repo.list_paginated(page, per_page)
    bags, catalog, hardware = await _build_lookups(inventory_repo, catalog_repo, hardware_repo)
    items = [_shot_to_out(s, _resolve_names_from_dicts(s, bags, catalog, hardware)) for s in shots]
    return BrewLogPageOut(
        items=items,
        page=page,
        per_page=per_page,
        total_count=total_count,
        has_next=(page * per_page) < total_count,
        sync_alert=settings.brew_log_sync_alert,
    )


@router.get("/brew-log/{shot_id}/feedback", response_model=FeedbackOut)
async def api_brew_log_feedback(
    shot_id: str,
    _: HouseholdMember = Depends(current_household_membership),
    brew_log_repo: _DualWriteBrewLogRepo = Depends(get_brew_log_repo),
) -> FeedbackOut:
    shot = await brew_log_repo.get(shot_id)
    if shot is None:
        raise HTTPException(status_code=404, detail="Shot not found")
    return FeedbackOut(ai_feedback=shot.get("AI_Feedback") or None)


@router.get("/brew-log/{shot_id}", response_model=BrewLogEntryOut)
async def api_brew_log_detail(
    shot_id: str,
    _: HouseholdMember = Depends(current_household_membership),
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


class _BrewLogPatchBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    taste_summary: str | None = None
    user_notes: str | None = None
    grind_setting: str | None = None
    shot_eligibility: str | None = None


def _normalise_idempotency_key(key: str | None) -> str | None:
    if key is None:
        return None
    key = key.strip()
    return key or None


def _idempotency_request_hash(body: _BrewLogCreateBody, shot_date: date) -> str:
    payload = {
        "bag_id": body.bag_id,
        "basket_id": body.basket_id,
        "dose_in_g": body.dose_in_g,
        "grinder_id": body.grinder_id,
        "grind_setting": body.grind_setting,
        "machine_id": body.machine_id,
        "shot_date": shot_date.isoformat(),
        "shot_eligibility": body.shot_eligibility,
        "storage_method": body.storage_method,
        "taste_summary": body.taste_summary,
        "time_sec": body.time_sec,
        "user_notes": body.user_notes,
        "yield_out_g": body.yield_out_g,
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


async def _render_shot_response(
    shot: dict[str, Any],
    inventory_repo: _DualWriteInventoryRepo,
    catalog_repo: _DualWriteCatalogRepo,
    hardware_repo: _DualWriteHardwareRepo,
) -> BrewLogEntryOut:
    bags, catalog, hardware = await _build_lookups(inventory_repo, catalog_repo, hardware_repo)
    names = _resolve_names_from_dicts(shot, bags, catalog, hardware)
    return _shot_to_out(shot, names)


def _normalise_brew_log_patch(body: _BrewLogPatchBody) -> dict[str, Any]:
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=422, detail="At least one editable field is required.")

    if "grind_setting" in updates:
        grind_setting = updates["grind_setting"]
        if grind_setting is None or grind_setting.strip() == "":
            updates["grind_setting"] = ""
        else:
            try:
                numeric_grind_setting = float(grind_setting)
            except ValueError:
                raise HTTPException(status_code=422, detail="grind_setting must be numeric.")
            if not math.isfinite(numeric_grind_setting):
                raise HTTPException(status_code=422, detail="grind_setting must be numeric.")
            updates["grind_setting"] = grind_setting.strip()

    if "shot_eligibility" in updates:
        shot_eligibility = updates["shot_eligibility"]
        if shot_eligibility is None:
            updates["shot_eligibility"] = None
        else:
            shot_eligibility = shot_eligibility.strip()
            if shot_eligibility == "":
                updates["shot_eligibility"] = None
            elif shot_eligibility not in _SHOT_ELIGIBILITIES:
                raise HTTPException(
                    status_code=422,
                    detail=f"shot_eligibility must be one of: {sorted(_SHOT_ELIGIBILITIES)}",
                )
            else:
                updates["shot_eligibility"] = shot_eligibility

    return updates


@router.patch("/brew-log/{shot_id}", response_model=BrewLogEntryOut)
async def api_brew_log_patch(
    shot_id: str,
    body: _BrewLogPatchBody,
    _: HouseholdMember = Depends(current_household_membership),
    brew_log_repo: _DualWriteBrewLogRepo = Depends(get_brew_log_repo),
    inventory_repo: _DualWriteInventoryRepo = Depends(get_inventory_repo),
    catalog_repo: _DualWriteCatalogRepo = Depends(get_catalog_repo),
    hardware_repo: _DualWriteHardwareRepo = Depends(get_hardware_repo),
) -> BrewLogEntryOut:
    updates = _normalise_brew_log_patch(body)
    updated = await brew_log_repo.update_correction(shot_id, updates)
    if updated is None:
        raise HTTPException(status_code=404, detail="Shot not found")
    return await _render_shot_response(updated, inventory_repo, catalog_repo, hardware_repo)


@router.post("/brew-log/{shot_id}/feedback", response_model=FeedbackOut)
async def api_brew_log_feedback_generate(
    shot_id: str,
    membership: HouseholdMember = Depends(current_household_membership),
    brew_log_repo: _DualWriteBrewLogRepo = Depends(get_brew_log_repo),
    inventory_repo: _DualWriteInventoryRepo = Depends(get_inventory_repo),
    catalog_repo: _DualWriteCatalogRepo = Depends(get_catalog_repo),
    hardware_repo: _DualWriteHardwareRepo = Depends(get_hardware_repo),
    maintenance_repo: _DualWriteMaintenanceRepo = Depends(get_maintenance_repo),
    llm_client: LLMClient = Depends(get_llm_client),
) -> FeedbackOut:
    shot = await brew_log_repo.get(shot_id)
    if shot is None:
        raise HTTPException(status_code=404, detail="Shot not found")

    bags, catalog, hardware = await _build_lookups(inventory_repo, catalog_repo, hardware_repo)
    names = _resolve_names_from_dicts(shot, bags, catalog, hardware)
    extra_context = {
        "machine_name": names.get("machine_name") or "",
        "grinder_name": names.get("grinder_name") or "",
        "basket_name": names.get("basket_name") or "",
        "roast_level": names.get("roast_level") or "",
        "taste_summary": shot.get("Taste_Summary") or "",
        "storage_method": shot.get("Storage_Method") or "",
    }

    try:
        if settings.use_postgres:
            await brew_log_repo.set_household_context(membership.household_id)
        feedback = await asyncio.wait_for(
            get_ai_feedback(
                shot_id,
                brew_log_repo,
                maintenance_repo,
                llm_client,
                extra_context=extra_context,
                force=True,
                raise_on_error=True,
            ),
            timeout=35.0,
        )
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=504,
            detail={
                "error": "AI_FEEDBACK_TIMEOUT",
                "message": "AI feedback generation timed out. Please try again.",
            },
        )
    except (LLMError, ValueError):
        raise HTTPException(
            status_code=502,
            detail={
                "error": "AI_FEEDBACK_GENERATION_FAILED",
                "message": "AI feedback generation failed. Please try again.",
            },
        )

    return FeedbackOut(ai_feedback=feedback)


async def _existing_idempotent_response(
    idempotency_key: str,
    request_hash: str,
    brew_log_repo: _DualWriteBrewLogRepo,
    inventory_repo: _DualWriteInventoryRepo,
    catalog_repo: _DualWriteCatalogRepo,
    hardware_repo: _DualWriteHardwareRepo,
) -> JSONResponse | None:
    existing = await brew_log_repo.get_by_idempotency_key(idempotency_key)
    if existing is None:
        return None
    if existing.get("Idempotency_Request_Hash") != request_hash:
        raise HTTPException(status_code=409, detail="Idempotency key reused with different payload")
    shot_out = await _render_shot_response(existing, inventory_repo, catalog_repo, hardware_repo)
    return JSONResponse(status_code=200, content=shot_out.model_dump())


@router.post("/brew-log", response_model=BrewLogEntryOut, status_code=201)
async def api_brew_log_create(
    body: _BrewLogCreateBody,
    membership: HouseholdMember = Depends(current_household_membership),
    brew_log_repo: _DualWriteBrewLogRepo = Depends(get_brew_log_repo),
    inventory_repo: _DualWriteInventoryRepo = Depends(get_inventory_repo),
    catalog_repo: _DualWriteCatalogRepo = Depends(get_catalog_repo),
    hardware_repo: _DualWriteHardwareRepo = Depends(get_hardware_repo),
    maintenance_repo: _DualWriteMaintenanceRepo = Depends(get_maintenance_repo),
    llm_client: LLMClient = Depends(get_llm_client),
    store: IdempotencyStore = Depends(get_idempotency_store),
) -> BrewLogEntryOut | JSONResponse:
    shot_date = date.today()
    if body.shot_date:
        try:
            shot_date = date.fromisoformat(body.shot_date)
        except ValueError:
            raise HTTPException(status_code=422, detail="shot_date must be ISO format (YYYY-MM-DD)")

    idempotency_key = _normalise_idempotency_key(body.idempotency_key)
    request_hash = _idempotency_request_hash(body, shot_date) if idempotency_key else None

    if settings.use_postgres and idempotency_key and request_hash:
        existing_response = await _existing_idempotent_response(
            idempotency_key,
            request_hash,
            brew_log_repo,
            inventory_repo,
            catalog_repo,
            hardware_repo,
        )
        if existing_response is not None:
            return existing_response
    elif idempotency_key:
        cached = await store.check_and_set_sentinel(idempotency_key)
        if cached is not None:
            return JSONResponse(status_code=200, content=cached)

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
    if idempotency_key and request_hash:
        row["Idempotency_Key"] = idempotency_key
        row["Idempotency_Request_Hash"] = request_hash

    try:
        await brew_log_repo.add(row, commit=not settings.use_postgres)
        bags, catalog, hardware = await _build_lookups(inventory_repo, catalog_repo, hardware_repo)
        names = _resolve_names_from_dicts(row, bags, catalog, hardware)
        shot_out = _shot_to_out(row, names)
        if settings.use_postgres:
            await brew_log_repo.commit()
    except IntegrityError:
        await brew_log_repo.rollback()
        if settings.use_postgres and idempotency_key and request_hash:
            await brew_log_repo.set_household_context(membership.household_id)
            existing_response = await _existing_idempotent_response(
                idempotency_key,
                request_hash,
                brew_log_repo,
                inventory_repo,
                catalog_repo,
                hardware_repo,
            )
            if existing_response is not None:
                return existing_response
        raise
    except Exception:
        await brew_log_repo.rollback()
        raise

    extra_context = {
        "machine_name": names.get("machine_name") or "",
        "grinder_name": names.get("grinder_name") or "",
        "basket_name": names.get("basket_name") or "",
        "roast_level": names.get("roast_level") or "",
        "taste_summary": body.taste_summary,
        "storage_method": body.storage_method or "",
    }
    try:
        if settings.use_postgres:
            await brew_log_repo.set_household_context(membership.household_id)
        await asyncio.wait_for(
            get_ai_feedback(
                shot_id, brew_log_repo, maintenance_repo, llm_client, extra_context=extra_context
            ),
            timeout=35.0,
        )
    except asyncio.TimeoutError:
        logger.warning(
            "get_ai_feedback timed out after 35 s for shot_id=%r — proceeding without feedback",
            shot_id,
        )
    except Exception:
        if settings.use_postgres:
            await brew_log_repo.rollback()
        logger.warning(
            "get_ai_feedback failed for shot_id=%r — proceeding without feedback", shot_id
        )

    # Cache the response for idempotent replay — only on the successful path
    if idempotency_key:
        await store.store(idempotency_key, shot_out.model_dump())

    return shot_out


@router.delete("/brew-log/{shot_id}", status_code=204)
async def api_brew_log_delete(
    shot_id: str,
    _: HouseholdMember = Depends(require_admin),
    brew_log_repo: _DualWriteBrewLogRepo = Depends(get_brew_log_repo),
) -> None:
    """Delete a brew log entry by Shot_ID. Admin role required (AC-097)."""
    deleted = await brew_log_repo.delete_by_shot_id(shot_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Brew log entry not found")
