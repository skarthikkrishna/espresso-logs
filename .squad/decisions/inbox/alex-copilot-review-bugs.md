# Decision Drop: Copilot PR Review Bug Fixes

**Date:** 2026-05-15  
**Agent:** Alex  
**Branch:** feat/m4-prerequisites  

## Decisions Made

### 1. `_parse_datetime` defined per-file (brew_log.py, maintenance.py)

**Decision:** Added `_parse_datetime` locally in each file rather than extracting to a shared `_util.py` module.

**Rationale:** Only two files need it at this time. Extracting to a shared util for two callers would be premature. If a third SQL repo needs date parsing, extract then.

### 2. `brewed_at` / `performed_at` set in ORM constructor from row["Date"]

**Decision:** Both `SqlBrewLogRepo.add()` and `SqlMaintenanceRepo.add()` now pass the parsed datetime to the ORM constructor. `server_default` remains on the column as a fallback for None (missing/invalid Date).

**Rationale:** `server_default` fires only when the column is fully omitted from the INSERT statement — it does NOT mean "use default if None". When `None` is passed explicitly, Postgres stores NULL. Since the column allows NULL and `list()`/`list_recent()` order by this column, silent insertion-time recording was causing wrong ordering and wrong Date output in `_to_dict()`.

### 3. `sheets_catalog_id` TEXT column pattern (mirrors sheets_hardware_id in maintenance)

**Decision:** Added `sheets_catalog_id: Mapped[str | None]` to `InventoryBag` model + migration 0006. This follows the same cross-reference pattern as `sheets_hardware_id` in maintenance_log.

**Rationale:** `catalog_id` FK (UUID) is only populated when a catalog record exists. Sheets `Catalog_ID` strings (e.g. "CAT001") need to survive upsert round-trips independently of FK resolution (which is M5 work). Storing the raw Sheets string as `sheets_catalog_id` lets filtering and display_name resolution work without joins.
