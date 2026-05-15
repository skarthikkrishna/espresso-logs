# Quinn Gate — M4 Read Switchover

**Status:** BLOCKED
**Date:** 2026-05-14
**Reviewer:** Quinn

## Summary

Reviewed the proposed M4 implementation scope: flipping the 5 `_DualWrite*` repo wrappers in `app/deps.py` to read from `self._sql` when `settings.use_postgres=True`. Found critical blocking issues — the SQL repos are intentional write-only stubs with no real read implementations, and the underlying schema is missing primary-key columns required for `get()` lookups. Switching reads to Postgres today would return empty lists and `None` across the entire app.

## Risk Assessment

**Risk: CRITICAL (blocks implementation)**

The SQL repos across all 5 entities (`catalog`, `brew_log`, `inventory`, `hardware`, `maintenance`) are write-only stubs. Every read method returns `[]` or `None` by design, with in-code `FIXME(M4)` markers calling out the exact prerequisite work:

| Entity | `list()` | `get()` | Domain `list_*()` | Schema blocker |
|--------|----------|---------|-------------------|----------------|
| Catalog | returns `[]` | returns `None` | — | `notes` column stores `Catalog_ID` (not tasting notes); no `sheets_catalog_id` column |
| BrewLog | returns `[]` | returns `None` | `list_recent`, `list_for_bag`, `list_existing_ids` all return `[]` | No `sheets_shot_id` column — `get(shot_id)` can never work |
| Inventory | returns `[]` | returns `None` | `list_all` returns `[]` | No `sheets_bag_id` column — `get(bag_id)` can never work |
| Hardware | returns `[]` | returns `None` | — | None beyond empty stubs |
| Maintenance | returns `[]` | returns `None` | — | None beyond empty stubs |

Specific FIXME references in the SQL repos:
- `app/repos/sql/brew_log.py` lines 42–44: `FIXME(M4): Shot_ID not stored — add sheets_shot_id TEXT column + backfill migration`
- `app/repos/sql/inventory.py` lines 38–40: `FIXME(M4): Bag_ID not stored — add sheets_bag_id TEXT column + backfill migration`
- `app/repos/sql/catalog.py` lines 31–35: `FIXME(M4): notes column stores Catalog_ID — remap before enabling reads`

**Additional gap — `_fetch_all` in `_DualWriteCatalogRepo`:**
`_fetch_all()` at line 124 of `deps.py` delegates to `self._sheets._fetch_all()`. This method is called directly by `api_catalog.py` for cache-busting reads. `SqlCatalogRepo` has no `_fetch_all()` method. Switching this without adding the method to the SQL repo would cause an `AttributeError` in production.

**`_DualWriteHardwareRepo.next_id()`:**
While not a read, `next_id()` is an ID-generation method that still delegates to `self._sheets.next_id()`. `SqlHardwareRepo.next_id()` returns `""`. If this is not explicitly left on Sheets (as it should be — ID generation is Sheets-specific), new hardware writes would silently receive empty IDs. The implementation scope must explicitly document that `next_id()` is NOT switched.

## Required Test Coverage

These tests MUST exist and pass before this can be merged. They do not exist today.

### 1. `use_postgres=True` path — SQL repo is called for reads

For all 5 wrappers, with `use_postgres=True` and a real (or mock) SQL repo that returns data:

- `test_catalog_list_reads_from_sql_when_use_postgres_true` — assert `sql_mock.list()` called, `sheets_mock.list()` not called, returned data matches SQL output
- `test_catalog_get_reads_from_sql_when_use_postgres_true` — same pattern for `get(catalog_id)`
- `test_catalog_fetch_all_reads_from_sql_when_use_postgres_true` — `_fetch_all()` delegates to SQL, not Sheets
- `test_brew_log_list_reads_from_sql_when_use_postgres_true`
- `test_brew_log_list_recent_reads_from_sql_when_use_postgres_true`
- `test_brew_log_list_for_bag_reads_from_sql_when_use_postgres_true`
- `test_brew_log_list_existing_ids_reads_from_sql_when_use_postgres_true`
- `test_brew_log_get_reads_from_sql_when_use_postgres_true`
- `test_inventory_list_reads_from_sql_when_use_postgres_true`
- `test_inventory_list_all_reads_from_sql_when_use_postgres_true`
- `test_inventory_get_reads_from_sql_when_use_postgres_true`
- `test_hardware_list_reads_from_sql_when_use_postgres_true`
- `test_hardware_get_reads_from_sql_when_use_postgres_true`
- `test_hardware_next_id_still_uses_sheets_when_use_postgres_true` — next_id must NEVER switch to SQL
- `test_maintenance_list_reads_from_sql_when_use_postgres_true`
- `test_maintenance_get_reads_from_sql_when_use_postgres_true`

### 2. `use_postgres=False` path — Sheets repo is called for reads (regression guard)

- `test_catalog_list_reads_from_sheets_when_use_postgres_false` — existing `test_read_methods_delegate_to_sheets_only` covers `list()` for Catalog; extend to all 5 wrappers and all read methods
- All 5 wrappers × all read methods: assert `sheets_mock.*` called, `sql_mock.*` not called

### 3. `use_postgres=True` but `self._sql is None` (guard against misconfiguration)

- `test_catalog_list_falls_back_to_sheets_when_sql_is_none_and_use_postgres_true` — if `_sql=None` and `use_postgres=True`, the wrapper must NOT crash; must fall back to Sheets. This edge case must be tested for all 5 wrappers.

### 4. Assertion quality requirements (per Quinn charter)

- All "reads from SQL" tests: assert exact equality on the returned value (`== [expected]`), not just `is not None`
- All `assert_called_once()` calls on mocks that take arguments: use `assert_called_once_with(...)` with the exact arguments
- Fixture isolation: every test creates its own `MagicMock()` instance — no shared mutable fixtures across tests

## Implementation Notes

**Alex must resolve these prerequisites BEFORE writing the deps.py switchover:**

### Prerequisite P1 — Schema migrations (blocking)
1. Add `sheets_shot_id TEXT` column to `BrewLog` ORM model + Alembic migration
2. Add `sheets_bag_id TEXT` column to `InventoryBag` ORM model + Alembic migration
3. Fix `SqlCatalogRepo.upsert()`: add `sheets_catalog_id` column (or rename `notes`) so tasting notes are not clobbered by the ID string

### Prerequisite P2 — SQL repo read implementations (blocking)
All 5 SQL repos must implement real read methods that query the DB before M4 deps.py changes are written. Specifically:
- `SqlCatalogRepo`: implement `list()` and `get(catalog_id)` using `SELECT` queries + `_fetch_all()` method
- `SqlBrewLogRepo`: implement `list()`, `list_recent()`, `list_for_bag()`, `list_existing_ids()`, `get()` using `sheets_shot_id` for lookups
- `SqlInventoryRepo`: implement `list()`, `list_all()`, `get()` using `sheets_bag_id` for lookups
- `SqlHardwareRepo`: implement `list()`, `get()`
- `SqlMaintenanceRepo`: implement `list()`, `get()`

### Prerequisite P3 — Data backfill (blocking for production)
Postgres must contain a full copy of Sheets data before the `USE_POSTGRES=true` flag is set in production. Alex must coordinate with the operator on the backfill strategy (manual or scripted from existing dual-write history).

### deps.py implementation guidance (once P1–P3 are satisfied)

- The `settings` import in deps.py is currently a local import (to avoid circular deps). The read switchover must access `settings.use_postgres` without introducing a module-level import cycle. Recommended: import `settings` locally within each read method, or pass `use_postgres` as a constructor argument at repo creation time (preferred — avoids repeated import overhead per call).
- `_DualWriteHardwareRepo.next_id()` must NOT be switched — leave it on `self._sheets` unconditionally, even when `use_postgres=True`.
- `update_feedback()` in `_DualWriteBrewLogRepo`: the SQL stub has its own FIXME for M4. If this write is not implemented in SQL before M4 goes live, AI feedback written to Sheets will not be reflected in Postgres reads. Alex must decide: implement SQL `update_feedback` atomically with M4, or accept temporary divergence.

### Docstring update
After switching reads, update the class docstrings on all 5 wrappers to remove "reads from Sheets" and replace with the conditional behaviour.

## Verdict

**BLOCKED.** Implementation of the deps.py read switchover cannot proceed until:

1. ✅ P1: Alembic migrations add `sheets_shot_id` (BrewLog) and `sheets_bag_id` (Inventory) columns; `SqlCatalogRepo` schema fix for `notes`/`Catalog_ID` conflict
2. ✅ P2: All 5 SQL repos implement real, non-stub read methods that query the database
3. ✅ P3: Backfill plan confirmed by operator before `USE_POSTGRES=true` is set in production
4. ✅ All required test cases listed above exist and pass (both `use_postgres=True` and `use_postgres=False` read paths, plus the `_sql=None` guard)

Once P1–P3 are complete and test coverage meets the checklist above, re-submit for gate review. Expected re-review scope: SQL repo read implementations + migrations + updated deps.py switchover logic.
