---
status: APPROVED_WITH_NOTES
reviewer: Quinn
date: 2026-05-16
scope: fix-postgres-backfill
bugs:
  - Bug 1 — Hardware view: no maintenance logs (sheets_hardware_id NULL backfill)
  - Bug 2 — Brew log shows internal IDs instead of bean names (sheets_catalog_id NULL backfill)
---

# Quinn Gate — Postgres Backfill Fix

## Verdict: APPROVED_WITH_NOTES

The proposed approach is architecturally sound and the idempotency model is correct.
Implementation may proceed with the notes below addressed. Notes are **mandatory**, not
advisory — Alex must satisfy every one before opening a PR.

---

## Root Cause Verification

### Bug 1 — Maintenance log empty on hardware view

Confirmed. `MaintenanceLog.sheets_hardware_id` was added by migration `0005` but no
backfill ran. Any row written before 0005 has `sheets_hardware_id = NULL`.
`SqlMaintenanceRepo.list(hardware_id=...)` filters:

```python
q = q.where(MaintenanceLog.sheets_hardware_id == hardware_id)
```

`NULL != "HW001"` in SQL → zero results returned. Diagnosis is correct.

### Bug 2 — Brew log shows bag IDs instead of bean names

Confirmed. `inventory_bags.sheets_catalog_id` was added by migration `0006` with no
backfill. Pre-existing rows have `sheets_catalog_id = NULL`. Name-resolution chain
`bag → sheets_catalog_id → catalog → Roaster/Bean_Name` falls back to the bag ID
string on NULL. Diagnosis is correct.

---

## Approach Assessment

### Strengths

- **Idempotency guard is correct.** `WHERE sheets_hardware_id IS NULL` /
  `WHERE sheets_catalog_id IS NULL` gates on null presence in Postgres. After the
  first successful run the guard query returns 0 rows and the Sheets read is skipped
  entirely — subsequent cold starts are cheap.
- **Sheets-as-source-of-truth is correct.** Sheets is the authoritative store; reading
  from it to populate Postgres fields is the right direction.
- **Scoped to broken rows only.** The guard prevents touching rows that are already
  correct, minimising blast radius.
- **`SqlInventoryRepo.upsert()` already handles the update path correctly** — it sets
  `existing.sheets_catalog_id = row.get("Catalog_ID")` in the update branch. No new
  SQL repo method is needed for Bug 2.

---

## Mandatory Implementation Notes

### NOTE-1 — `SqlMaintenanceRepo` lacks `upsert()` — insert-only `add()` will crash

**Critical.** `SqlMaintenanceRepo.add()` is unconditional:

```python
self._db.add(event)
await self._db.commit()
```

`maintenance_log.sheets_id` has `unique=True`. Calling `add()` on a row whose
`sheets_id` already exists raises `IntegrityError` / `asyncpg.UniqueViolationError`
and rolls back the entire backfill session.

**Alex must add `upsert()` to `SqlMaintenanceRepo` before calling it from the lifespan.**
The method must:

1. `SELECT` by `sheets_id`
2. If row exists and `sheets_hardware_id IS NULL` → `UPDATE sheets_hardware_id` only
3. If row exists and `sheets_hardware_id` is already set → skip (no-op; already correct)
4. If row does not exist → `INSERT` (handles the silent-write-failure case where the row
   never made it to Postgres at all)

Do **not** overwrite `performed_at`, `action`, or `notes` for already-existing rows —
scope the update strictly to `sheets_hardware_id`.

### NOTE-2 — Lifespan needs its own DB session; `Depends(get_db)` is not available there

The current lifespan function has no Postgres access. The backfill must open a session
directly via `get_session_factory()`:

```python
from app.models.base import get_session_factory

async with get_session_factory()() as db:
    # run backfill queries here
```

Do **not** call `get_db()` — that is a FastAPI dependency generator and cannot be
called outside a request context.

### NOTE-3 — Guard on `settings.use_postgres`; skip entirely when False

`USE_POSTGRES=False` is the default. When False, `get_session_factory()` will raise
`RuntimeError: DATABASE_URL is not set`. The entire backfill block must be gated:

```python
if not settings.use_postgres:
    return  # or: skip and yield immediately
```

This guard belongs at the very top of the backfill logic, before any DB interaction.

### NOTE-4 — Backfill exceptions must not crash startup

If the Sheets API is unavailable, if Postgres is unreachable, or if any individual row
fails, the exception must be caught, logged at `WARNING` level, and the app must
continue to start. A failed backfill is a data-quality degradation, not a fatal event.

Pattern:

```python
try:
    await _backfill_maintenance(db, sheets_client)
    await _backfill_inventory(db, sheets_client)
except Exception as exc:
    logger.warning("Startup backfill failed — will retry on next cold start: %s", exc)
```

### NOTE-5 — Inventory `upsert()` does a per-row SELECT; document expected latency

`SqlInventoryRepo.upsert()` executes `SELECT ... WHERE sheets_id = ?` + `commit()` per
row. For a typical inventory of 10–50 bags this is acceptable. Alex should log the row
count at `INFO` level so cold-start timing is visible in Cloud Logging:

```
Backfill: found N inventory bags with sheets_catalog_id=NULL, starting upsert
```

Same for maintenance rows.

### NOTE-6 — Inventory backfill must use `InventoryRepo.list(status=None)` not `.list()`

`InventoryRepo.list()` defaults `status="Active"`, which excludes depleted/archived bags.
The backfill must process **all** bags — pass `status=None` to get every row:

```python
all_bags = sheets_inventory_repo.list(status=None)
```

Without this, depleted bags that appear in old brew log entries remain with
`sheets_catalog_id=NULL` and the name-resolution bug persists for historical brew logs.

### NOTE-7 — Maintenance backfill must use `MaintenanceRepo.list()` (no filter)

Call `maintenance_repo.list()` with no `hardware_id` argument to retrieve all rows from
Sheets. The backfill must touch every pre-0005 row regardless of hardware.

---

## Required Test Coverage

Alex must deliver **all** of the following tests. Tests live in `tests/` — no new test
file locations outside the existing structure.

### Backfill unit tests (new file: `tests/test_startup_backfill.py`)

| Test ID | Description |
|---------|-------------|
| T-BF-01 | `use_postgres=False` → backfill function returns immediately; no Sheets read, no DB query |
| T-BF-02 | Maintenance: zero NULL rows in DB → Sheets read skipped; no upsert called |
| T-BF-03 | Inventory: zero NULL rows in DB → Sheets read skipped; no upsert called |
| T-BF-04 | Maintenance: N NULL rows → upsert called N times; after backfill those rows have `sheets_hardware_id` set |
| T-BF-05 | Inventory: N NULL rows → upsert called N times; after backfill those rows have `sheets_catalog_id` set |
| T-BF-06 | Maintenance: row already has `sheets_hardware_id` set → that row is NOT updated (no-op branch) |
| T-BF-07 | Inventory: row already has `sheets_catalog_id` set → that row is NOT updated |
| T-BF-08 | Sheets API raises exception → exception is caught; warning is logged; app does not re-raise |
| T-BF-09 | Postgres raises exception mid-backfill → exception is caught; warning is logged; app does not re-raise |

### `SqlMaintenanceRepo.upsert()` unit tests (add to existing `tests/repos/` coverage)

| Test ID | Description |
|---------|-------------|
| T-MR-01 | `upsert()` on new `sheets_id` → row inserted with correct `sheets_hardware_id` |
| T-MR-02 | `upsert()` on existing row with NULL `sheets_hardware_id` → only `sheets_hardware_id` updated; other fields unchanged |
| T-MR-03 | `upsert()` on existing row with non-NULL `sheets_hardware_id` → row is unchanged (no-op) |

### Test quality requirements (Quinn checklist)

- All backfill test fixtures must use `scope="function"` — no shared mutable state
- `FakeSheetsClient` instances must not be reused across tests
- Every `assert x is not None` must be followed by a content assertion
- Mock DB sessions must use `AsyncMock` for async methods; `MagicMock` for sync
- T-BF-08/T-BF-09: assert that the warning was logged (capture via `caplog`) AND that
  the backfill function returns normally without raising

---

## Risks and Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| `add()` raises `IntegrityError` on duplicate `sheets_id` | HIGH | Addressed by NOTE-1 (add `upsert()` to `SqlMaintenanceRepo`) |
| Backfill crashes startup (Sheets/DB unavailable) | HIGH | Addressed by NOTE-4 (catch + log) |
| Depleted bags never backfilled | MEDIUM | Addressed by NOTE-6 (`status=None`) |
| Cold-start latency on first deploy | LOW | Acceptable one-time cost; guard makes subsequent starts cheap |
| `USE_POSTGRES=False` raises `RuntimeError` from `get_session_factory()` | HIGH | Addressed by NOTE-3 (guard at top) |
| Partial backfill leaves some rows still NULL | LOW | Idempotent; next cold start retries remaining NULLs automatically |

---

## Out of Scope

- The inventory `upsert()` sets `notes = row.get("Notes") or row.get("Beans")` —
  this pre-existing fallback is odd but unchanged by this fix. Do not fix in this PR.
- No changes to migrations — the columns already exist; only data is missing.
- No changes to the dual-write wrappers — they are correct.

---

## Checklist for PR Submission

- [ ] NOTE-1: `SqlMaintenanceRepo.upsert()` added with SELECT-then-UPDATE-or-INSERT logic
- [ ] NOTE-2: lifespan uses `get_session_factory()` directly, not `Depends(get_db)`
- [ ] NOTE-3: entire backfill gated on `settings.use_postgres`
- [ ] NOTE-4: all exceptions caught, logged as WARNING, app continues
- [ ] NOTE-5: row counts logged at INFO before each backfill pass
- [ ] NOTE-6: inventory backfill uses `list(status=None)`
- [ ] NOTE-7: maintenance backfill uses `list()` with no hardware_id filter
- [ ] All type annotations present on new public functions/methods
- [ ] Module-level docstring on any new module
- [ ] Tests T-BF-01 through T-BF-09 implemented
- [ ] Tests T-MR-01 through T-MR-03 implemented
- [ ] All four local CI checks pass: `ruff check`, `ruff format --check`, `mypy --strict`, `pytest`
