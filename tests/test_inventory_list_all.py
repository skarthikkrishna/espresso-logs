"""Tests for InventoryRepo.list_all() TTL-caching behaviour.

Verifies the `inventory:all` cache key introduced in bug fix 015:
  - Two consecutive list_all() calls within the TTL hit the Sheets API only once.
  - upsert() invalidates the `inventory:all` key, forcing a fresh read.

Branch: bugfix/bg-images-500s
"""

from __future__ import annotations

from app.repos.base import TTLCache
from app.repos.inventory import InventoryRepo
from tests.doubles import FakeSheetsClient

# ---------------------------------------------------------------------------
# Minimal fake data
# ---------------------------------------------------------------------------

_BAG_ACTIVE = {
    "Bag_ID": "Ve20250201M",
    "Beans": "Verve-Seabright",
    "RoastDate": "2025-02-01",
    "RoastLevel": "Medium",
    "Display_Name": "Verve-Seabright — Feb 01 — Medium",
    "Catalog_ID": "CAT100",
    "Status": "Active",
    "Storage_Method": "Ambient — Bag",
}

_BAG_FINISHED = {
    "Bag_ID": "Ve20250101L",
    "Beans": "Verve-Old",
    "RoastDate": "2025-01-01",
    "RoastLevel": "Light",
    "Display_Name": "Verve-Old — Jan 01 — Light",
    "Catalog_ID": "",
    "Status": "Finished",
    "Storage_Method": "",
}


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_inventory_list_all_cached():
    """Calling list_all() twice within the TTL issues exactly one Sheets read.

    The second call must be served from the `inventory:all` cache entry without
    hitting get_all_records() again.
    """
    client = FakeSheetsClient(
        {"Inventory": [_BAG_ACTIVE.copy(), _BAG_FINISHED.copy()]}
    )
    cache = TTLCache(ttl=60.0)
    repo = InventoryRepo(client=client, cache=cache)

    rows_first = repo.list_all()   # cache miss → Sheets read #1
    rows_second = repo.list_all()  # cache hit  → no Sheets read

    assert len(rows_first) == 2
    assert len(rows_second) == 2
    # Only one get_all_records() call should have been issued
    assert client.call_counts.get("Inventory", 0) == 1


def test_inventory_list_all_cache_invalidated_on_upsert():
    """upsert() invalidates inventory:all so the next list_all() fetches fresh data.

    Call sequence:
      1. list_all()   → cache miss   → Sheets read #1
      2. upsert(row)  → _fetch_all() → Sheets read #2  + invalidates cache
      3. list_all()   → cache miss   → Sheets read #3

    The key assertion is that read #3 actually happens (count increases after
    the second list_all()), proving the cache was properly invalidated.
    """
    client = FakeSheetsClient({"Inventory": [_BAG_ACTIVE.copy()]})
    cache = TTLCache(ttl=60.0)
    repo = InventoryRepo(client=client, cache=cache)

    repo.list_all()  # primes the inventory:all cache (Sheets read #1)

    # upsert internally calls _fetch_all() (read #2) then invalidates the cache
    repo.upsert(_BAG_FINISHED.copy())

    count_after_upsert = client.call_counts.get("Inventory", 0)

    repo.list_all()  # cache was invalidated → must trigger Sheets read #3

    count_after_second_list_all = client.call_counts.get("Inventory", 0)

    # The second list_all() must have caused at least one additional Sheets read
    assert count_after_second_list_all > count_after_upsert
