---
agent: Maya
repo: espresso-logs
branch: household_test_fixtures
created_at_utc: 2026-06-13T17:42:33Z
status: DIRECT_PERMITTED
scope: PR #117 review finding ③, app/main.py startup backfill posture after spec-042 T039
privacy_gate: read .squad/privacy-gate.md before authoring; no prohibited operational values included
---

# Decision: startup backfill posture in multi-tenant Postgres mode

## Assumptions

- This decision is architecture/data-model guidance only; no application code is modified here.
- The startup backfill is the legacy M2/M4 one-time aid for filling `maintenance_log.sheets_hardware_id` and `inventory_bags.sheets_catalog_id` on rows created before migrations 0005/0006.
- Current Postgres runtime is tenant-scoped: every tenant table is behind RLS/FORCE RLS and application request paths set `app.current_household_id` after resolving household membership.

## Investigation findings

1. `run_startup_backfill()` is called from FastAPI lifespan after RLS/setup checks. It opens a fresh DB session and invokes `_backfill_maintenance_logs()` then `_backfill_inventory_bags()` when `settings.use_postgres` is true, but it does not set any household context for that session (`app/main.py:177-192`, `app/main.py:195-217`).
2. `_backfill_inventory_bags()` counts all rows with `sheets_catalog_id IS NULL`, then calls `current_household_id(db)`. With no startup household context, it logs a warning and returns without backfilling when rows exist (`app/main.py:135-153`).
3. `_backfill_maintenance_logs()` counts all rows with `sheets_hardware_id IS NULL`, reads all Sheets maintenance rows, and delegates to `SqlMaintenanceRepo.upsert()` (`app/main.py:101-117`). `SqlMaintenanceRepo.upsert()` resolves tenant ownership via `row_household_id_or_context()` and scopes its lookup by `MaintenanceLog.household_id == household_id` (`app/repos/sql/maintenance.py:35-55`).
4. `SqlInventoryRepo.upsert()` has the same write-path shape: it resolves `household_id` from row/context and scopes by `(sheets_id, household_id)` (`app/repos/sql/inventory.py:30-40`). After spec-042, this is the intended write-path household scoping, not a bug in the repo layer.
5. Tenant helpers deliberately fail closed for reads without context: `current_household_id()` reads `app.current_household_id`; `row_household_id_or_context()` falls back to that value; `household_read_scope()` returns no predicate/no context rather than allowing unscoped reads (`app/repos/sql/tenant.py:22-71`).
6. RLS/FORCE RLS is intentional for the tenant tables, and operational cross-tenant work belongs outside the runtime role. Migration 0007 enables and forces RLS on all tenant tables and explicitly reserves bypass behavior for out-of-band operational use, not application startup (`alembic/versions/0007_m5_schema_corrections.py:123-155`).
7. The link-field backfill was created to repair a one-time migration gap: migrations 0005 and 0006 added nullable Sheets cross-reference columns (`alembic/versions/0005_add_sheets_hardware_id_to_maintenance.py:1-31`, `alembic/versions/0006_add_sheets_catalog_id_to_inventory_bags.py:1-26`), and the prior Quinn gate describes the missing backfill as a historical bug with idempotent startup tests (`specs/fix-postgres-backfill/quinn-gate.md:23-58`, `specs/fix-postgres-backfill/quinn-gate.md:163-180`).
8. Nothing outside `app/main.py` and `tests/test_startup_backfill.py` calls these startup backfill helpers; direct grep found only the lifespan call and existing unit tests (`app/main.py:91-190`, `tests/test_startup_backfill.py:77-386`).

## Decision

**Choose A — explicitly disable/guard the startup backfill in multi-tenant Postgres runtime.**

Rationale:

- **Data correctness:** A startup session has no authenticated household. Any automatic cross-household repair from a single runtime startup path would have to infer ownership for historical rows. That inference is unsafe after spec-042 because Sheets IDs are household-local, not globally authoritative.
- **Tenant safety:** Reworking the backfill to iterate households would require cross-tenant enumeration and careful `set_config('app.current_household_id', ...)` management inside application startup. That is operational migration behavior, not request-path runtime behavior, and it conflicts with the RLS posture documented in migration 0007.
- **Simplicity (Rule 2):** The backfill is a legacy one-time aid. The simplest safe posture is to stop running it at startup and make the skip explicit, rather than adding a per-household migration framework to app boot.
- **Value lost by disabling:** Low. The intended M2/M4 repair has already been implemented and tested as an idempotent one-time startup backfill. If any environment still contains NULL link fields, the safe remediation should be a deliberate operator-run migration/backfill with explicit tenant mapping, not an implicit cold-start side effect.
- **Why not B:** Per-household iteration is non-trivial, expands startup responsibilities, and risks applying the same Sheets rows to the wrong household unless a separate authoritative mapping is provided.
- **Why not C:** Keeping dead code but making the skip clearer still leaves misleading legacy helpers and tests around a behavior that should no longer be a runtime responsibility.

## Exact Alex implementation spec

Alex may implement directly within this scope only:

1. In `app/main.py`, change `run_startup_backfill()` so that:
   - `settings.use_postgres == False` still returns immediately with no DB or Sheets access.
   - `settings.use_postgres == True` no longer opens a DB session, no longer calls `get_sheets_client()`, and no longer invokes `_backfill_maintenance_logs()` or `_backfill_inventory_bags()`.
   - It emits a single intentional INFO log such as: `Startup backfill disabled in multi-tenant Postgres runtime; use an explicit operator backfill for legacy NULL link fields`.
   - It does not warn or retry, because this is no longer a startup failure path.
2. Remove the private startup-only helper functions `_backfill_maintenance_logs()` and `_backfill_inventory_bags()` if no remaining production caller exists. Also remove imports that become unused from `app/main.py` (`TTLCache`, `select`, `func`, `MaintenanceLog`, `InventoryBag`, `MaintenanceRepo`, `InventoryRepo`, `SqlMaintenanceRepo`, `SqlInventoryRepo`, `current_household_id`, and `SheetsClientProtocol` as applicable).
3. Do not change `SqlInventoryRepo` or `SqlMaintenanceRepo` household scoping. Their `(sheets_id, household_id)` lookup behavior is the desired spec-042 write-path posture.
4. Do not add a new automatic startup migration, background task, or per-household sweep.
5. If Alex wants to preserve a breadcrumb for future operations, use a concise code comment/docstring in `run_startup_backfill()` only; do not add operational identifiers or environment-specific instructions.

## Test impact

Update `tests/test_startup_backfill.py` surgically:

1. Keep/adjust the `use_postgres=False` test: `run_startup_backfill()` must perform no DB/Sheets work.
2. Add or replace with a `use_postgres=True` test proving the new contract: no DB session factory call, no Sheets client call, no private helper calls, and an INFO log states startup backfill is disabled intentionally.
3. Delete tests that exercise removed private helper behavior (`T-BF-02` through `T-BF-07`) if those helpers are removed. Those tests validated the old M2/M4 one-time repair, not the current multi-tenant runtime contract.
4. Delete or rewrite exception-path tests (`T-BF-08`, `T-BF-09`) because `run_startup_backfill()` should no longer touch Sheets/Postgres and therefore should not catch/retry those startup backfill failures.
5. Existing SQL repo tests for `SqlMaintenanceRepo.upsert()` and `SqlInventoryRepo.upsert()` should remain unchanged; they cover repo-level write behavior and should not be weakened.

## Gate recommendation

status: DIRECT_PERMITTED

Rationale: This is a bounded review-finding fix with a single architectural decision: disable legacy startup backfill rather than re-scope it. Scope is limited to `app/main.py` startup backfill removal/guarding and `tests/test_startup_backfill.py` expectation updates. No SpecKit cycle is required.

Quinn gate recommendation: no new Quinn design gate is required before Alex implements this bounded fix; Quinn should review the resulting PR/diff for test coverage and regression risk. If repository protocol requires a pre-implementation Quinn artifact for any application-code edit, use this decision drop as Maya's input to that gate rather than broadening the implementation scope.

## Explicit scope confirmation

Alex is authorized only to implement the startup-backfill posture above. Alex must not change household scoping in SQL repos, RLS migrations, authentication dependencies, data models, or operational backfill tooling as part of this review-finding response.
