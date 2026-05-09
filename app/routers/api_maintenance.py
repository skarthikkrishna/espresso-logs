"""JSON maintenance endpoints."""
from __future__ import annotations

from datetime import date
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.deps import CurrentUser, get_hardware_repo, get_maintenance_repo
from app.models.api import MaintenanceEventOut
from app.repos.hardware import HardwareRepo
from app.repos.maintenance import MaintenanceRepo
from app.services.ids import make_maintenance_id

router = APIRouter(prefix="/api", tags=["maintenance"])

_ACTION_TYPES_BY_CATEGORY = {
    "Machine": ["Backflush", "Descale", "Steam Wand Clean"],
    "Grinder": ["Re-zero"],
    "Basket": [],
}


def _maint_to_out(row: dict, hardware_name: str) -> MaintenanceEventOut:
    return MaintenanceEventOut(
        maintenance_id=row.get("Maintenance_ID", ""),
        hardware_id=row.get("Hardware_ID", ""),
        hardware_name=hardware_name,
        date=row.get("Date", ""),
        action_type=row.get("Action_Type", ""),
        notes=row.get("Notes") or None,
    )


@router.get("/maintenance", response_model=List[MaintenanceEventOut])
async def api_maintenance_list(
    user: CurrentUser,
    hardware_id: str | None = None,
    maintenance_repo: MaintenanceRepo = Depends(get_maintenance_repo),
    hardware_repo: HardwareRepo = Depends(get_hardware_repo),
) -> list[MaintenanceEventOut]:
    events = maintenance_repo.list(hardware_id=hardware_id)
    events = sorted(events, key=lambda e: e.get("Date", ""), reverse=True)
    hw_cache: dict[str, dict | None] = {}

    def _hw_name(hw_id: str) -> str:
        if hw_id not in hw_cache:
            hw_cache[hw_id] = hardware_repo.get(hw_id)
        hw = hw_cache[hw_id]
        return hw.get("Name", hw_id) if hw else hw_id

    return [_maint_to_out(e, _hw_name(e.get("Hardware_ID", ""))) for e in events]


class _MaintenanceCreateBody(BaseModel):
    hardware_id: str
    action_type: str
    date: str
    notes: str = ""


@router.post("/maintenance", response_model=MaintenanceEventOut, status_code=201)
async def api_maintenance_create(
    body: _MaintenanceCreateBody,
    user: CurrentUser,
    hardware_repo: HardwareRepo = Depends(get_hardware_repo),
    maintenance_repo: MaintenanceRepo = Depends(get_maintenance_repo),
) -> MaintenanceEventOut:
    hardware = hardware_repo.get(body.hardware_id)
    if hardware is None:
        raise HTTPException(status_code=404, detail="Hardware not found")
    if hardware.get("Category") == "Basket":
        raise HTTPException(status_code=422, detail="Basket hardware has no valid maintenance action types")

    valid_actions = _ACTION_TYPES_BY_CATEGORY.get(hardware.get("Category", ""), [])
    if body.action_type not in valid_actions:
        raise HTTPException(status_code=422, detail=f"Invalid action type for {hardware.get('Category')}")

    try:
        date.fromisoformat(body.date)
    except ValueError:
        raise HTTPException(status_code=422, detail="date must be ISO format (YYYY-MM-DD)")

    existing_ids = [e["Maintenance_ID"] for e in maintenance_repo.list()]
    maintenance_id = make_maintenance_id(existing_ids)
    row = {
        "Maintenance_ID": maintenance_id,
        "Hardware_ID": body.hardware_id,
        "Date": body.date,
        "Action_Type": body.action_type,
        "Notes": body.notes,
    }
    maintenance_repo.add(row)
    hardware_name = hardware.get("Name", body.hardware_id)
    return _maint_to_out(row, hardware_name)
