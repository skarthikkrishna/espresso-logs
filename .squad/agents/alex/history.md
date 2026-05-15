# Project Context

- **Owner:** Karthik
- **Project:** Espresso Logs — open-source coffee tracking app (FastAPI + React)
- **Stack:** Python 3.12, FastAPI, Google Sheets (gspread), PostgreSQL (dual-write M2+), React 18, TypeScript, Vite, TailwindCSS + DaisyUI
- **Created:** 2026-05-13

## Learnings

### 2026-05-13: E2E_AUTH_BYPASS production guard

**What:** `app/deps.py` had `E2E_AUTH_BYPASS=1` as a test-only auth bypass with only a comment as safeguard. A Copilot PR review (line 53) flagged this as a misconfiguration risk.

**Fix:** Added a startup-time `RuntimeError` at module load in `app/deps.py` if `E2E_AUTH_BYPASS=1` and `APP_ENV=production`. Uses `os.environ.get("APP_ENV")` directly (not `settings.app_env`) because `settings` is not yet initialised at module-load time and would create a circular import. Also added a `logger.warning` in `app/main.py` whenever the bypass is active, so it's visible in Cloud Logging even in non-production environments.

**Why `os.environ` not `settings`:** `settings` is imported via local imports in `deps.py` to avoid circular dependencies. The production guard runs at module load (before the app starts), so `settings` cannot be safely referenced at that point. The `APP_ENV` env var is always set directly (never injected via `APP_SECRETS` blob) — it's an infra concern, not a secret.

**Tests:** 372 passed, 4 skipped. Lint: 0 issues.

### 2026-05-13: PR review Thread 5/6/7 fixes

**Thread 5 — E2E_SEED schema fix (`app/testing/fake_sheets.py`):**
`E2E_SEED` had Inventory keys `Roast_Date`/`Roast_Level` (underscored) but `InventoryRepo.COLUMNS` uses `RoastDate`/`RoastLevel`. Also missing `Display_Name`, contained unknown `Date_Finished`. BrewLog tab key was `BrewLog` not `Brew_Log`, PK was `Log_ID` not `Shot_ID`, field names `Dose_g`/`Yield_g`/`Time_s` not matching repo COLUMNS. Fixed all mismatches by aligning directly with `InventoryRepo.COLUMNS` and `BrewLogRepo.COLUMNS`/`_TAB`.

**Thread 6 — E2E_AUTH_BYPASS too broad (`app/deps.py`):**
Guard only blocked `APP_ENV=production`; staging/preview deployments could still run with bypass active. Changed to allowlist: only `APP_ENV=test` or `APP_ENV=local` permit `E2E_AUTH_BYPASS=1`. Any other value (including unset) raises `RuntimeError` at startup. Added clear comment explaining permitted environments.

**Thread 7 — Private `_fetch_all` in `api_e2e.py` (`app/repos/base.py`, `app/deps.py`, `app/routers/api_e2e.py`):**
`_delete_by_id` reached into `BaseRepo._fetch_all` — a private method. Added public `delete_by_pk(pk_col, pk_val)` to `BaseRepo` (concrete method) containing the find-and-delete logic. Delegated from `_DualWriteCatalogRepo` and `_DualWriteInventoryRepo` to their `_sheets` repos. Removed `_delete_by_id` helper in `api_e2e.py`; cleanup endpoint calls `repo.delete_by_pk()` directly. Used `_RepoPkDelete` Protocol for structural typing without exposing private wrapper classes.

**Tests:** 372 passed, 4 skipped. Lint: 0 issues.

### 2026-05-14: M4 Prerequisites — P1 ORM + SQL Repo Rewrites + P2 Async Read Path

**What:** Implemented all M4 prerequisites on branch `feat/m4-prerequisites`:
- P1: Updated all 5 ORM models (brew_log, catalog, inventory, hardware, maintenance) with sheets_id columns and v2 fields matching migration 0004. Created migration 0005 for `sheets_hardware_id` on maintenance_log (needed because `hardware_id` FK is UUID while routers pass Sheets string IDs).
- P1: Rewrote all 5 SQL repos with upsert-by-sheets_id pattern and full v2 column writes.
- P2: Added async read methods to all 5 SQL repos.
- P2: Converted all 5 DualWrite wrapper read methods to `async def` with `use_postgres` check.
- P2: Awaited all repo read calls in api_catalog, api_brew_log, api_hardware, api_inventory, api_maintenance, api_dashboard, defaults.py, inference.py.
- Tests: 27 new SQL repo read path tests; updated test_defaults.py and test_inference.py to use DualWrite wrappers (use_postgres=False) so async await works correctly in unit tests.

**Key decisions:**
- `sheets_hardware_id TEXT` added to maintenance_log because the FK `hardware_id` stores UUIDs but the list() filter needs to match Sheets string IDs (e.g. "HW001"). Migration 0005 covers this.
- DualWrite `async def` read methods delegate to sync Sheets repos when `use_postgres=False` — no I/O, so no event loop issues.
- `update_feedback` in brew_log SQL repo stays sync (matching Sheets repo + DualWrite signature) with `# TODO(M4-async)` comment.
- Unit tests for defaults.py and inference.py now wrap raw Sheets repos in DualWrite wrappers with `sql=None` and patch `settings.use_postgres=False` — avoids needing to make Sheets repos async while preserving full test coverage.

**Test result:** 399 passed, 4 skipped. Lint: 0 issues. Branch not pushed — awaiting Karthik review.

### 2026-05-14: M4 Quinn re-gate notes addressed

**What:** Fixed two Quinn APPROVED_WITH_NOTES items on `feat/m4-prerequisites`:
1. `SqlBrewLogRepo.update_feedback` — removed `asyncio.get_event_loop().run_until_complete()` antipattern; converted to proper `async def` with `await self._db.execute(...)` / `await self._db.commit()`.
2. Added regression test `test_hardware_next_id_still_uses_sheets_when_use_postgres_true` confirming `next_id()` always unconditionally delegates to Sheets.

**Learnings:**
- M4 switchover pattern: `from app.config import settings` imported at module level in `deps.py`; all 5 DualWrite read methods gate on `settings.use_postgres and self._sql is not None`
- All 5 DualWrite wrappers: reads are conditional on `settings.use_postgres and self._sql is not None`
- `settings_use_postgres` pytest fixture created in `tests/repos/conftest.py` — patches `app.deps.settings` with `use_postgres=True`

**Test result:** 400 passed, 4 skipped. Lint: 0 issues.
