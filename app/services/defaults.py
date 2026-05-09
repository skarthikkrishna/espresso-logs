"""
Defaults service — smart pre-fill for the brew log form.

Implements a 4-level fallback chain:
  Level 1: Most recent shot for this exact bag (best match)
  Level 2: Most recent shot for another bag from the same roaster
  Level 3: Most recent shot for another bag with the same roast level
  Level 4: Return empty dict (no history at all)
"""

from __future__ import annotations

from app.repos.brew_log import BrewLogRepo
from app.repos.catalog import CatalogRepo
from app.repos.inventory import InventoryRepo

# Column names from Brew_Log sheet → snake_case output keys
# Confirmed: Brew_Log sheet column is "Yield_Out_g" — verified per spec BE-2 requirement
_FIELD_MAP = {
    "Machine_ID": "machine_id",
    "Grinder_ID": "grinder_id",
    "Basket_ID": "basket_id",
    "Storage_Method": "storage_method",
    "Dose_In_g": "dose_in_g",
    "Yield_Out_g": "yield_out_g",   # BE-2: added; handled via _extract_defaults(), not ad-hoc
    "Grind_Setting": "grind_setting",
}


def _extract_defaults(shot: dict) -> dict:
    """Extract equipment/dose fields from a shot row (sheet column names → snake_case).

    Omits any field whose value is None or empty string.
    ``shot_eligibility`` is never included.
    """
    return {
        snake: shot[col]
        for col, snake in _FIELD_MAP.items()
        if shot.get(col) not in (None, "")
    }


async def get_defaults(
    bag_id: str,
    brew_log_repo: BrewLogRepo,
    inventory_repo: InventoryRepo,
    catalog_repo: CatalogRepo,
    basket_id: str | None = None,  # ← NEW (T008): Level 0 basket-specific lookup
) -> dict:
    """Return smart pre-fill defaults for *bag_id* using a 4-level fallback chain.

    Args:
        bag_id: The ``Bag_ID`` to pre-fill for.
        brew_log_repo: Provides shot history.
        inventory_repo: Provides bag metadata (RoastLevel, Catalog_ID).
        catalog_repo: Provides catalog metadata (Roaster).
        basket_id: Optional basket Hardware_ID. When provided, Level 0 returns
            defaults from the most recent shot on *this bag* that used the same
            basket. Falls through to Level 1+ when no basket-specific shots exist.

    Returns:
        A dict with zero or more of:
        ``machine_id``, ``grinder_id``, ``basket_id``, ``storage_method``,
        ``dose_in_g``, ``yield_out_g``, ``grind_setting``.

        Returns ``{}`` when no suitable prior shots are found (Level 4).
        ``shot_eligibility`` is **never** a key in the response.
    """
    # BE-1: hoist list_for_bag above the basket_id branch so Level 0 and Level 1
    # share a single Sheets read. Do NOT call list_for_bag twice.
    shots = brew_log_repo.list_for_bag(bag_id)

    # ── Level 0: basket-specific exact bag match ─────────────────────────────
    if basket_id:
        basket_shots = [s for s in shots if s.get("Basket_ID") == basket_id]
        if basket_shots:
            most_recent = max(basket_shots, key=lambda s: s.get("Date", ""))
            # yield_out_g is included via _extract_defaults() because "Yield_Out_g"
            # is now in _FIELD_MAP (BE-2) — no separate .get() call needed
            return _extract_defaults(most_recent)

    # ── Level 1: exact bag match (any basket) ────────────────────────────────
    # Re-uses `shots` from above — no second Sheets API call (BE-1)
    if shots:
        most_recent = max(shots, key=lambda s: s.get("Date", ""))
        return _extract_defaults(most_recent)

    # ── Levels 2 & 3 require the bag to exist in Inventory ───────────────────
    bag = inventory_repo.get(bag_id)
    if bag is None:
        return {}

    # ── Level 2: same roaster ─────────────────────────────────────────────────
    catalog_id = bag.get("Catalog_ID")
    if catalog_id:
        catalog = catalog_repo.get(catalog_id)
        if catalog:
            roaster = catalog.get("Roaster")
            if roaster:
                active_bags = inventory_repo.list()  # defaults to status="Active"
                all_shots: list[dict] = []
                for active_bag in active_bags:
                    other_cat_id = active_bag.get("Catalog_ID")
                    if other_cat_id:
                        other_catalog = catalog_repo.get(other_cat_id)
                        if other_catalog and other_catalog.get("Roaster") == roaster:
                            all_shots.extend(brew_log_repo.list_for_bag(active_bag["Bag_ID"]))
                if all_shots:
                    most_recent = max(all_shots, key=lambda s: s.get("Date", ""))
                    return _extract_defaults(most_recent)

    # ── Level 3: same roast level ─────────────────────────────────────────────
    roast_level = bag.get("RoastLevel")
    if roast_level:
        active_bags = inventory_repo.list()  # defaults to status="Active"
        all_shots = []
        for active_bag in active_bags:
            if active_bag.get("RoastLevel") == roast_level:
                all_shots.extend(brew_log_repo.list_for_bag(active_bag["Bag_ID"]))
        if all_shots:
            most_recent = max(all_shots, key=lambda s: s.get("Date", ""))
            return _extract_defaults(most_recent)

    # ── Level 4: no history ───────────────────────────────────────────────────
    return {}
