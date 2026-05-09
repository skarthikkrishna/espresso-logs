from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class CatalogItemOut(BaseModel):
    catalog_id: str
    roaster: str
    bean_name: str
    roast_level: str
    product_url: str | None = None
    image_path: str | None = None


class InventoryBagOut(BaseModel):
    bag_id: str
    display_name: str
    beans: str
    roast_date: str | None = None
    roast_level: str | None = None
    catalog_id: str
    status: str
    storage_method: str | None = None


class HardwareItemOut(BaseModel):
    hardware_id: str
    category: str
    name: str
    image_path: str | None = None


class MaintenanceEventOut(BaseModel):
    maintenance_id: str
    hardware_id: str
    hardware_name: str
    date: str
    action_type: str
    notes: str | None = None


class BrewLogEntryOut(BaseModel):
    shot_id: str
    date: str
    bag_display: str
    roast_level: str | None = None
    machine_name: str | None = None
    grinder_name: str | None = None
    basket_name: str | None = None
    storage_method: str | None = None
    dose_in_g: float | None = None
    yield_out_g: float | None = None
    time_sec: float | None = None
    grind_setting: str | None = None
    shot_eligibility: str | None = None
    taste_summary: str | None = None
    user_notes: str | None = None
    ai_feedback: str | None = None


class DashboardBagOut(BaseModel):
    bag_id: str
    display_name: str
    roast_level: str | None = None
    days_since_last_shot: int | None = None
    last_shot: dict[str, Any] | None = None


class CatalogDetailOut(BaseModel):
    item: CatalogItemOut
    bags: list[InventoryBagOut]
    recent_shots: list[BrewLogEntryOut]


class HardwareDetailOut(BaseModel):
    item: HardwareItemOut
    maintenance: list[MaintenanceEventOut]


class DefaultsOut(BaseModel):
    machine_id: str | None = None
    grinder_id: str | None = None
    basket_id: str | None = None
    storage_method: str | None = None
    dose_in_g: str | None = None
    yield_out_g: str | None = None  # ← NEW (T004): basket-history Level 0 lookup
    grind_setting: str | None = None


class CurrentUserOut(BaseModel):
    email: str
    name: str | None = None
    picture: str | None = None


class CreatedOut(BaseModel):
    ok: bool = True


class FeedbackOut(BaseModel):
    ai_feedback: str | None = None
