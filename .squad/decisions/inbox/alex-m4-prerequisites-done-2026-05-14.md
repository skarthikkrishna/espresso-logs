# Decision Drop: M4 Prerequisites Complete

**Agent:** Alex  
**Date:** 2026-05-14  
**Branch:** `feat/m4-prerequisites`  
**Status:** Implementation complete — awaiting Karthik review before push

## What Was Done

All M4 prerequisite tasks (P1 + P2) are implemented and all tests pass (399 passed, 4 skipped).

### P1 — ORM Models + SQL Repo Write Methods

- All 5 ORM models updated with `sheets_id` and v2 columns matching migration 0004.
- Migration 0005 created: adds `sheets_hardware_id TEXT` to `maintenance_log` (needed because `hardware_id` FK stores UUIDs while routers pass Sheets string IDs for filtering).
- All 5 SQL repos rewritten with upsert-by-sheets_id pattern and complete v2 column writes.

### P2 — Async Read Path

- All 5 SQL repos have async `list()`, `get()`, and entity-specific read methods.
- All 5 DualWrite wrappers in `deps.py` have `async def` read methods with `settings.use_postgres` check.
- All router files (`api_catalog`, `api_brew_log`, `api_hardware`, `api_inventory`, `api_maintenance`, `api_dashboard`) and services (`defaults.py`, `inference.py`) now `await` all repo read calls.

### Tests

- 27 new tests in `tests/repos/test_sql_repos_read.py` covering use_postgres=True, False, and sql=None fallback.
- `tests/test_defaults.py` and `tests/test_inference.py` updated to use DualWrite wrappers with `sql=None` + `use_postgres=False` fixture so async `await` works correctly in unit tests without requiring Sheets repos to be async.

## Key Technical Decisions

1. **`sheets_hardware_id` cross-reference column**: The `list()` filter for maintenance must match Sheets string IDs. Since `hardware_id` FK is a UUID, a new `sheets_hardware_id TEXT` column stores the raw Sheets string (e.g. "HW001"). Migration 0005 covers this.

2. **`update_feedback` stays sync**: Kept sync to match existing DualWrite + Sheets repo contract. Marked `# TODO(M4-async)` for the full async migration.

3. **DualWrite wrappers delegate sync read calls**: When `use_postgres=False`, async DualWrite methods call sync Sheets methods directly — safe because there's no I/O on the event loop in the test context.

4. **Unit test compatibility pattern**: Tests that previously passed raw Sheets repos to async services now wrap them in `_DualWrite*` with `sql=None` and patch `settings.use_postgres=False`. Preserves test fidelity without making Sheets repos async.

## Commits on `feat/m4-prerequisites`

1. `feat: update ORM models with migration-0004 columns (P1)`
2. `feat: fix SQL repo write methods and implement async reads (P1+P2)`
3. `feat: convert DualWrite read methods to async with use_postgres check (P2)`
4. `feat: await read calls in all routers (P2)` — includes defaults.py, inference.py, all test fixes
