"""JSON dashboard endpoint."""

from __future__ import annotations

from datetime import date
from typing import Any, List

from fastapi import APIRouter, Depends

from app.deps import CurrentUser, get_brew_log_repo, get_catalog_repo, get_inventory_repo
from app.models.api import DashboardBagOut
from app.repos.brew_log import BrewLogRepo
from app.repos.catalog import CatalogRepo
from app.repos.inventory import InventoryRepo

router = APIRouter(prefix="/api", tags=["dashboard"])


@router.get("/dashboard", response_model=List[DashboardBagOut])
async def api_dashboard(
    user: CurrentUser,
    inventory_repo: InventoryRepo = Depends(get_inventory_repo),
    brew_log_repo: BrewLogRepo = Depends(get_brew_log_repo),
    catalog_repo: CatalogRepo = Depends(get_catalog_repo),
) -> list[DashboardBagOut]:
    # Batch fetch everything at once — 3 Sheets calls total instead of N+2
    active_bags = await inventory_repo.list()  # status="Active"

    # Build in-memory lookup dicts to avoid per-bag Sheets calls
    all_catalog = {row["Catalog_ID"]: row for row in await catalog_repo.list()}

    shots_by_bag: dict[str, list[dict[str, Any]]] = {}
    for shot in await brew_log_repo.list():
        bag_id = shot.get("Bag_ID", "")
        if bag_id:
            shots_by_bag.setdefault(bag_id, []).append(shot)

    result = []
    for bag in active_bags:
        bag_id = bag["Bag_ID"]
        display_name = bag.get("Beans", bag_id)
        cat_id = bag.get("Catalog_ID")
        if cat_id and cat_id in all_catalog:
            cat = all_catalog[cat_id]
            display_name = f"{cat['Roaster']} — {cat['Bean_Name']}"

        shots = sorted(
            shots_by_bag.get(bag_id, []),
            key=lambda s: s.get("Date", ""),
            reverse=True,
        )
        last_shot_data = None
        days = None
        if shots:
            s = shots[0]
            try:
                days = (date.today() - date.fromisoformat(s["Date"])).days
            except Exception:  # nosec B110  # date parse failure is non-fatal; days stays 0
                pass

            def _float(v: object) -> float | None:
                try:
                    return float(v)  # type: ignore[arg-type]
                except Exception:
                    return None

            last_shot_data = {
                "dose_in_g": _float(s.get("Dose_In_g")),
                "yield_out_g": _float(s.get("Yield_Out_g")),
                "time_sec": _float(s.get("Time_Sec")),
                "shot_eligibility": s.get("Shot_Eligibility"),
            }
        result.append(
            DashboardBagOut(
                bag_id=bag_id,
                display_name=display_name,
                roast_level=bag.get("RoastLevel"),
                days_since_last_shot=days,
                last_shot=last_shot_data,
            )
        )
    return result
