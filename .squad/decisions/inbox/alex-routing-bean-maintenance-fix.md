# Routing Decision — Bean Name Display + Maintenance Log Bugs

**Agent:** Alex (Backend Engineer)  
**Date:** 2026-05-17  
**Status:** DIRECT_PERMITTED  
**Requested by:** Karthik Krishna Subramanian  

---

## Decision

`status: DIRECT_PERMITTED`

Both bugs are caused by the same structural flaw: the Postgres migration stored UUID FK references, but the SQL repo layer uses Sheets string IDs for cross-table lookups. The `sheets_*` TEXT bridge columns (`sheets_catalog_id`, `sheets_hardware_id`) were added in migrations 0005/0006 but were **never backfilled** from the FK relationships.

This is a bounded SQL repo fix — no new entities, no schema changes, no router or frontend changes.

---

## Root Cause Diagnosis

### Bug 1: Brew log shows `bag-uuid` instead of bean name

**Lookup chain in `api_brew_log.py`:**
1. `_build_lookups()` → `inventory_repo.list_all()` → builds `bags` dict keyed by `Bag_ID` = `InventoryBag.sheets_id` ✅
2. `_resolve_names_from_dicts()` → `bag_row = bags.get(brew_log["Bag_ID"])` — this lookup works ✅
3. `catalog_row = catalog.get(bag_row.get("Catalog_ID", ""))` — **this lookup fails** ❌

**Why it fails:**  
`SqlInventoryRepo._to_dict()` returns `"Catalog_ID": row.sheets_catalog_id or ""`.  
`InventoryBag.sheets_catalog_id` is **NULL** for all migrated records — migration `0006` added the column but the migration script (`_mapping.py: from_sheets_dict_inventory`) only stored `catalog_id` (Postgres UUID FK), never `sheets_catalog_id`.  
So `catalog.get("", {})` returns `{}`, `roaster + bean_name = ""`, fallback fires → displays `bag_id`.

**Confirmed in `_mapping.py: from_sheets_dict_inventory`:**
```python
return {
    "sheets_id": sheets_id,
    "catalog_id": catalog_id,   # ← UUID FK populated ✅
    # "sheets_catalog_id": ...  # ← MISSING — never written ❌
    ...
}
```

### Bug 2: Maintenance logs not showing in hardware detail view

**Lookup in `api_hardware.py`:**
```python
events = await maintenance_repo.list(hardware_id=hardware_id)  # hardware_id = "M01" (Sheets ID)
```

**`SqlMaintenanceRepo.list(hardware_id=...)`:**
```python
q = q.where(MaintenanceLog.sheets_hardware_id == hardware_id)
```

`MaintenanceLog.sheets_hardware_id` is **NULL** for all migrated records — migration `0005` added the column but the migration script (`from_sheets_dict_maintenance`) only stored `hardware_id` (Postgres UUID FK), never `sheets_hardware_id`.  
So `WHERE sheets_hardware_id = 'M01'` returns 0 rows → empty maintenance list.

**Confirmed in `_mapping.py: from_sheets_dict_maintenance`:**
```python
return {
    "sheets_id": sheets_id,
    "hardware_id": hardware_id,   # ← UUID FK populated ✅
    # "sheets_hardware_id": ...   # ← MISSING — never written ❌
    ...
}
```

---

## Fix Scope

### Files that will change

| File | Change |
|------|--------|
| `app/repos/sql/inventory.py` | `list()` and `list_all()` — JOIN to `catalog` table via `catalog_id` FK; populate `Catalog_ID` in `_to_dict()` as `catalog.sheets_id` |
| `app/repos/sql/maintenance.py` | `list(hardware_id=...)` — when `hardware_id` is a Sheets string, JOIN to `hardware` table via UUID FK to filter by `hardware.sheets_id` |
| `tests/` | New test coverage for both repo JOIN paths |

### Files that will NOT change
- `app/routers/api_brew_log.py` — logic is correct; fixes land in repo layer only
- `app/routers/api_hardware.py` — same; no change needed
- `app/models/` — no ORM model changes
- `alembic/versions/` — no new migrations needed (JOIN approach avoids needing backfill)
- Frontend — no changes; field names and API contract unchanged

---

## Why DIRECT_PERMITTED

- No new entities, tables, or API fields
- No spec ambiguity — functional spec clearly requires resolved names; this is a regression from the migration
- Fix is entirely within the SQL repo layer
- Both bugs share the same fix pattern (JOIN over FK instead of filtering by unpopulated TEXT column)
- Low blast radius — only `SqlInventoryRepo` and `SqlMaintenanceRepo` change
- Existing tests can be extended to cover the JOIN paths without new infrastructure
