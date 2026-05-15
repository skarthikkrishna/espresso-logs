# Decision Drop: M4 CI Failure RCA
**From:** Tariq (Technical Program Manager)  
**For:** Alex (Backend Engineer)  
**Date:** 2026-05-14  
**PR:** #62 `feat/m4-prerequisites` — 3 of 13 CI checks failing

---

## Root Cause Summary

The branch made SQL repo methods async (correct) but **did not update Sheets repos or their consumers**. This creates:

1. **Format failures** (5 files) — ruff format violations, auto-fixable
2. **Typecheck failures** (19 errors) across 4 categories:
   - 4 errors: SQLAlchemy column types lack Python datetime methods (need casts)
   - 1 error: Type annotation collision in catalog repo (rename return type)
   - **14 errors: Awaiting non-async results** (Sheets repos still sync, SQL repos now async)
3. **Test failures** (16 tests) — Tests call async methods without `await` when DATABASE_URL is set in CI

---

## Fix Plan (4 Phases, in order)

### Phase 1: Type Annotations (4 files, 5 changes)
- `app/repos/sql/maintenance.py:59` — Cast `performed_at` to datetime
- `app/repos/sql/brew_log.py:114` — Cast `brewed_at` to datetime
- `app/repos/sql/inventory.py:40,96` — Cast/assert `roast_date` conversions
- `app/repos/sql/catalog.py:77` — Fix return type annotation collision

**Outcome:** Reduces mypy errors from 19 to 15.

### Phase 2: Make Sheets Repos Async (5 files)
All read methods must be `async` to match SQL repos:
- `CatalogRepo.list()`, `.get()`, `._fetch_all()`
- `InventoryRepo.list()`, `.list_all()`, `.get()`
- `HardwareRepo.list()`, `.list_all()`, `.get()`
- `MaintenanceRepo.list()`, `.get()`
- `BrewLogRepo.list()`, `.list_recent()`, `.list_for_bag()`, `.list_existing_ids()`, `.get()`

Update _DualWrite wrappers to always `await` both branches.

**Outcome:** Eliminates 14 mypy errors. Callers can now correctly use `await`.

### Phase 3: Update Test Stubs (6 files)
Add `await` to all assertions calling async methods:
- `tests/repos/sql/test_inventory.py` (6 tests)
- `tests/repos/sql/test_brew_log.py` (2 tests)
- `tests/repos/sql/test_catalog.py` (3 tests)
- `tests/repos/sql/test_hardware.py` (2 tests)
- `tests/repos/sql/test_maintenance.py` (2 tests)
- `tests/repos/sql/test_dual_write.py` (1 test)

**Outcome:** All 16 tests pass in CI when DATABASE_URL is set.

### Phase 4: Format (1 command)
```bash
uv run ruff format app/ tests/
```
Auto-corrects all 5 format violations in place.

**Outcome:** `CI/format` check passes.

---

## No Logic Changes Required

All fixes are structural:
- Phase 1: Type casts (runtime safe)
- Phase 2: Add `async`/`await` keywords (no behavior change)
- Phase 3: Add `await` to tests (mirrors production async behavior)
- Phase 4: Formatting only

---

## Process Note

**Inviolable Rule 3 (CI Discipline):** Build failures require root cause analysis. This failure occurred because `mypy --strict app/` was not run before push. Recommend adding pre-push check script and documenting in CONTRIBUTING.md.

---

## Verification

After all phases complete, verify:
```bash
uv run ruff format --check app/ tests/        # 0 failures
uv run mypy app/ --strict                     # 0 errors
uv run pytest tests/ --cov-fail-under=80      # 16 new tests pass, coverage ≥80%
```

Then PR is ready for review.
