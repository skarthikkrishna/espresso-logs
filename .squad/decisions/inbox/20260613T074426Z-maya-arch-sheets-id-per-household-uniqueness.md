---
node_id: 20260613T074426Z-maya-arch-sheets-id-per-household-uniqueness
node_type: decision_drop
agent: Maya
role: architecture
spec_id: spec-042
date: 2026-06-13T07:44:26Z
status: decided
privacy_gate: .squad/privacy-gate.md reviewed before writing
---

# Architecture Decision: Per-household `sheets_id` uniqueness

## Defect

The five tenant entity tables currently treat `sheets_id` as globally unique. That is incorrect because each household owns an independent source sheet and can legitimately generate the same sheet-local IDs, such as `CAT-001`, `BAG-001`, `HW-001`, maintenance IDs, or shot IDs.

Evidence:

- Migration `alembic/versions/0004_add_sheets_identity_and_v2_columns.py:31-72` creates `uq_<table>_sheets_id` constraints on `sheets_id` alone for `catalog`, `inventory_bags`, `hardware`, `maintenance_log`, and `brew_log`.
- ORM models still declare `sheets_id` with `unique=True`: `app/models/catalog.py:39`, `app/models/inventory.py:38`, `app/models/hardware.py:33`, `app/models/maintenance.py:41`, `app/models/brew_log.py:40`.
- SQL mirror upsert paths for four tables read by `sheets_id` alone before writing: `app/repos/sql/catalog.py:25-28`, `app/repos/sql/inventory.py:34-37`, `app/repos/sql/hardware.py:24-26`, `app/repos/sql/maintenance.py:48-52`.
- `app/main.py:154-159` startup inventory backfill also looks up `InventoryBag` by `sheets_id` alone.
- `app/repos/sql/brew_log.py` does not currently contain an unscoped read-before-write upsert; its read/update/delete paths are household-scoped (`app/repos/sql/brew_log.py:123-168`, `230-276`). However, its global unique constraint still prevents a second household from inserting an otherwise valid colliding `Shot_ID`.

## Decision

Change identity semantics from globally unique `sheets_id` to per-household unique `(household_id, sheets_id)` for all five tenant tables.

### 1. Data-model fix

Recommended constraints:

- `catalog`: unique `(household_id, sheets_id)`
- `inventory_bags`: unique `(household_id, sheets_id)`
- `hardware`: unique `(household_id, sheets_id)`
- `maintenance_log`: unique `(household_id, sheets_id)`
- `brew_log`: unique `(household_id, sheets_id)`

`household_id` is currently nullable because migration 0003 intentionally relaxed it for the M2 dual-write shadow period (`alembic/versions/0003_make_entity_household_id_nullable.py:1-26`). Live schema inspection confirms both `household_id` and `sheets_id` remain nullable for all five tables.

Composite uniqueness with nullable `sheets_id` is acceptable: Postgres treats NULLs as distinct, so multiple rows with `sheets_id IS NULL` remain allowed in a household. That is desirable for direct app-created rows or partially imported rows, especially in `maintenance_log` and `brew_log`, where rows can exist without a sheet-local ID.

Composite uniqueness with nullable `household_id` is not acceptable as a durable invariant. `UNIQUE (household_id, sheets_id)` would allow duplicate non-null `sheets_id` values when `household_id IS NULL`, and RLS tenant isolation also expects household-owned rows. Alex should either make `household_id` `NOT NULL` in the same remediation after a preflight assertion, or block the migration if any tenant-table row still has `household_id IS NULL` and require an explicit backfill/cleanup first.

Live local test database safety results:

| table | total rows | non-null sheets_id | null sheets_id | null household_id | cross-household duplicate sheets_ids | duplicate household+sheets pairs |
|---|---:|---:|---:|---:|---:|---:|
| brew_log | 0 | 0 | 0 | 0 | 0 | 0 |
| catalog | 0 | 0 | 0 | 0 | 0 | 0 |
| hardware | 0 | 0 | 0 | 0 | 0 | 0 |
| inventory_bags | 0 | 0 | 0 | 0 | 0 | 0 |
| maintenance_log | 0 | 0 | 0 | 0 | 0 | 0 |

The inspected test database has no existing duplicates and no null household rows, so dropping global uniqueness and adding composite uniqueness is safe and non-destructive there.

### 2. Write-path fix

Every read-before-write or support lookup that identifies a tenant entity by `sheets_id` must include household scope before reading, updating, deleting, or deciding whether to insert.

Required changes:

- `SqlCatalogRepo.upsert`: replace `select(CatalogBean).where(CatalogBean.sheets_id == sheets_id)` with a household-scoped predicate using the household resolved by `row_household_id_or_context()`.
- `SqlInventoryRepo.upsert`: scope the existing lookup by the resolved household.
- `SqlHardwareRepo.upsert`: scope the existing lookup by the resolved household.
- `SqlMaintenanceRepo.upsert`: scope the existing lookup by the resolved household.
- `run_startup_backfill` in `app/main.py`: do not query `InventoryBag` by `sheets_id` alone. Either run under explicit household context and filter by household, or retire/rework this backfill if it cannot identify a household safely.
- `SqlBrewLogRepo.add`: no read-before-write exists, but the insert path must rely on the new composite uniqueness. Existing brew-log read/update/delete/idempotency support is already household-scoped.

Prefer reusing `household_read_scope` / `HouseholdReadScope` from `app/repos/sql/tenant.py:37-71` for reads. For upserts, because the row already resolves `household_id`, a small helper or explicit `Model.household_id == household_id` predicate is acceptable. Fail closed if `household_id` cannot be resolved; do not perform a global fallback query.

Dual-write / Sheets interaction: Sheets remains the owner of sheet-local ID generation. SQL is a mirror and must store sheet IDs as household-local identity, not as global identity. Any import/sync code that writes SQL rows from Sheets must carry or derive household context before upserting.

### 3. Migration design

New Alembic revision after `0015`, design only:

```python
revision = "0016"
down_revision = "0015"

TABLES = (
    ("catalog", "uq_catalog_sheets_id", "uq_catalog_household_sheets_id"),
    ("inventory_bags", "uq_inventory_bags_sheets_id", "uq_inventory_bags_household_sheets_id"),
    ("hardware", "uq_hardware_sheets_id", "uq_hardware_household_sheets_id"),
    ("maintenance_log", "uq_maintenance_log_sheets_id", "uq_maintenance_log_household_sheets_id"),
    ("brew_log", "uq_brew_log_sheets_id", "uq_brew_log_household_sheets_id"),
)

def upgrade() -> None:
    # Preflight: fail if duplicate (household_id, sheets_id) rows exist for non-null sheets_id.
    # Preflight: fail if household_id is NULL in any tenant table, or perform an approved backfill first.
    for table, old_name, new_name in TABLES:
        op.drop_constraint(old_name, table, type_="unique")
        op.create_unique_constraint(new_name, table, ["household_id", "sheets_id"])
        # If preflight proves no NULL household_id rows and product phase requires it:
        # op.alter_column(table, "household_id", nullable=False)

def downgrade() -> None:
    for table, old_name, new_name in reversed(TABLES):
        # Downgrade must preflight for globally duplicate non-null sheets_id values first.
        op.drop_constraint(new_name, table, type_="unique")
        op.create_unique_constraint(old_name, table, ["sheets_id"])
```

ORM design: remove `unique=True` from each `sheets_id` column and add `sa.UniqueConstraint("household_id", "sheets_id", name="uq_<table>_household_sheets_id")` in each model `__table_args__`.

Downgrade is lossy in capability, not data: if two households have the same non-null `sheets_id`, restoring global uniqueness must fail loudly or require explicit data cleanup before recreating the old constraint.

### 4. Spec / acceptance-criteria reconciliation

Recommendation: **yes, run a Priya-owned `speckit.clarify` / spec amendment before implementation.**

Reason: the original US3 intent already includes cross-household isolation and T034 explicitly names overlapping `sheets_id` values (`coffee_tracker/specs/042-pr116-kaapi-kadai-remediation/tasks.md:151`). The product intent does not change. However, the remediation scope changes from Quinn-only test coverage to an Alex-owned schema/write-path fix plus Quinn verification. Under the no-scope-changes-after-freeze rule, that implementation scope expansion should be captured in the spec/tasks rather than patched inline.

### 5. Security, compliance, RLS, and compatibility

Security decision: global `sheets_id` uniqueness is a tenant isolation defect. With forced RLS, the second household receives a unique-constraint failure even though it cannot see the first household's row. Without RLS, the unscoped upsert reads can find and mutate another household's row. The fix is required for confidentiality, integrity, and availability.

RLS interaction:

- FORCE RLS continues to protect reads/writes by household, but constraints execute globally and can still leak/block on globally unique keys.
- Composite uniqueness aligns database constraints with RLS policy boundaries.
- Missing household context must fail closed; do not let nullable `household_id` become a bypass of composite uniqueness.

Backward compatibility:

- APIs can keep using sheet-local IDs in paths/responses because household context disambiguates them.
- Existing rows do not need ID rewriting.
- Existing client-visible IDs remain unchanged.
- Any admin/test cleanup that assumes globally unique seed prefixes should be reviewed. `app/routers/api_e2e.py` contains raw `sheets_id LIKE ...` cleanup/seeding queries (`app/routers/api_e2e.py:242-341`, `385-486`); these appear test-support oriented, but overlapping ID tests must ensure cleanup is anchored by household or synthetic prefixes.

Known global-uniqueness reliance found by grep:

- Migration 0004 global unique constraints.
- ORM `unique=True` declarations on five models.
- Four SQL upsert pre-read paths.
- Startup inventory backfill in `app/main.py`.
- No unscoped brew-log `sheets_id` read-support path was found; brew-log idempotency is already household-scoped via `app/repos/sql/brew_log.py:251-258` and the DB index is household-scoped in `alembic/versions/0014_brew_log_idempotency_rls.py:53-59`.

### 6. Implementation routing

Owner: **Alex** for schema migration, ORM changes, SQL repo write-path scoping, and startup backfill remediation.

Sequencing:

1. Priya amends/clarifies spec-042 and tasks to add the Alex remediation task(s) and unblock T034.
2. Quinn pauses or narrows in-flight T034 overlapping-`sheets_id` assertions until Alex's fix lands; Quinn can continue unrelated isolation coverage if it does not require colliding IDs.
3. Quinn produces or updates the pre-implementation gate for the amended work.
4. Alex implements migration/model/repo changes after the gate.
5. Quinn resumes T034-T037 and verifies overlapping sheet-local IDs across households under SQL-backed CI.

Gate recommendation: **Quinn gate required before implementation.** This touches schema constraints, ORM models, write paths, tenant isolation, and RLS behavior.
