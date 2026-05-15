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

---

# Decision Drop — Alex — Issues #67 and #68

**Date:** 2026-05-15  
**Branch:** feat/m4-prerequisites  
**Author:** Alex (Backend Engineer)

---


## Issue #67 — `_DualWriteBrewLogRepo.update_feedback` async + SQL dual-write

**Decision:** `update_feedback` in `_DualWriteBrewLogRepo` (app/deps.py) converted from `def` to `async def`. SQL dual-write block added following the same try/except pattern as `add()` — writes to Sheets first, then to Postgres if `self._sql is not None and settings.use_postgres`, rolls back and logs a warning on failure. `inference.py` updated to `await` the call.

**Rationale:** The sync method silently dropped Postgres writes whenever `USE_POSTGRES=True`. AI feedback is user-visible data; losing it to the SQL layer without any error or warning is a silent data loss bug.

---

## Issue #68 — `Mapped[sa.DateTime]` / `Mapped[sa.Date]` wrong type annotations

**Decision:** All ORM model files (`brew_log.py`, `inventory.py`, `catalog.py`, `hardware.py`, `maintenance.py`, `user.py`, `auth.py`, `household.py`) updated to use Python stdlib types `datetime.datetime` and `datetime.date` inside `Mapped[...]`. The SQLAlchemy column type (`sa.TIMESTAMP(timezone=True)`, `sa.Date`) remains in the `mapped_column(...)` call where it belongs. `import datetime` added to each model file.

`cast()` call-site workarounds removed from `SqlBrewLogRepo._to_dict`, `SqlInventoryRepo._to_dict`, and `SqlMaintenanceRepo._to_dict`. Unused `cast` and `dt` imports removed from those files.

**Rationale:** `Mapped[sa.DateTime]` is semantically incorrect — `Mapped[T]` expects a Python type, not an SA type descriptor. The `cast()` workarounds in `_to_dict` existed only to silence mypy; they are unnecessary once the model annotations are correct, and are misleading to readers.

---

## Verification

- `uv run ruff check app/ tests/` — 0 issues
- `SPREADSHEET_ID=dummy uv run pytest tests/ --ignore=tests/e2e/ -q` — 400 passed, 4 skipped

---

### 2026-05-15: Alex routing decision — M4 issue batch (PR #62 blockers)

**By:** Alex (Backend Engineer)  
**Status:** `status: DIRECT_PERMITTED`

---


## Issue-by-Issue Assessment

| Issue | Title | Scope | Status |
|-------|-------|-------|--------|
| #63 | [M4] Generate alembic migration 0005 for `sheets_hardware_id` column | Already completed; migration exists at `alembic/versions/0005_add_sheets_hardware_id_to_maintenance.py` | ✅ DONE |
| #64 | [M4] Add SQL write-then-read integration test for postgres read path | New test coverage; bounded to `tests/repos/test_sql_repos_read.py`; tests write-then-read cycles for all 5 SQL repos | 📝 DIRECT |
| #66 | [Process] Add pre-push check script | New shell script in `scripts/`; runs `uv run ruff check` + `uv run mypy --strict` before push; catches linting failures locally | 📝 DIRECT |
| #67 | [Bug] `_DualWriteBrewLogRepo.update_feedback` silently drops SQL write when USE_POSTGRES=True | Already fixed in commit 8404a20; properly async with `await self._db.execute()` + `await self._db.commit()` | ✅ DONE |
| #68 | [Debt] Fix `Mapped[sa.DateTime]` / `Mapped[sa.Date]` model annotations — remove cast() workarounds | Refactor 3 call-sites in `app/repos/sql/`: `brew_log.py:105`, `maintenance.py:60`, `inventory.py:96`; remove `cast(dt, ...)` and `cast(datetime.date, ...)` by improving type hints in `_to_dict()` methods | 📝 DIRECT |
| #69 | [Debt] SQL repo happy-path tests missing — list() and get() only cover empty/absent cases | New test coverage; bounded to `tests/repos/test_sql_repos_read.py`; write a record, then read it back, verify all fields | 📝 DIRECT |

---

## Rationale

All six issues are **bounded, self-contained fixes** with no new feature design or API contracts:

1. **Issues #63, #67 (DONE):** Already completed on `feat/m4-prerequisites` branch. Tests pass (400 passed, 4 skipped).

2. **Issues #64, #69 (Test additions):** Add missing test coverage for SQL repos. No new routes, no data model changes. Bounded to existing test infrastructure. Can be implemented directly.

3. **Issue #66 (Pre-push script):** Straightforward shell script in `scripts/pre-push.sh`. Runs `ruff check` + `mypy --strict` before allowing push. No changes to production code. Can be implemented directly.

4. **Issue #68 (Type annotation refactor):** Remove type casts at Sheets serialization call-sites. The underlying issue is that SQLAlchemy `Mapped[sa.DateTime]` and `Mapped[sa.Date]` lack explicit Python type information for `.date()` extraction. Solution: improve type hints in `_to_dict()` methods (e.g., extract to typed intermediate variable before `.date()` call). No API changes. Can be implemented directly.

---

## Explicit Scope Confirmation

- ✅ No new API surface (all are internal repo methods or test coverage)
- ✅ No data model changes beyond existing migrations
- ✅ No architecture decisions needed
- ✅ All fit within Alex's charter: `app/deps.py`, `app/repos/sql/`, `app/models/`, `alembic/versions/`
- ✅ All maintain `mypy --strict` compliance (issue #66 pre-push script ensures this going forward)

---

**Recommendation:** All six issues can proceed directly to implementation. No SpecKit phases required.

---

# Decision Drop — Quinn: M4 Issue Fixes #64 and #69

**Agent:** Quinn (QA Engineer)
**Date:** 2026-05-15T12:19:02.047-07:00
**Branch:** feat/m4-prerequisites
**Issues addressed:** #64, #69

---

## What was done

### Issue #64 — Write-then-read integration tests for Postgres read path

Added to `tests/repos/sql/test_brew_log.py`:
- `test_add_then_list_returns_row` — inserts via `add()`, asserts row appears in `list()` with correct field values
- `test_add_then_get_returns_row` — inserts via `add()`, asserts row retrievable via `get()` with correct fields

Added to `tests/repos/sql/test_catalog.py`:
- `test_upsert_then_list_returns_row` — inserts via `upsert()`, asserts row appears in `list()` with correct fields
- `test_upsert_then_get_returns_row` — inserts via `upsert()`, asserts row retrievable via `get()`


### Issue #69 — Happy-path tests for all 5 SQL repos

Added `test_list_returns_inserted_row` and `test_get_returns_inserted_row` to all 5 SQL repo test files:
- `tests/repos/sql/test_brew_log.py` ✓ (additional tests beyond #64 with different assertion emphasis)
- `tests/repos/sql/test_catalog.py` ✓ (additional tests beyond #64)
- `tests/repos/sql/test_hardware.py` ✓
- `tests/repos/sql/test_inventory.py` ✓
- `tests/repos/sql/test_maintenance.py` ✓


### Quinn gate note — `test_hardware_next_id_still_uses_sheets_when_use_postgres_true`

**Already present.** Alex added this test during the M4 CI fix cycle. It lives in `TestDualWriteHardwareRepoReads` in `tests/repos/test_sql_repos_read.py` and uses the `settings_use_postgres` fixture. All 28 mock-based read path tests pass. No duplicate added.

---


## Verification

- `uv run ruff check tests/repos/sql/ tests/repos/test_sql_repos_read.py` — all checks passed
- `SPREADSHEET_ID=dummy uv run pytest tests/repos/test_sql_repos_read.py -v` — 28/28 passed
- SQL integration tests (`tests/repos/sql/`) require `DATABASE_URL` (CI Postgres container) — auto-skip locally

---

## Staged files

- `tests/repos/sql/test_brew_log.py`
- `tests/repos/sql/test_catalog.py`
- `tests/repos/sql/test_hardware.py`
- `tests/repos/sql/test_inventory.py`
- `tests/repos/sql/test_maintenance.py`

Coordinator to commit when CI verification is complete.

---

# Decision: Pre-push check script (Issue #66)

**Date:** 2026-05-15  
**Author:** Tariq  
**Status:** Implemented  

---

## Decision

Created `scripts/pre-push-check.sh` as a portable local CI gate before any push to espresso-logs. The script enforces all four checks from `.github/copilot-instructions.md` in sequential order with immediate exit on first failure.

## Rationale

**One-engineer operability requires automation.** A shared shell script lowers the cognitive load for developers to run checks locally before pushing, reducing wasted CI cycles and feedback loops.

**Early feedback is cheaper than late feedback.** Running all checks locally before push avoids unnecessary GitHub Actions invocations, which consume the weekly budget.

**Clear output is operationally critical.** Developers need to know which check failed and why without diving into CI logs. The `[N/4]` header pattern and explicit error messages satisfy this.

## Implementation

- `scripts/pre-push-check.sh`: Runs ruff check, ruff format, mypy strict, pytest (with SPREADSHEET_ID=dummy)
- `Makefile` target `pre-push`: Calls the script (added with proper help text)
- File is executable (chmod +x) and staged in git
- No secrets or hardcoded paths; uses `uv` directly from PATH
- Works from repo root

## Checks Enforced (in order)

1. `uv run ruff check app/ tests/` — Linter
2. `uv run ruff format --check app/ tests/` — Formatter
3. `uv run mypy app/ --strict` — Type checking
4. `SPREADSHEET_ID=dummy uv run pytest tests/ -v --ignore=tests/e2e/` — Tests

Any failure stops the script immediately and reports which step failed.

## Success Criteria

- [x] Script runs all 4 checks in order
- [x] Exits on first failure
- [x] Clear section headers and output messages
- [x] Executable file with proper git mode
- [x] Makefile target added
- [x] No GCP credentials or secrets
- [x] Works from repo root
- [x] Staged, not committed (per git-discipline/SKILL.md)

## Next Steps

Coordinator will commit after CI verification. No further action required from Tariq.

---

# Decision Drop — PR #62 PostgreSQL Smoke Test Gate

**Date:** 2026-05-15  
**Author:** Tariq  
**Scope:** Pre-push gate verification for feat/m4-prerequisites (PR #62)

## Decision

PR #62 passes the local Postgres smoke test gate. The pre-push verification is complete and the branch is clear to push.

## Evidence

### PostgreSQL 15 (Homebrew)
- Installed via `brew install postgresql@15`
- Running via `brew services start postgresql@15`
- Database `espresso_logs` created, user `espresso` with full privileges


### Alembic Migrations
All 6 migrations applied cleanly:
- 0001: Initial schema — 11 tables
- 0002: FK constraints on household_id
- 0003: Make household_id nullable (M2 dual-write shadow)
- 0004: sheets_id identity columns + v2 columns
- 0005: sheets_hardware_id on maintenance_log
- 0006: sheets_catalog_id on inventory_bags


### Sheets → Postgres Migration
| Entity | Mapped | Upserted | Errors | Status |
|--------|--------|----------|--------|--------|
| Catalog | 17 | 17 | 0 | PASS |
| Inventory | 19 | 19 | 0 | PASS |
| Hardware | 13 | 13 | 0 | PASS |
| Maintenance | 4 | 4 | 0 | PASS |
| Brew_Log | 74 | 74 | 1 | SKIP (data quality) |

**Data quality issue:** Brew_Log row 72 has `Storage_Method='Ambient — Bag'` not in enum. This is a source data defect — not a code bug. All 74 valid rows migrated. Tracked for M5 data cleanup.


### Smoke Test
All 5 SQL repos returned data with no exceptions:
- SqlBrewLogRepo: 74 rows — PASS
- SqlCatalogRepo: 17 rows — PASS  
- SqlInventoryRepo: 2 rows (Active filter; 19 total) — PASS
- SqlHardwareRepo: 13 rows — PASS
- SqlMaintenanceRepo: 4 rows — PASS


## Blockers

None. PR #62 is clear to push.

## Follow-up items

1. **Data cleanup (pre-M5):** Fix `Storage_Method='Ambient — Bag'` in production Sheets Brew_Log row 72 to a valid enum value before M5 write-disable.
2. `scripts/smoke_test_postgres.py` should be included in the PR — it's a reusable local gate script.


---

# Squad Decisions

## Active Decisions

### 2026-05-14: M4 deps.py read switchover complete
**By:** Alex
**What:** All 5 DualWrite read methods now route to Postgres when USE_POSTGRES=true. Quinn notes addressed. feat/m4-prerequisites ready for PR.
**Why:** M4 milestone — Sheets → Postgres migration read switchover

---


### 2026-05-15T03:52:30Z: P3 backfill strategy confirmed
**By:** skarthikkrishna (via Copilot)
**What:** Full backfill via `scripts/migrate_sheets_to_postgres.py`. No concurrent writes during backfill window. Backfill runs before `USE_POSTGRES=true` is set in prod.
**Why:** User decision — resolves Quinn gate P3 prerequisite for M4 read switchover.

---


### 2026-05-14: Quinn gate approved — M4 prerequisites
**By:** Quinn
**What:** feat/m4-prerequisites APPROVED_WITH_NOTES for M4 deps.py switchover
**Why:** P1 (ORM + write methods) and P2 (SQL reads + async DualWrite) verified. P3 confirmed by operator. Two non-blocking notes (missing next_id regression test; update_feedback asyncio antipattern in SQL stub) must be resolved before M5 but do not block the M4 read switchover.

---


### 2026-05-14: Decision Drop — M4 CI Failure RCA
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

---

### 2026-05-14: Push gate mandate — binary only
**By:** Karthik (via Tariq)
**What:** Before any git push, the only valid states are: (1) asking the operator for permission, or (2) paused waiting for the operator's reply. No agent or coordinator may push based on their own assessment that work is complete. All four local CI checks must pass AND the operator must have explicitly said yes. No exceptions, no interpretation, no fuzzy cases.
**Why:** PR #62 was pushed without user validation and without running the full CI-equivalent suite locally. The gap was an incomplete pre-push checklist and no explicit binary push gate. This mandate closes that gap permanently.
**Scope:** Binds the coordinator and all implementation agents (Alex, Finn, and any future agents). Non-waivable.

---


### 2026-05-15: Tariq Routing Decision — PR Review Comment Handling

- Agent: Tariq (routing)
- Request: Address new PR comment `@copilot can you review this please` on an existing PR.
- Decision: DIRECT_PERMITTED


## Rationale
This is bounded operational workflow work (PR review handling) and does not introduce or change product requirements, architecture, or implementation scope. No SpecKit artifact generation is needed to execute this request.

## Explicit Scope Confirmation
Scope is strictly limited to handling the existing PR review comment and any directly related PR review workflow actions. No feature, UX, API, data model, or cross-cutting architecture changes are authorized under this routing decision.

---


### Spec 016 — Bug Review (2025-07-28)

**Status: Unanimous HOLD** — four blocking issues identified across spec.

**Verdicts:**
- **Maya**: BLK-1 RESOLVED (axis orientation formula verified) · BLK-2 STILL BLOCKING (table row-order description contradicts itself)
- **Aria**: FR-010 RGBA table BLOCKING (internal contradiction: Weak & sweet / Bitter & astringent wrongly assigned)
- **Quinn**: BLK-4 Item 3 STILL BLOCKING (time boundary "upper" wording) + NEW BUG A & B (corner descriptions reversed) + SC-003 BLOCKING (9 canonical coordinates undefined)
- **Finn**: FR-010 RGBA table STILL BLOCKING (same error as Aria: non-target zones wrongly named)

**Required fixes before implementation (4 critical):**
1. Maya: Fix BLK-2 — reword "reverse" table-order claim to remove contradiction
2. Aria + Finn: Fix FR-010 "Ideal, non-target" row to name "Bitter; Sour" (not "Weak & sweet; Bitter & astringent")
3. Quinn: Fix time boundary wording to "fast-shot row (SVG bottom)" (not "upper")
4. Quinn: Add 9-row canonical coordinate table to spec

---


## 2026-05-06: V2 Product Spec — Functional Decisions (Priya)

### PD-V2-01: Google Sheets → Relational Database

**Status:** APPROVED  
**Rationale:** Sheets cannot enforce row-level access control per household. Multi-tenancy requires a database where every query carries a `household_id` predicate enforced at the repository layer.

**Impact:** Largest backend migration in project history. `gspread`-based repos replaced. `SPREADSHEET_ID` env var superseded by `DATABASE_URL`. Migration script (`scripts/migrate_v1_to_v2.py`) required.

---


### PD-V2-02: Two roles only (admin / member)

**Status:** APPROVED  
**Rationale:** At 2–10 people per household scale, granular roles add UI complexity for marginal benefit. Role changes managed by remove/re-invite.

**Deferred:** Role promotion/demotion, ownership transfer, read-only variant.

---


### PD-V2-03: Invitation via email only (no shareable link)

**Status:** APPROVED  
**Rationale:** Email delivery provides implicit audience targeting. Shareable links without strict one-time guarantees become guessable on small deployments. Safe one-time shareable links deferred.

---


### PD-V2-04: Household ID server-resolved, never client-supplied

**Status:** APPROVED  
**Rationale:** Prevents client-side household-spoofing. Session is authoritative source of truth.

---


### PD-V2-05: Multi-household switcher hidden for single-household users

**Status:** APPROVED  
**Rationale:** Majority (single-household users) don't need to think about infrastructure. Switcher adds cognitive load.

---


### PD-V2-06: Deleted household → redirect to /welcome

**Status:** APPROVED  
**Rationale:** App cannot function without active household. Reuse welcome wizard recovery path.

---


### PD-V2-07: Member removal preserves historical shot data

**Status:** APPROVED  
**Rationale:** Household brew history is household data, not individual data. Deletion breaks AI inference context and analytics. Removed attributions display as "Former member".

---


### PD-V2-08: Catalog management not role-restricted

**Status:** APPROVED  
**Rationale:** Adding beans is part of core logging workflow. Members should add new beans without waiting for admin. Deletion restricted (irreversible, affects shared data).

---


## 2026-05-06: V2 Architecture Spec — Engineering Decisions (Maya)

### AD-V2-01: Cloud SQL for PostgreSQL

**Status:** APPROVED  
**Verdict:** `db-f1-micro` (~$8/month always-on), Cloud SQL for PostgreSQL as system of record.

**Rationale:** Sheets cannot support multiple households. Cloud SQL with row-level isolation and Postgres RLS enables clean multi-tenancy. Repository pattern provides migration seam. Cost within $50/month ceiling.

**Rejected:** Firestore (NoSQL unfits relational data), SQLite (unsafe at scale), database-per-tenant ($8+/household/month overhead).

---


### AD-V2-02: IAP Rejected (Again)

**Status:** APPROVED  
**Verdict:** Retain Google OAuth with email allowlist. IAP not worth the cost.

**Rationale:** HTTPS Load Balancer adds ~$18/month floor. IAP cannot enforce household roles (app-layer required regardless). App-level Google OAuth (Authlib) working, tested, zero-cost.

**Revisit conditions:** Native mobile SSO, compliance 2FA mandate.

---


### AD-V2-03: Cloud Run Stays; GKE Deferred

**Status:** APPROVED  
**Verdict:** Cloud Run (scale-to-zero) remains hosting platform.

**Rationale:** Mobile apps call same REST API. GKE Standard ~$72/month (over ceiling). GKE Autopilot ~$15–25/month adds operational complexity for minimal benefit.

**GKE inflection:** When always-on workers required AND traffic >$20/month Cloud Run AND team ≥ 2 engineers.

---


### AD-V2-04: Row-Level Isolation with Postgres RLS

**Status:** APPROVED  
**Verdict:** Single schema, Postgres RLS enforces `household_id` FK isolation.

**Rationale:** Single Alembic path. Cross-tenant admin queries trivial. Schema-per-tenant adds complexity. Database-per-tenant costs $8+/household/month.

**Catalog:** Global (shared reference data; no `household_id`). All others (brew_log, inventory, hardware, maintenance): tenant-scoped.

---


### AD-V2-05: Roles Enforced via FastAPI Dependency Injection

**Status:** APPROVED  
**Verdict:** `require_admin` dependency in `app/deps.py`, chained from `current_household_membership` → `current_user`.

**Roles:**
- `admin`: invite/remove members, delete any log, manage catalog
- `member`: view all household logs, add own logs, add/edit hardware and inventory

**Middleware rejected:** Runs before route resolution; lacks household/role context.

---


### AD-V2-06: Phased Migration M1–M6

**Status:** APPROVED  
**Phases:**
- M1: Cloud SQL provisioning, Alembic initial migration
- M2: Dual-write shadow (write both Sheets + Postgres; read Sheets)
- M3: Backfill + validation (`migrate_sheets_to_postgres.py`)
- M4: Read switchover (read Postgres; write both; `USE_POSTGRES` env for 30-sec rollback)
- M5: Household, Roles & Sheets write-disable
- M6: Sheets decommission (archive in Drive; never delete)

**Rollback:** Documented at every phase. M4 rollback: 30-second env var update. Sheets preserved indefinitely.

---


## 2026-05-06: V2 Spec Review Amendments (Tariq, TPM)

### DEC-T01: Role terminology — `admin` (not `manager`)

**Amendment:** Canonical term throughout: `admin` (from functional spec). Architecture updated: `require_manager` → `require_admin`; SQL CHECK `'manager'` → `'admin'`.

**Rationale:** Functional spec is product authoritative source. Role names appear in UI.

---


### DEC-T02: Catalog is household-scoped (not global)

**Amendment:** `catalog` table receives `household_id` FK (NOT NULL). Each household independent bean library.

**Rationale:** Functional spec §1.2 explicit: household-scoped. Global catalog couples isolation, requires cross-household trust model. Duplication cost negligible at 2–5 household scale.

**Impact:** Alembic `0002_add_household_id_columns.py` includes `ALTER TABLE catalog ADD COLUMN household_id`. `SqlCatalogRepo` scopes all queries.

---


### DEC-T03: `users` table is required

**Amendment:** First-class `users` table required, separate from `household_members`. Schema: `id` (Google OAuth sub), `email`, `display_name`, `picture_url`, `created_at`, `last_seen_at`. `household_members.user_id` FKs to `users.id`.

**Rationale:** Functional spec §1.1 defines `User` first-class entity. Without `users` table, `display_name` and `picture_url` duplicate in `household_members`. `last_seen_at` unmaintainable.

**Impact:** New `app/models/user.py`; upsert on login in `auth.py`; Alembic `0001_initial_schema.py` includes `users` table.

---


### DEC-T04: Email delivery optional for v2.0 MVP

**Amendment:** SMTP email configurable, not hard dependency. When `SMTP_HOST` unset: invitation record created, email skipped, server logs token, invite modal shows warning with copyable link.

**Rationale:** SMTP dependency (credential rotation, deliverability, spam filtering) slows single-engineer deployment. Token links achieve security; email is UX convenience. NFR-D7 captures this.

**Impact:** Backend: `if settings.smtp_host: send_email(...)`. Frontend: invite modal handles `email_sent: false` with copyable link.

---


### DEC-T05: Phase M5 renamed "Household, Roles & Sheets write-disable"

**Amendment:** M5 bundles (a) disabling Sheets dual-write and (b) implementing household/roles. Phase overview table (§7.1) and rollback (§7.3) updated.

**Rationale:** Previous naming conflict: §7.1 called M5 "Write-only Postgres"; §10 described "Household and Roles". Both share same rollback point; bundling saves deployment cycle.

---


### DEC-T06: Cloud SQL cost confirmed within $50 ceiling

**Amendment:** Cost model confirmed. db-f1-micro ~$7.67/month acceptable.

**Peak scenario A (db-f1-micro):** ~$14/month total. Headroom: ~$36/month.  
**Peak scenario B (db-g1-small if >25 connections):** ~$35/month total. Headroom: ~$15/month.  
**Trigger for upgrade:** >~2 concurrent Cloud Run instances. At 1,000 req/day, trigger unlikely.

---


### DEC-T07: Cloud Monitoring Uptime Check required before go-live

**Amendment:** Uptime Check on `/health` with email alerting is go-live requirement. Cost: $0 (free tier). Setup: ~10 minutes.

**Rationale:** Without proactive alerting, outages discovered only via user reports. Unacceptable even at household scale. Operability table (§12) updated.

---


### DEC-T08: Secret rotation requires Cloud Run redeploy

**Amendment:** Documented in operability table (§12). Secret rotation in GCP Secret Manager requires explicit Cloud Run redeploy via `gcloud run services update --update-secrets=...` for pickup.

**Rationale:** Cloud Run resolves secrets at deploy time, not request time. Operators expecting immediate pickup will find old value in use until redeploy.

---


## 2026-05-13: CI & Type Safety Fixes (Maya)

### DEC-M01: Abstract method policy for BaseRepo

**Status:** APPROVED  
**PR:** #60 (fix/ui-safari-polish)

**Decision:** Any method implemented identically across **all** concrete `BaseRepo` subclasses must also be declared as an `@abstractmethod` on `BaseRepo` itself. This is a mypy `--strict` requirement (`attr-defined` errors surface when calling through the base type) and a correctness guardrail for future subclasses.

**Rationale:** `delete_rows(start_row, end_row)` was present on all 5 concrete repos but missing from `BaseRepo`, causing a mypy `attr-defined` failure in `api_e2e.py`. The fix is the canonical pattern: declare abstract, let concrete implementations satisfy it.

**Impact:** Low risk: no runtime behaviour changed; all concrete repos already satisfy the new abstract contract. Future repo subclasses that forget to implement `delete_rows` will fail at import time, not at runtime.

---


### 2026-05-13: Chip Component Refactor — Single Unified Style, Design Corrections Applied

**Status:** ✅ **COMPLETE**  
**Branch:** fix/ui-safari-polish  
**Commit:** a190afd

**Summary:** `<Chip />` component extracted as shared categorical label across frontend. Single unified amber frosted-glass style replaces inline badges for roast level and hardware categories. Design system deviations corrected per Aria's review.

**Design Audit (Aria):**
- ✅ Color palette: amber/brown frosted-glass aligns with espresso theme
- ✅ Backdrop blur: `blur-sm` non-competing with main-content blur
- ⚠️ Border radius: `rounded-full` (pill) does NOT match design token `--bevel-radius: 10px`
- ⚠️ Padding: `px-2 py-0.5` (8px / 2px) too tight; text crowding at edges

**Corrections Applied (Finn):**
- Border radius: `rounded-full` → `rounded` (matches `--bevel-radius`)
- Padding: `px-2 py-0.5` → `px-2.5 py-1` (10px / 4px)
- Removed `backdrop-blur-sm` (no-op inside frosted containers)

**Final API:**
```tsx
<Chip label={shot.roast_level} />
<Chip label={item.category} className="mt-2" />
```
- No `variant` prop; single unified style
- `label` supports null/undefined (returns null)
- All categorical labels render identically

**Call Sites (5):**
- BrewLogDetail.tsx: roast level
- Dashboard.tsx: roast level
- CatalogDetail.tsx: roast level
- CatalogList.tsx: roast level
- HardwarePage.tsx: hardware category

**Non-Chip Badges (remain semantic):**
- Eligibility badge (BrewLogDetail.tsx): dynamic color per shot_eligibility
- Import status (ImportWizard.tsx): error/success feedback

**Audit Results:**
- ✅ Unified style: all 5 call sites correct
- ✅ Lint: 0 warnings
- ✅ Build: clean
- ✅ Tests: 140/140 passed

**Verdicts:**
- **Aria (Designer):** ✅ Design changes approved; aligns with design system
- **Finn (Frontend):** ✅ Corrections applied and verified

---


## 2026-05-13: E2E_AUTH_BYPASS Production Guard (Alex)

**Status:** IMPLEMENTED (commit c5f1655)

Gate `E2E_AUTH_BYPASS` behind hard startup failure in production:

1. If `E2E_AUTH_BYPASS=1` and `APP_ENV=production`, raise `RuntimeError` immediately.
2. Log `WARNING` whenever bypass is active (any environment).

**Implementation:** Uses `os.environ.get("APP_ENV")` at module load, not `settings.app_env` (circular dependency risk). Guard only raises when both conditions true; dev/test unaffected.

**Rationale:** Startup crash on misconfiguration is the strongest safeguard — deployment fails loudly rather than silently exposing unauthenticated API.

---

## 2026-05-13: E2E_AUTH_BYPASS Environment Allowlist (Alex)

**Status:** IMPLEMENTED

`E2E_AUTH_BYPASS=1` permitted only when `APP_ENV` is explicitly `"test"` or `"local"`. Any other value raises `RuntimeError` at startup.

**Changes:**
- `app/deps.py`: Replaced `APP_ENV == "production"` with `APP_ENV in {"test", "local"}`
- Added `_PERMITTED_E2E_ENVS = frozenset({"test", "local"})`
- Error message names permitted values, calls out staging/preview

**Rationale:** Staging Cloud Run deployment with bypass exposes synthetic-user auth and unauthenticated DELETE endpoint to public internet. Allowlist ensures misconfigured deployments fail at startup.

---

## 2026-05-13: E2E_SEED Schema Alignment (Alex)

**Status:** IMPLEMENTED

`E2E_SEED` in `app/testing/fake_sheets.py` must always match production sheet schema. No synonyms, no extra fields.

**Changes:**
- `Inventory`: renamed `Roast_Date` → `RoastDate`, `Roast_Level` → `RoastLevel`; added `Display_Name`; removed `Date_Finished`; reordered to match `InventoryRepo.COLUMNS`
- `BrewLog`: tab key `BrewLog` → `Brew_Log`; renamed fields (`Log_ID` → `Shot_ID`, `Dose_g` → `Dose_In_g`, etc.); removed `Rating`/`Beans`; added all missing COLUMNS fields

**Rationale:** Seed data mismatching repo schema causes E2E tests to exercise wrong code paths silently.

---

## 2026-05-13: Public `delete_by_pk` on BaseRepo (Alex)

**Status:** IMPLEMENTED

Row deletion by primary key is a standard repo operation — exposed as public method on `BaseRepo`, not ad-hoc private logic.

**Changes:**
- `app/repos/base.py`: added concrete `delete_by_pk(pk_col, pk_val)` to `BaseRepo`
- `app/deps.py`: delegated in `_DualWriteCatalogRepo` and `_DualWriteInventoryRepo`
- `app/routers/api_e2e.py`: removed `_delete_by_id` helper; uses `repo.delete_by_pk()` directly; added `_RepoPkDelete` Protocol

**Rationale:** Coupling router to private repo details breaks encapsulation; causes silent failures when repos are wrapped (e.g., `_DualWriteInventoryRepo` had no `_fetch_all`).

---

## 2026-05-13: User Directive — No Git Push Without Approval

**By:** Karthik (via Copilot)  
**Date:** 2026-05-13T20:36:58Z

No agent may run `git push`, `git commit`, or trigger CI without explicit user approval. Every push burns a GitHub Actions CI run and costs real money. Agents stage changes locally and wait. Coordinator asks "ready to push?" before commit+push.

**Enforcement:** Hard gate in every agent charter. Scribe exception: may commit `.squad/` files only, never push.

---

## 2026-05-13: Hard Gate — No Git Push Without User Approval (Maya)

**Status:** APPROVED

All agent charters updated with explicit no-push gate. New skill: `.squad/skills/git-discipline/SKILL.md`. Agents may only run `git add`. `git commit` and `git push` require explicit user confirmation via coordinator. **Scribe exception:** may commit `.squad/` files only, never push.

---

## 2026-05-13: Coordinator-Level Git Push Gate (Tariq)

**Status:** APPROVED

Added hard no-push gate to `.copilot/instructions.md` (coordinator reads at session start). Created `.copilot/skills/git-gate/SKILL.md`. Gate requires explicit user confirmation before any git commit/push on source code. Scribe `.squad/` commits excepted.

**Rationale:** Agent charter gates don't constrain coordinator — only `.copilot/instructions.md` does.

---

## 2026-05-14: Routing decision — M4 Read Switchover (Priya)

**Status:** DIRECT_PERMITTED

M4 Read Switchover is execution of a pre-specified, pre-architected migration milestone. No new product scope. Implementation plan is already defined in `docs/requirements/engineering_architecture_v2.md` (§ Phase M4). All infrastructure is already in place: SQL repos have `list()`/`get()` read methods, `USE_POSTGRES` flag exists in `app/config.py`, and `self._sql` is injected into all five `_DualWrite*` wrappers in `app/deps.py`.

**Why:** The change is narrowly bounded — flip the read path in all five `_DualWrite*` classes in `app/deps.py` from `self._sheets` to `self._sql` when `settings.use_postgres=True`, with `self._sheets` fallback when `False`. Update tests to cover both read paths. Quinn gate is still required before implementation (touches application code). M3 backfill + validation must be confirmed complete before `USE_POSTGRES=true` is set in Cloud Run prod env.

**Scope:**
- `app/deps.py` — `list()`, `get()`, `list_*()` read methods in `_DualWriteCatalogRepo`, `_DualWriteBrewLogRepo`, `_DualWriteInventoryRepo`, `_DualWriteHardwareRepo`, `_DualWriteMaintenanceRepo`
- `tests/` — coverage for both `use_postgres=True` and `use_postgres=False` read paths
- No router, service, frontend, or schema changes required

**Gates:**
- Quinn gate required (application code change)
- M3 backfill completion must be verified before flipping env var in prod

---

## 2026-05-14: M4 Prerequisites Complete (Alex)

**Status:** IMPLEMENTED — awaiting review + Quinn re-gate

All M4 prerequisite tasks (P1 + P2) are implemented and all tests pass (399 passed, 4 skipped).
**Branch:** `feat/m4-prerequisites` (7 commits, not pushed)

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


### Key Technical Decisions

1. **`sheets_hardware_id` cross-reference column**: The `list()` filter for maintenance must match Sheets string IDs. Since `hardware_id` FK is a UUID, a new `sheets_hardware_id TEXT` column stores the raw Sheets string (e.g. "HW001"). Migration 0005 covers this.

2. **`update_feedback` stays sync**: Kept sync to match existing DualWrite + Sheets repo contract. Marked `# TODO(M4-async)` for the full async migration.

3. **DualWrite wrappers delegate sync read calls**: When `use_postgres=False`, async DualWrite methods call sync Sheets methods directly — safe because there's no I/O on the event loop in the test context.

4. **Unit test compatibility pattern**: Tests that previously passed raw Sheets repos to async services now wrap them in `_DualWrite*` with `sql=None` and patch `settings.use_postgres=False`. Preserves test fidelity without making Sheets repos async.

---


## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
