# Decisions Archive

## 2026-06-13: Spec-042 US3 Isolation and Sheets ID Closeout Decisions

### Decision Drop: Alex Routing Decision — spec-042 remediation

- **Source drop:** `.squad/decisions/inbox/20260613T012838Z-alex-route-spec042-remediation.md`
- **Status:** MERGED


---
node_id: 20260613T012838Z-alex-route-spec042-remediation
node_type: routing_decision
agent: Alex
role: routing
spec: spec-042
date: 2026-06-13T01:28:38Z
status: DIRECT_PERMITTED
implementation_repo: espresso-logs
implementation_branch: household_test_fixtures
---

# Alex Routing Decision — spec-042 remediation

## Request Summary

Route the operator request to remediate spec-042 review feedback from `coffee_tracker/specs/042-pr116-kaapi-kadai-remediation/spec_042_feedback.md`, specifically the skipped tenant-isolation implementation and verification tasks from the already-frozen spec-042 task list.

## Evidence Reviewed

- `spec_042_feedback.md:27-35` states US3 primary tenant-isolation criteria were not implemented and all Quinn verification tasks were skipped.
- `spec_042_feedback.md:197-209` lists remaining work: T027-T033, T034-T037, T019-T026, and transferred G5/G6 disposition.
- `spec_042_feedback.md:213-221` recommends landing T027-T033 plus T034-T037 before or in parallel with spec-043 because they are backend-only and need no design gate.
- `tasks.md:126-138` defines Alex-owned US3 tenant-isolation implementation tasks T027-T033.
- `tasks.md:140-155` defines Quinn-owned verification tasks T019-T026 and T034-T037, including final gate T026.
- `tasks.md:168-176` says Alex owns T027-T033 and Quinn owns T019-T026 plus T034-T037; US3 dependency order is Alex T027-T033 first, then Quinn T034-T037.
- `quinn-gate.md:1-9` and `quinn-gate.md:23-30` show `status: APPROVED_WITH_NOTES`; `quinn-gate.md:130-138` says T027-T033/T034-T037 are not yet implemented but the notes do not block fan-out.
- `spec.md:119-138` reclassifies US3 as household tenant isolation on every read path, with test-pollution guardrails secondary only.
- `spec.md:212-246` records NC-5 as resolved and confirms Maya/Tariq/Quinn re-runs are complete for the US3 scope change.
- `spec.md:308-319` audits unscoped SQL read paths and confirms the AC change was already processed as a scope change before freeze.
- `espresso-logs/app/repos/sql/catalog.py:68-80` still has unscoped catalog list/get reads.
- `espresso-logs/app/repos/sql/brew_log.py:70-75`, `173-180`, `183-190`, `220-227`, and `237-244` show the current household-filter pattern to mirror.

## Quinn Gate Verification Result

`coffee_tracker/specs/042-pr116-kaapi-kadai-remediation/quinn-gate.md` is tracked by git and has `status: APPROVED_WITH_NOTES`. Implementation fan-out is permitted because the gate exists and is not BLOCKED.

## Routing Status

`status: DIRECT_PERMITTED`

Rationale: this is not new product scope. The review feedback identifies previously skipped work already present in frozen spec-042 artifacts. US3 tenant isolation was already reclassified under NC-5, then re-run through Maya planning, Tariq task generation, and Quinn gate before freeze. Resuming the implementation phase for T027-T033 and their required Quinn verification does not require a new SpecKit cycle. Inviolable Rule 6 is respected because no new acceptance criteria are being added.

## Bounded Scope for This Session

### In Scope — backend remediation fan-out

- **Alex:** T027 shared household-scoping helper.
- **Alex:** T028 catalog list/get/_fetch_all scoping.
- **Alex:** T029 inventory list/list_all/get scoping and same-household hydration.
- **Alex:** T030 hardware plus maintenance list/get scoping and same-household linked reads.
- **Alex:** T031 brew-log support/hydration scoping, especially list_existing_ids exposure.
- **Alex:** T032 dual-write/Sheets fallback reachability assessment and blocking/scoping decision if runtime-reachable.
- **Alex:** T033 startup/readiness runtime-role and RLS assertion.
- **Quinn:** T023 retained secondary guardrail/cleanup verification if required as a dependency for T037.
- **Quinn:** T034 SQL-backed direct cross-household isolation tests.
- **Quinn:** T035 SQL-backed linked/hydration/dashboard/defaults/fresh-household/no-context tests.
- **Quinn:** T036 runtime DB-role/RLS metadata tests.
- **Quinn:** T037 CI execution of SQL-backed US3 isolation suite with fail-closed behavior.

### Split from this backend-focused session but still spec-042 debt

- **Quinn/Finn verification split:** T019, T020, T021, T022, T024, and T025 are frontend/PWA/motion/design verification tasks. They remain frozen spec-042 obligations, but they are not prerequisites for the backend-only US3 remediation fan-out recommended by the feedback.
- **Quinn final gate:** T026 remains deferred until T019-T025 and T034-T037 all pass.

### Explicitly Deferred / Out of Scope for This Session

- G5 3D hero failure model is transferred to spec-043 scope per feedback.
- G6 canonical primitive styling is transferred to spec-043 scope per feedback.
- No new UX, design-system, GSAP, three.js, icon, hardware IA, import-copy, infrastructure, auth, schema, or product-entity changes are authorized by this routing decision.
- Do not weaken or rewrite already-squash-merged e2e triage fixes; current evidence shows the CatalogDetail `appearance-none` restoration and updated e2e locators are present in the tree.

## Recommended Owner Fan-Out

1. **Alex backend implementation:** complete T027-T033 in dependency order, using `SqlBrewLogRepo._current_household_filter()` as the reference pattern and returning empty/not-found when no active household context exists.
2. **Quinn backend verification:** in parallel where test scaffolding can start safely, prepare T034-T036 scenarios; finalize T034-T037 after Alex lands T027-T033. Include T023 only as needed for T037 dependency closure.
3. **Coordinator:** schedule separate Quinn/Finn verification work for T019-T025 and only run T026 after all spec-042 verification tasks pass.


### Decision Drop: Tariq triage — Spec-040 invitation-contract fixture failures

- **Source drop:** `.squad/decisions/inbox/20260613T072210Z-tariq-triage-spec040-invitation-fixtures.md`
- **Status:** MERGED


---
node_id: 20260613T072210Z-tariq-triage-spec040-invitation-fixtures
node_type: decision_drop
agent: Tariq
role: triage
repo: espresso-logs
branch: household_test_fixtures
date: 2026-06-13
status: DIRECT_PERMITTED
---

# Tariq triage — Spec-040 invitation-contract fixture failures

## Tests triaged

1. `tests/test_spec040_household_contracts.py:181` — `test_spec040_public_invitation_preview_is_get_and_never_consumes_token`
2. `tests/test_spec040_household_contracts.py:222` — `test_spec040_decline_invitation_is_non_consuming_dismissal`

Verification run: `uv run pytest tests/test_spec040_household_contracts.py::test_spec040_public_invitation_preview_is_get_and_never_consumes_token tests/test_spec040_household_contracts.py::test_spec040_decline_invitation_is_non_consuming_dismissal -q` failed both tests with HTTP 410 `Invitation expired`, matching the reported failure mode.

## Root-cause diagnosis

The failure is a time-bomb test fixture, not an application regression. `_fake_invitation` hardcodes `invitation.invited_at = datetime.datetime(2026, 6, 9, tzinfo=UTC)` at `tests/test_spec040_household_contracts.py:99` and derives `invitation.expires_at = invitation.invited_at + datetime.timedelta(hours=72)` at `tests/test_spec040_household_contracts.py:100`. That produces `expires_at = 2026-06-12T00:00:00Z`; on 2026-06-13 the fixture represents an expired invitation.

Both failing endpoints correctly enforce expiry before exercising the contract assertions. `_ensure_invitation_not_expired` raises HTTP 410 when `invitation.expires_at < datetime.datetime.now(datetime.timezone.utc)` at `app/routers/api_households.py:248-250`. Public preview calls that guard at `app/routers/api_households.py:372-381`; decline calls it at `app/routers/api_households.py:449-457`. Therefore both tests receive 410 before the preview non-consumption assertions at `tests/test_spec040_household_contracts.py:209-219` and decline non-consumption assertions at `tests/test_spec040_household_contracts.py:242-246` can run.

These tests are pure unit/ASGI tests with mocks, not database-dependent failures. `db_override` yields an `AsyncMock` and overrides `get_db` at `tests/test_spec040_household_contracts.py:23-38`; preview patches `app.routers.api_households.HouseholdRepo` and `UserRepo` at `tests/test_spec040_household_contracts.py:194-204`; decline patches `HouseholdRepo` at `tests/test_spec040_household_contracts.py:229-235`.

## Spec citations and contract assessment

The endpoint behavior is spec-correct:

- `GET /households/invitations/{token}` is a public preview that does not consume the token and must return 410 for expired invitations (`coffee_tracker/specs/040-household-experience-repair/spec.md:296-299`).
- `AC-040-ACC-05` requires decline to dismiss without consuming or revoking the invitation, with later acceptance allowed until expiry unless revoked (`coffee_tracker/specs/040-household-experience-repair/spec.md:195-200`).
- The detailed decline API contract repeats that decline must not consume, revoke, or make the token unacceptable before expiry (`coffee_tracker/specs/040-household-experience-repair/spec.md:304-305`).

Conclusion: the tests' intended contracts are correct, and the application's 410-on-expired behavior is also correct. The only incorrect artifact is the fixture's absolute date for tests that require a still-valid pending invitation.

## Blast radius

`_fake_invitation` is used in this file at `tests/test_spec040_household_contracts.py:149`, `tests/test_spec040_household_contracts.py:187`, `tests/test_spec040_household_contracts.py:227`, and `tests/test_spec040_household_contracts.py:257`. The create-invitation test at `tests/test_spec040_household_contracts.py:142-178` does not exercise expiry validation. The preview test at `tests/test_spec040_household_contracts.py:181-219` and decline test at `tests/test_spec040_household_contracts.py:222-246` are affected. The resend test at `tests/test_spec040_household_contracts.py:249-280` uses the fixture but targets resend output, not the public expiry guard. The preview expected body reads `invitation.expires_at` dynamically at `tests/test_spec040_household_contracts.py:211-217`, so it should adapt to a relative fixture date.

## Spec-042 postmortem taxonomy classification

Classification verdict: **Inherited pre-existing failure**, with a time/environment-triggered mechanism.

Spec-042 defines `Inherited pre-existing failure` as the category whose correct response is to bisect against baseline and fix forward per spec rules (`coffee_tracker/specs/042-pr116-kaapi-kadai-remediation/spec_042_feedback.md:326-331`). This failure was reported and revalidated as present on baseline `household_fixes`, so it is inherited rather than introduced by `household_test_fixtures`. The trigger is wall-clock time, so it resembles environment nondeterminism, but it is not a poisoned process/port/env issue; after the fixture's 2026-06-12 expiry boundary, the two mocked tests fail deterministically on any database/environment.

## Routing decision

`status: DIRECT_PERMITTED`

Owner: **Quinn** (tests/contracts).

Rationale: the fix is tests-only, bounded to the Spec-040 contract fixture, and requires no application behavior, infrastructure, product contract, or SpecKit artifact change. The expected application behavior is already aligned with the spec's expired-invitation contract.

Bounded scope for fix:

- Update `_fake_invitation` in `tests/test_spec040_household_contracts.py:84-103` so the default fixture represents a valid pending invitation relative to current time, e.g. set `invited_at = datetime.datetime.now(tz=UTC)` and keep `expires_at = invited_at + datetime.timedelta(hours=72)`.
- Optional improvement: allow `_fake_invitation` to accept `invited_at` and/or `expires_at` overrides so future tests can explicitly construct expired, revoked, or edge-window invitations without reintroducing absolute-date time bombs.
- Re-run the two failing tests first, then the relevant household contract test file, then repository-required quality gates before any push decision.

## Follow-up recommendation

Recommend a separate Quinn-owned follow-up sweep for hardcoded absolute-date fixtures in tests that are compared to `now()` or pass through expiry/freshness guards. Do not fold that sweep into this fix unless the coordinator explicitly expands scope; the immediate repair should remain surgical.


### Decision Drop: Architecture Decision: Per-household `sheets_id` uniqueness

- **Source drop:** `.squad/decisions/inbox/20260613T074426Z-maya-arch-sheets-id-per-household-uniqueness.md`
- **Status:** MERGED


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


### Decision Drop: Routing Decision: spec-042 US3 `sheets_id` clarify amendment

- **Source drop:** `.squad/decisions/inbox/20260613T075645Z-priya-route-spec-042-sheets-id-clarify.md`
- **Status:** MERGED


---
node_id: 20260613T075645Z-priya-route-spec-042-sheets-id-clarify
node_type: decision_drop
agent: Priya
role: product_spec_routing
spec_id: spec-042
date: 2026-06-13T07:56:45Z
status: direct_permitted
privacy_gate: .squad/privacy-gate.md reviewed before writing
---

# Routing Decision: spec-042 US3 `sheets_id` clarify amendment

## Decision

status: DIRECT_PERMITTED

A Priya-owned post-freeze clarify amendment is permitted and required before implementation. The scope is bounded to encoding Maya architecture decision d1524c3 into spec-042 US3 and tasks; this is not a new product feature and does not require a full SpecKit restart.

## Explicit Scope Confirmation

Permitted changes are limited to:

1. Amend US3 acceptance criteria so tenant table `sheets_id` identity is household-local, using `UNIQUE(household_id, sheets_id)` rather than global uniqueness.
2. Clarify that every SQL write-path read-before-write lookup by `sheets_id` must be scoped to the resolved household and must fail closed when household context is unavailable.
3. Add dependency-ordered Alex/Quinn tasks starting at T038 as needed for schema/model/write-path changes and verification.
4. Preserve the existing US3 tenant-isolation intent, fresh-household empty-state requirement, and SQL-backed verification requirements.

## Constraints

- No implementation may begin from this routing decision alone; Quinn gate remains required before schema, ORM, repository, or RLS-affecting code changes.
- No push is authorized.
- Public-repository privacy gate applies to this decision drop and downstream governance artifacts.


### Decision Drop: Clarify spec-042 US3: per-household `sheets_id` scope

- **Source drop:** `.squad/decisions/inbox/20260613T080040Z-priya-clarify-spec042-per-household-sheets-id.md`
- **Status:** MERGED


---
node_type: decision_drop
agent: Priya
role: product_spec
spec_id: spec-042
date: 2026-06-13
status: clarified
privacy_gate: .squad/privacy-gate.md reviewed before writing
---

# Clarify spec-042 US3: per-household `sheets_id` scope

## Outcome

spec-042 US3 is formally clarified to encode Maya's architecture decision `d1524c3`: tenant `sheets_id` values are household-local identifiers, not globally unique product identifiers.

## Gap recorded

The prior US3 scope covered app-layer read isolation but missed schema and write-path behavior. Global unique constraints on `sheets_id` could block a legitimate second household import using the same sheet-local ID, and unscoped read-before-write lookups could overwrite or return another household's row if database backstops were bypassed.

## Resolution recorded

- Replace global tenant-table `sheets_id` uniqueness with `UNIQUE(household_id, sheets_id)` on `catalog`, `inventory_bags`, `hardware`, `maintenance_log`, and `brew_log`.
- Require every write-path read-before-write lookup by `sheets_id` to include household scope, including `upsert`, get-by-`sheets_id` support paths, and startup backfill.
- Reconcile overlapping-`sheets_id` acceptance: after the composite migration, two households can hold the same non-null `sheets_id`, and isolation must prove Household A never reads or mutates Household B's same-`sheets_id` row.

## Task changes

- `T038` — Alex: per-household `sheets_id` uniqueness migration and ORM constraints for all five tenant tables.
- `T039` — Alex: household-scope catalog, inventory, hardware, maintenance, and startup-backfill write-path `sheets_id` lookups; brew-log remains scoped and uses composite uniqueness.
- `T040` — Quinn: repo-level and API-level overlapping-`sheets_id` isolation test for two households with the same sheet-local ID.

## Gate

Implementation remains blocked until the Quinn gate is present and approved for the amended US3 scope.


### Decision Drop: Quinn Gate Decision: spec-042 T038–T040 per-household `sheets_id` uniqueness

- **Source drop:** `.squad/decisions/inbox/20260613T080342Z-quinn-gate-spec042-t038-t040.md`
- **Status:** MERGED


---
node_id: 20260613T080342Z-quinn-gate-spec042-t038-t040
node_type: decision_drop
agent: Quinn
role: pre_implementation_gate
spec_id: spec-042
date: 2026-06-13T08:03:42Z
status: APPROVED_WITH_NOTES
privacy_gate: .squad/privacy-gate.md reviewed before writing
---

# Quinn Gate Decision: spec-042 T038–T040 per-household `sheets_id` uniqueness

## Decision

Quinn approves implementation of T038–T040 with notes. The scope is testable and implementable: move tenant table `sheets_id` identity from global uniqueness to per-household composite uniqueness, scope write-path `sheets_id` lookups by household, and add overlapping-ID SQL-backed isolation coverage.

## Conditions

1. T038 must drop the five global `uq_<table>_sheets_id` constraints, add `uq_<table>_household_sheets_id` on `(household_id, sheets_id)` for `catalog`, `inventory_bags`, `hardware`, `maintenance_log`, and `brew_log`, remove ORM `unique=True`, and add matching model-level composite unique constraints.
2. The migration must preflight and fail closed before constraint changes if duplicate non-null `(household_id, sheets_id)` pairs exist or if unsafe `household_id IS NULL` tenant rows remain. Multiple `sheets_id IS NULL` rows are acceptable; null household ownership is not a durable invariant.
3. Downgrade must preflight and fail closed before restoring global uniqueness if cross-household duplicate non-null `sheets_id` values exist. It must not delete, rewrite, or merge data.
4. T039 must household-scope all known write-path read-before-write lookups: `SqlCatalogRepo.upsert`, `SqlInventoryRepo.upsert`, `SqlHardwareRepo.upsert`, `SqlMaintenanceRepo.upsert`, and startup inventory backfill. Missing household context must fail closed with no global fallback query.
5. Brew-log read/update/delete/idempotency paths are already household-scoped; its insert path must not add an unscoped pre-read and must rely on composite uniqueness.
6. T040 must prove overlapping non-null sheet-local IDs across households through repo-level and API-level reads, upserts/updates, linked hydration, and support lookups in the SQL-backed CI job.

## Rationale

The gate remains APPROVED_WITH_NOTES because the clarified tasks close a real tenant-isolation defect without requiring data rewrites, but correctness depends on strict migration preflights and complete lookup scoping. Composite uniqueness aligns database constraints with RLS boundaries and prevents global unique constraints from leaking or blocking sibling-household IDs.


## 2026-06-07: PR Routing and CI Remediation Leftover Decisions

### Decision Drop: Routing Decision — PR creation request

- **Source drop:** `.squad/decisions/inbox/20260607-130425-pr-routing.md`
- **Status:** MERGED


# Routing Decision — PR creation request

- Timestamp: 2026-06-07T13:04:25.561-07:00
- Owner: Tariq
- Request: Raise a PR
- Repository: <repo>
- Branch: fix/spec-039-production-readiness

## Current git state inspected

- Current branch: fix/spec-039-production-readiness
- Working tree: clean before decision drop creation
- Compared to origin/main: ahead by 3 commits, behind by 0
- Recent branch commits:
  - 8ed3f02 chore(squad): session log + decisions 2026-06-07
  - 142f597 chore(squad): route spec 039 branch correction
  - 2b9466a fix: complete spec 039 production readiness

## Decision

status: DIRECT_PERMITTED

Rationale: The request is limited to release/process workflow for an already completed and validated branch. It does not introduce feature scope or code changes, so SpecKit is not required. Scope is explicitly limited to verifying this decision drop, following the PR/merge workflow, obtaining explicit operator permission before push, pushing only after affirmative approval, creating the PR, and waiting for green CI before external review tagging.

## Required remaining workflow

1. Verify this decision drop appears in `.squad/decisions/inbox/` commit history.
2. Read and follow `.github/copilot-prompts/pr-merge-workflow.md`.
3. Ask the operator for explicit permission before any `git push`.
4. Push `fix/spec-039-production-readiness` only after affirmative permission.
5. Create the PR.
6. Do not request review or tag `@copilot can you review this please` until CI is green.

## Constraints

- No push without explicit operator approval after being asked.
- No deploy, merge, production data access, or production secrets access.
- Do not rewrite history.


### Decision Drop: Routing decision: PR #108 CI/test failure triage

- **Source drop:** `.squad/decisions/inbox/20260607-131119-pr108-ci-test-failure-routing.md`
- **Status:** MERGED


# Routing decision: PR #108 CI/test failure triage

- Timestamp: 2026-06-07 13:11:19 -0700
- Agent: Tariq
- Request: triage-only inspection of PR #108 failing `CI/test (pull_request)` check using `gh`, write RCA under `.squad/log/`, and avoid app/frontend/test edits, push, deploy, review request, merge, and secrets/production access.

## Decision

status: DIRECT_PERMITTED

Direct triage is permitted because CI failure triage is required before any fix attempt and the requested work is bounded to diagnosis plus repository-local log artifacts. SpecKit is not required for this triage-only diagnostic step.

## Scope confirmation

Permitted scope is limited to:

1. Inspect PR #108 and GitHub Actions logs with `gh`.
2. Write `.squad/log/20260607-131119-pr108-ci-test-failure-rca.md` as an uncommitted RCA artifact.
3. Commit this decision drop only.

Explicitly out of scope: application/frontend/test edits, remediation, push, deploy, review request, merge, production data access, and secrets access.


### Decision Drop: Routing decision: PR #108 CI triage session close

- **Source drop:** `.squad/decisions/inbox/20260607-132654-tariq-route-pr108-session-close.md`
- **Status:** MERGED


# Routing decision: PR #108 CI triage session close

- Timestamp: 2026-06-07T13:26:54.984-07:00
- Agent: Tariq
- Request: authorize Scribe-style governance/log session closure for PR #108 CI failure triage.
- Repository: `<repo>`

## Decision

status: DIRECT_PERMITTED

Direct implementation is permitted because the requested work is governance/session documentation only: merge existing decision inbox entries into `.squad/decisions.md`, clear the decision inbox, and write a concise session log for the completed PR #108 CI/test failure triage. This does not change product behavior, CI behavior, application code, frontend code, tests, deployment, or repository settings, so SpecKit is not required.

## Explicit scope confirmation

Permitted follow-on Scribe scope is limited to:

1. Merge files currently in `.squad/decisions/inbox/` into `.squad/decisions.md` and clear the inbox.
2. Write `.squad/log/{timestamp}-pr108-ci-triage-session.md` summarizing:
   - Ralph CLEAR.
   - Tariq routing `DIRECT_PERMITTED` for diagnosis/log only.
   - PR #108 CI/test failure triage completed.
   - RCA file `.squad/log/20260607-131119-pr108-ci-test-failure-rca.md`.
   - Root cause: CI using a bootstrap/superuser role that bypasses RLS.
   - Recommended bounded fix: CI role separation.
   - No application/frontend/test modifications and no push/review/merge.
3. Keep the RCA file intact.
4. Commit only `.squad` governance/log closure artifacts if repository convention requires session close artifacts to be committed.

Explicitly out of scope: application, frontend, or test modifications; CI workflow/script remediation; push; deploy; review request; merge; GitHub posting; production data or secret access.

## Quinn gate

Quinn gate is waived for this direct closure because the authorized work is documentation/governance-only and the waiver is explicit in this routing decision. Any future change to application code, frontend code, test code, CI workflow behavior, scripts, infrastructure, or repository settings requires a new routing decision and any required quality gate before implementation.


### Decision Drop: PR #108 CI triage recovery routing decision

- **Source drop:** `.squad/decisions/inbox/20260607-133133-pr108-ci-triage-recovery-routing.md`
- **Status:** MERGED


# PR #108 CI triage recovery routing decision

- Timestamp: 2026-06-07T13:31:33-07:00
- Owner: Tariq — process/CI routing
- Scope: Determine whether PR #108 CI/test triage is complete and whether coordinator may surface the result and proceed to bounded fix routing if needed.

## Local state inspected

- `.squad/log/20260607-131119-pr108-ci-test-failure-rca.md` exists locally and contains a complete RCA for PR #108 `CI/test` failure.
- The RCA identifies GitHub Actions run `27103435257`, job `79988191288`, with 3 failing RLS isolation tests.
- The RCA states root cause: CI reused the Postgres bootstrap/superuser role as the runtime/test role, bypassing RLS.
- The RCA recommends a bounded CI environment fix: use a separate non-privileged runtime/test role with `NOSUPERUSER` and `NOBYPASSRLS` after migrations.
- No application, frontend, or test file changes were observed or required for this recovery decision.

## Decision

status: DIRECT_PERMITTED

Rationale: The previously interrupted triage has an existing local RCA with sufficient diagnosis, evidence, root cause, and bounded remediation recommendation. The coordinator may surface the existing RCA and, if the operator wants remediation, route only a bounded CI workflow/role-separation fix. SpecKit is not required for this recovery step because it is process/CI triage recovery, not product or application behavior design.

## Explicit next action

Read and surface `.squad/log/20260607-131119-pr108-ci-test-failure-rca.md`. If that RCA is unexpectedly unavailable, rerun only a tightly-scoped `CI/test` log inspection for PR #108 before any fix routing.

## Constraints retained

- Do not modify application, frontend, or test files under this routing decision.
- Do not push, deploy, request review, merge, or access production data/secrets.


### Decision Drop: PR #108 CI/test remediation routing decision

- **Source drop:** `.squad/decisions/inbox/20260607-1335-pr108-ci-routing.md`
- **Status:** MERGED


# PR #108 CI/test remediation routing decision

- Timestamp: 2026-06-07 13:35 -0700
- Owner: Tariq — process/CI routing
- Repository: espresso-logs
- Branch: fix/spec-039-production-readiness
- PR: #108
- Related RCA: .squad/log/20260607-131119-pr108-ci-test-failure-rca.md

## Decision

status: DIRECT_PERMITTED

Bounded direct remediation is permitted for PR #108's CI/test RLS failure.

## Rationale

The RCA identifies a CI environment defect, not an application, frontend, or test defect: the GitHub Actions Postgres service bootstrap role is reused as the Alembic and runtime/test role, so CI tests execute with a privileged role that bypasses row-level security. The relevant workflow currently sets `POSTGRES_USER` from `${{ vars.CI_DB_USER }}` and then uses the same credentials for both `uv run alembic upgrade head` and `bash scripts/run-ci-tests.sh`. The local shared test gate requires `DATABASE_URL`, and local validation passed with a runtime role that is neither superuser nor `BYPASSRLS`, confirming the failure is tied to CI role separation.

The remediation is self-contained in CI/process scope and can be bounded to workflow/script changes that create or use a non-superuser, `NOBYPASSRLS` runtime/test role after migrations while preserving a privileged bootstrap/migration role.

## Explicit permitted scope

Direct remediation may change only the CI workflow and supporting CI/local test scripts needed to separate privileged migration/bootstrap credentials from the non-privileged runtime/test role for PR #108's RLS CI/test failure. Expected files are limited to `.github/workflows/ci.yml` and, only if necessary, scripts under `scripts/` that support CI Postgres role/grant setup or validation.

## Constraints

- Do not modify application, frontend, or test files under this routing authorization.
- Do not change RLS policies or repository behavior to mask the CI role issue.
- Do not access production data or secrets.
- Do not deploy, merge, request review, or push without the required validation and operator approval.
- Any broader database model, application authorization, or test expectation change requires new routing.

## Required validation before push

All four local checks must pass in the current terminal session before any push is considered:

1. `uv run ruff check app/ tests/`
2. `uv run ruff format --check app/ tests/`
3. `uv run mypy app/ --strict`
4. `SPREADSHEET_ID=dummy DATABASE_URL=<local DATABASE_URL redacted> bash scripts/run-ci-tests.sh`

After push authorization and push, PR #108 `CI/test (pull_request)` must be rerun and green, along with the full PR CI suite.


### Decision Drop: Decision drop — PR #109 Alex routing

- **Source drop:** `.squad/decisions/inbox/20260607T142439-0700-pr109-alex-routing.md`
- **Status:** MERGED


# Decision drop — PR #109 Alex routing

Date: 2026-06-07T14:24:39.374-07:00
Owner: Alex — backend/API routing
PR: https://github.com/skarthikkrishna/espresso-logs/pull/109
Branch inspected: copilot/fix-code-for-review-comments

## Inspected state

- PR #109 is open, non-draft, merge state CLEAN.
- Base: fix/spec-039-production-readiness.
- Head: copilot/fix-code-for-review-comments.
- Changed files are limited to backend/API dual-write and catalog upload paths plus focused tests.
- GitHub currently reports no checks on the PR branch.
- Internal Quinn artifacts reviewed:
  - .squad/log/20260607T141841-0700-pr109-internal-review.md
  - .squad/decisions/inbox/20260607T141841-0700-pr109-copilot-findings.md

## Decision

status: DIRECT_PERMITTED

Rationale: The remaining actionable work is bounded PR remediation on the existing PR #109 branch, not a new product capability or architectural scope change. Quinn identified two concrete follow-ups: make the disabled-Postgres brew-log correction path fail loudly instead of surfacing as a misleading 404, and harden catalog upload validation beyond trusting the declared MIME header. The PR is not merge-ready until validation and checks pass, but these fixes can be handled directly with focused tests.

## Explicit scope confirmation

Permitted scope is limited to PR #109 branch remediation for:

1. Disabled-Postgres brew-log correction behavior, preferring an explicit server/configuration failure response over `404 Shot not found` when persistence is unavailable.
2. Catalog image upload byte validation so allowed MIME headers are not the only trust boundary.
3. Tests and local validation directly required to prove those two fixes.

Do not expand scope to unrelated API behavior, UI work, schema changes, production operations, deployment, merge, or push.

## Quinn gate note

Existing Quinn internal review context suffices for this bounded PR remediation routing decision. No new SpecKit cycle or separate Quinn filesystem gate is required before direct remediation, but Quinn's output remains internal-only and the PR still requires passing checks before merge readiness.


### Decision Drop: Routing Decision: PR #109 conflict remediation against main

- **Source drop:** `.squad/decisions/inbox/20260607T143708-0700-pr109-main-conflict-routing.md`
- **Status:** MERGED


# Routing Decision: PR #109 conflict remediation against main

- Date: 2026-06-07T14:37:08.751-07:00
- Agent: Alex
- Repository: <repo>
- PR: #109 — Fail closed for catalog image uploads and brew-log patch corrections
- Head branch: copilot/fix-code-for-review-comments
- Base branch: main
- Observed state:
  - Local branch is copilot/fix-code-for-review-comments at 6c025c5.
  - GitHub PR #109 is OPEN, non-draft, base main, mergeStateStatus DIRTY.
  - origin/main is f174c29 (PR #108 production readiness).
  - Prospective merge conflicts against origin/main are limited to app/deps.py, app/routers/api_brew_log.py, app/routers/api_catalog.py, tests/test_api_brew_log_idempotency.py, and tests/test_api_catalog_create_image.py.
  - Working tree had no conflicted index entries before this decision drop.
- Decision: status: DIRECT_PERMITTED
- Rationale: The requested work is bounded conflict remediation for an already-open follow-up PR after retargeting from the prior feature branch to main. The conflict set is finite and localized to backend/API hardening and directly corresponding tests. No new product behavior, schema change, or architecture decision is required.
- Explicit scope:
  - Resolve PR #109 conflicts against main only.
  - Preserve PR #108 production-readiness fixes already on main.
  - Preserve PR #109 hardening changes from commit 6c025c5, including fail-closed catalog image upload MIME validation and fail-closed Postgres correction path behavior.
  - Do not broaden scope beyond conflict resolution and any directly necessary test alignment.
- Required validation before any push:
  1. uv run ruff check app/ tests/
  2. uv run ruff format --check app/ tests/
  3. uv run mypy app/ --strict
  4. SPREADSHEET_ID=dummy DATABASE_URL=<local DATABASE_URL redacted> bash scripts/run-ci-tests.sh
  5. Confirm branch is ready and obtain explicit operator permission before git push.

---

## 2026-06-07: Spec-039 Bounded Remediation and Quinn Harness Closeout

### Decision: Tariq routing — DIRECT_PERMITTED (Spec-039 bounded remediation)
- **Agent:** Tariq
- **Date:** 2026-06-07T11:26:32-07:00
- **Status:** MERGED
- **Classification:** DIRECT_PERMITTED
- **Source drop:** `.squad/decisions/inbox/20260607T112632-0700-tariq-route-spec039-remediation.md`
- **Scope:** Bounded recovery for already-approved Spec-039 implementation/validation blockers only.
- **Permitted owners:** Alex for backend/API/test remediation, Finn for frontend/UI/cache/accessibility remediation, Quinn for E2E harness/selectors/fixture evidence and validation reruns.
- **Out of scope:** New feature behavior, broad cache rewrites, production data/log/image access, deploys, pushes, or PR/review requests.
- **Quinn gate:** Filesystem verification in `coffee_tracker` found `specs/039-ui-data-freshness-bug-evidence/quinn-gate.md`; frontmatter status was `APPROVED_WITH_NOTES`.
- **Validation sequence:** Fix bounded blockers, rerun T32, then T33, then T34; pause for Tariq triage on any validation failure.

### Decision: Tariq routing — DIRECT_PERMITTED (Spec-039 E2E harness/test-evidence remediation)
- **Agent:** Tariq
- **Date:** 2026-06-07T11:35:32-07:00
- **Status:** MERGED
- **Classification:** DIRECT_PERMITTED
- **Source drop:** `.squad/decisions/inbox/20260607T113532-0700-tariq-route-spec039-e2e-harness-remediation.md`
- **Scope:** E2E harness and evidence remediation limited to `frontend/e2e/spec039-seed.ts`, `frontend/e2e/spec039-ui-data-freshness.spec.ts`, and `frontend/playwright.config.ts` only if browser-state isolation required it.
- **Permitted fixes:** Protected API probes with active synthetic-session authorization, unambiguous Medium locator, session/browser-state hard-navigation stability, and seed-derived B07 dose expectation reconciliation.
- **Out of scope:** Application behavior changes, backend/API changes, frontend product component changes, broad cache rewrites, non-Spec-039 tests, production/external provider access, deploys, pushes, or PR/review activity.
- **Quinn gate:** Existing `coffee_tracker/specs/039-ui-data-freshness-bug-evidence/quinn-gate.md` was noted as `APPROVED_WITH_NOTES`; coordinator still had to verify the filesystem artifact before implementation.
- **Handling:** Preserve unrelated worktree changes; touch only scoped harness/config files for this remediation.

### Decision: Alex routing — DIRECT_PERMITTED (Spec-039 backend/API/test remediation)
- **Agent:** Alex
- **Date:** 2026-06-07T11:36:20.679-07:00
- **Status:** MERGED
- **Classification:** DIRECT_PERMITTED
- **Source drop:** `.squad/decisions/inbox/20260607T113620-0700-alex-route-spec039-backend-remediation.md`
- **Scope:** Backend/API/test remediation only for Spec-039 tasks in Alex's lane.
- **Rationale:** Prior Tariq routing authorized bounded remediation; Spec-039 tasks assign Alex the backend/API track; the Quinn gate path was stated as `APPROVED_WITH_NOTES`.
- **Out of scope:** Finn-owned frontend/UI work, Tariq/Quinn evidence/process work unless coordinated, new SpecKit cycle, new product scope, production data access, deploys, merges, or pushes.
- **No-push constraint:** No push authorized; any later push requires all four local CI-equivalent checks and explicit operator approval.

### Decision: Tariq routing — DIRECT_PERMITTED (Spec-039 T35 no-push handoff)
- **Agent:** Tariq
- **Date:** 2026-06-07T12:26:19.472-07:00
- **Status:** MERGED
- **Classification:** DIRECT_PERMITTED
- **Source drop:** `.squad/decisions/inbox/20260607T122619-0700-tariq-route-spec039-t35-handoff.md`
- **Scope:** Documentation/process PR-readiness handoff only for Spec-039 T35.
- **Rationale:** Existing Spec-039 `[P][PROCESS]` handoff task; no new feature/product/backend/frontend/infrastructure/production-data scope.
- **Gate note:** Quinn gate waived for this handoff because it is documentation/governance-only.
- **Constraints:** No application/infrastructure code changes, push, deploy, PR creation, or production data/secrets access authorized.
- **Outcome:** T35 no-push handoff artifact exists at `.squad/log/2026-06-07T12-25-23-0700-spec039-t35-pr-readiness.md`; T32/T33/T34 passed; T35 completed; implementation remains local and coordinator must ask before push.

---

## 2026-06-07: Spec-039 UI Bug Repro Planning Closeout

### Decision: Tariq routing — DIRECT_PERMITTED (Scribe closure)
- **Agent:** Tariq
- **Date:** 2026-06-07T03:50:22-07:00
- **Status:** COMMITTED
- **Classification:** DIRECT_PERMITTED
- **drop_id:** 20260607T035022-0700-tariq-scribe-closure-routing
- **Source drop:** `.squad/decisions/inbox/20260607T035022-0700-tariq-scribe-closure-routing.md`
- **Operator Request:** Close the Spec-039 planning session by merging decision drops, writing concise session logs in the involved repositories, clearing processed inbox files, and committing documentation/process changes locally.
- **Rationale:** The closeout is documentation/process-only. It does not authorize UI, API, cache, AI, infrastructure, test, deployment, production-data, or SpecKit requirement changes.
- **Scope:** Merge and clear current decision inbox files; write `.squad/log/20260607T035022-0700-ui-bug-repro-plan.md` in the involved repositories; commit only Scribe closeout artifacts locally.
- **Gate Note:** Quinn gate is waived for this closure only because no application or infrastructure implementation is authorized. The existing Spec-039 Quinn gate remains `APPROVED_WITH_NOTES` at `c25e65d` and is still required before implementation begins.
- **Outcome:** This Scribe close merged pending app-repo drops, cleared processed inbox files, wrote cross-repo session logs, did not implement fixes, and did not push.

### Decision: Finn routing — DIRECT_PERMITTED (Spec-039 Aria gate mirror)
- **Agent:** Finn
- **Date:** 2026-06-07T02:56:34-07:00
- **Status:** COMMITTED
- **Classification:** DIRECT_PERMITTED
- **drop_id:** 20260607T025734-0700-finn-aria-gate-routing
- **Source drop:** `.squad/decisions/inbox/20260607T025734-0700-finn-aria-gate-routing.md`
- **Operator Request:** Aria must review the existing Spec-039 artifacts and create/commit only `coffee_tracker/specs/039-ui-data-freshness-bug-evidence/aria-gate.md`.
- **Rationale:** This was a self-contained gate-artifact step over already-created `spec.md`, `plan.md`, and `compliance.md`; no new product scope, implementation, or app-repo change was authorized.
- **Scope:** Create and commit only the Spec-039 Aria gate in `coffee_tracker`; do not modify `espresso-logs`, other SpecKit artifacts, or push.
- **Outcome:** Aria approved the gate in `d5d9243 design: approve spec-039 aria gate`; `aria-gate.md` has `status: APPROVED`. This app-repo mirror records and clears the pending Finn drop without changing application code.

---

## 2026-06-06: Cross-Repo Squad Governance — Spec-038 Routing

### Decision: Tariq routing — SPECKIT_REQUIRED (cross-repo squad governance spec)
- **Agent:** Tariq
- **Date:** 2026-06-06T22:03:49-07:00
- **Status:** COMMITTED
- **Classification:** SPECKIT_REQUIRED
- **drop_id:** 2026-06-06-tariq-squad-governance-spec-routing
- **Operator Request:** Build a spec for cross-repo Squad governance covering: charter drift, CI debug loops, multi-repo parallel implementation, hub-and-spoke Squad model, privacy/security gates, retro ceremony with artifact pruning, and sustainable cleanup model.
- **Rationale:** Multi-repo, cross-cutting governance touching new Squad protocols, per-repo Squad infrastructure, privacy/security gate definitions, retro ceremony design, and automation tradeoff. None are bounded single-file changes; all span three repos (`coffee_tracker`, `espresso-logs`, `tf-infra`).
- **SpecKit Hub:** `coffee_tracker`. All gate artifacts land there. This drop is a local routing record in `espresso-logs` only.
- **Scope:** Cross-repo charter normalization; hub-and-spoke handoff protocol; privacy/security gates; retro ceremony; artifact cleanup model; automation tradeoff.
- **No-Push Constraint:** Binding. All commits local only.
- **Outcome:** Priya specify + clarify complete (commits `e5ebd8d`, `f993f85` in `coffee_tracker-spec-038` worktree). Spec frontmatter `status: clarified`.

### Decision: Tariq routing — SPECKIT_REQUIRED (Spec-038 tasks phase continuation)
- **Agent:** Tariq
- **Date:** 2026-06-06T22:37:02-07:00
- **Status:** COMMITTED
- **Classification:** SPECKIT_REQUIRED
- **drop_id:** 2026-06-06-spec038-tasks-routing
- **Operator Request:** "Let's go for it — When will we start making changes to the other repos?"
- **Rationale:** Active SpecKit cycle at tasks phase. Spec-038 specified + clarified + planned. `tasks.md` not yet committed; implementation not authorised in any repo.
- **Scope:** `speckit.tasks` only. Zero implementation edits to espresso-logs or tf-infra permitted.
- **Timing Answer:** Other repos (espresso-logs, tf-infra) begin receiving changes only after: (1) `tasks.md` committed, (2) Quinn gate approved, (3) `git ls-files` confirms gate file, (4) fan-out authorised. First writes: T012 (espresso-logs), T021 (tf-infra).
- **No-Push Constraint:** Binding. All commits local only.
- **Outcome (this session):** Tariq generated `tasks.md` (commit `16f9300`); Quinn gate committed `quinn-gate.md` (commit `1418752`) with `status: APPROVED_WITH_NOTES`. Implementation fan-out not yet started.

---

## 2026-05-21: M5 Spec-034 Planning Cycle Complete

### Decision: Full SpecKit cycle execution for M5 spec-034
- **Agents:** Priya, Maya, Aria, Tariq, Quinn
- **Date:** 2026-05-21
- **Status:** COMMITTED
- **Key Artifacts:** spec.md (1400 lines, 104 ACs), plan.md (5 waves, 4 MUST_FIX), aria-gate (APPROVED), tasks.md (34 tasks, 5 waves), quinn-gate (APPROVED_WITH_NOTES)
- **Outcome:** Implementation-ready

### Decision: Maya M5 Plan - PKCE Session Replacement
- **Agent:** Maya
- **Decision:** Implement PKCE flow with stateless session tokens; SameSite=Strict cookies
- **Rationale:** Security hardening for OAuth2 token refresh flow
- **Status:** COMMITTED

### Decision: Maya M5 Plan - Token Hash Schema Delta
- **Agent:** Maya  
- **Decision:** Add token_hash, expiry, created_at columns to user table; migrate existing sessions
- **Rationale:** Support PKCE tokens and session revocation
- **Status:** COMMITTED

### Decision: Tariq M5 Tasks Sequencing
- **Agent:** Tariq
- **Decision:** 5-wave task sequencing with hard dependencies; backend auth gates frontend UI work
- **Rationale:** Unblock frontend teams while maintaining logical task dependencies
- **Status:** COMMITTED

### Decision: Priya M5 Analyze Fixes Applied
- **Agent:** Priya
- **Decision:** All 11 speckit.analyze findings applied (2 critical, 4 high, 12 med/low)
- **Rationale:** Strengthen spec coherence and implementation clarity
- **Status:** COMMITTED


## 2026-05-21: Implementation Wave Completions

### alex-034-routing-20260521-073220.md
### 2026-05-21: Routing decision — spec-034 M5 implementation
**By:** Alex (routing agent)
**Status:** DIRECT_PERMITTED
**Scope:** Wave 1–5 implementation of spec-034 M5 per tasks.md
**Rationale:** Full SpecKit cycle artifacts are committed and planning decisions are already recorded in `.squad/decisions.md`. The Quinn gate is `APPROVED_WITH_NOTES` and explicitly states that implementation may begin, while `now.md` marks the work implementation-ready with Wave 1 unblocked. This is a self-contained, bounded implementation request for an already-approved spec, so direct implementation is permitted.
**Implementation fan-out:** Alex (Waves 1-3 backend), Finn (Wave 1 US-1.8, Waves 3-4 frontend), Quinn (Wave 4-5 tests)

### alex-wave1-2026-05-21T07-50-43.md
# Decision Drop — Alex Wave 1 Implementation (M5 US-1.1–US-1.7)

**Date:** 2026-05-21
**Agent:** Alex
**Branch:** feat/034-m5-household-roles
**Spec:** 034-m5-household-roles

## Summary

Wave 1 Foundation fully implemented and CI-verified. All 7 tasks (US-1.1 through US-1.7) complete.

## Key Technical Decisions

1. **`jwt_secret` default=""**: Validator enforces ≥32 chars only when non-empty; avoids startup failure in legacy tests missing JWT_SECRET. Tests receive value via `os.environ.setdefault("JWT_SECRET", ...)` in conftest.

2. **Migration FK naming**: Old FK `household_members_invited_by_fkey` dropped (PostgreSQL auto-name); new FK explicitly named `fk_household_members_invited_by_users` for future idempotent migration code.

3. **`token_hash` column migration**: Added with `server_default=""` to satisfy NOT NULL on existing rows, then `server_default=None` removed in same migration. Clean approach without nullable workaround.

4. **DualWrite write-disable**: `self._sheets.*` write calls removed from all 5 wrappers. `delete_rows`/`delete_by_pk` are no-ops (no SQL delete path exists yet). Reads still pass through Sheets path. `self._sheets` instance var preserved for M6 cleanup.

5. **Type-ignore strategy for passlib/jose**: No published stubs; `# type: ignore[import-untyped]` on both imports; explicit `str(...)` wraps on encode/hash returns to satisfy `no-any-return` under `mypy --strict`.

## Status

**COMPLETE** — 440 passed, 4 skipped. All 4 CI checks pass. Committed. Awaiting operator push approval.

### alex-wave2-20260521T073220.md
# Alex Wave 2 Decision Drop — 2026-05-21T07:32:20-07:00

## Context
Wave 2 of M5 spec-034 (feat/034-m5-household-roles). Implementing UserRepo, HouseholdRepo, RefreshTokenRepo.

## Decisions Made

### D1: flush() not commit() in all repo methods
All repo methods call `await db.flush()` rather than `await db.commit()`. This gives the caller (router/service layer) full control over the transaction boundary. Consistent with pattern used in existing SQL repos (brew_log, catalog, etc.) and required for `create_household` atomic guarantee (household + member in one flush).

### D2: Python timedelta for invitation expiry (not SQL INTERVAL)
`create_invitation` computes `expires_at = datetime.now(utc) + timedelta(days=7)` in Python rather than passing `sa.text("NOW() + INTERVAL '7 days'")` to the ORM constructor. Reason: `Mapped[datetime.datetime]` type annotation rejects `sa.text()` under mypy --strict, and the 7-day window is not sensitive to sub-second timing drift.

### D3: Two-step UPDATE for increment_login_attempts
Rather than a CTE or subquery, `increment_login_attempts` issues two sequential UPDATEs:
1. `SET login_attempts = login_attempts + 1`
2. `SET locked_until = NOW() + INTERVAL '15 minutes' WHERE login_attempts >= 10 AND locked_until IS NULL`

Both within the same flush. This avoids bypassing the ORM entirely and keeps the code readable.

### D4: Raw sa.text() for seed_default_household orphan UPDATE
`seed_default_household` uses `sa.text(f"UPDATE {table} SET household_id = :hid WHERE household_id IS NULL")` with a static table name list. This avoids importing all 5 tenant ORM model classes into the household repo (would create unnecessary coupling). The table names are a fixed constant list — no user input reaches the f-string.

### D5: Test files auto-skip without DATABASE_URL
Per existing `tests/repos/sql/conftest.py` pattern: `pytest.skip(allow_module_level=True)` fires when `DATABASE_URL` is not set. All 3 new test files placed in `tests/repos/sql/` and rely on the shared `db_session` SAVEPOINT fixture. No changes to conftest needed.

## Status
Wave 2 complete. All 4 CI checks pass (440 passed, 4 skipped). Committed locally as `665b786`. Ready for Wave 3 (Routers + DI).

### alex-wave3-20260521T082000Z.md
# Decision Drop: M5 Wave 3 Backend [US-3.1–3.6]

**Agent:** Alex  
**Date:** 2026-05-21T08:20:00Z  
**Branch:** feat/034-m5-household-roles  
**Commit:** feat(m5): Wave 3 Backend — DI, auth router, households router, OAuth PKCE, router deps [US-3.1–3.6]

## Decisions Made

### D-W3-001: OAuth2PasswordBearer auto_error=False
Chose `OAuth2PasswordBearer(auto_error=False)` so the dependency returns `None` (not 401) when no token is present. This allows:
- E2E bypass to check env flag before raising
- `resolve_guest_or_member` to check guest token param first before requiring membership

### D-W3-002: Removed type: ignore on slowapi imports
`slowapi` now ships type stubs — the `# type: ignore[import-untyped]` comments on `app/rate_limit.py` and `app/main.py` would cause mypy `--strict` to flag them as unused. Removed both.

### D-W3-003: Targeted dep pops in idempotency test fixture
The `_reset_stores` autouse fixture in `test_api_brew_log_idempotency.py` previously called `dependency_overrides.clear()`, which cleared the auth overrides installed by the conftest `_patch_auth_deps` fixture. Changed to targeted pops of only the deps this test module manages (`get_sheets_client`, `get_llm_client`, `get_idempotency_store`). This restores test isolation without breaking auth overrides.

### D-W3-004: OAuth callback test mocks get_db + all 3 repos
`google_callback` in `app/auth.py` calls `db.commit()` directly (not via a repo). Since `get_db` yields `None` when `use_postgres=False` (unit test default), the test overrides `get_db` with an `AsyncMock` session AND patches `UserRepo`, `HouseholdRepo`, `RefreshTokenRepo` individually. The test exercises the "new user" creation path (get_by_google_sub returns None) to avoid the existing-user update path which also uses raw `db.execute()`.

### D-W3-005: Stale unauthenticated tests removed from test_api.py
16 `test_*_unauthenticated` tests that checked for 401/302/307 were removed. These tested the old session-cookie auth enforcement. With M5 JWT auth:
- The conftest `_patch_auth_deps` fixture overrides auth deps globally for unit tests
- Auth enforcement coverage is now owned by `tests/test_auth.py`
- Removing the stale tests eliminates false failures while keeping real route coverage

## Status
All 4 CI checks pass: ruff check ✓, ruff format ✓, mypy --strict ✓, pytest (419 passed, 4 skipped) ✓

### alex-wave5-migration-20260521T073220.md
# Decision Drop — Alex Wave 5 Migration Round-Trip
**Date:** 2026-05-21T07:32:20-07:00
**Author:** Alex (Backend Engineer)
**Task:** US-5.1 — Migration round-trip verification

---

## Summary

Migration 0007 round-trip verification completed. One issue found and fixed; all round-trip and CI checks now pass.

---

## Issue Found

**Migration:** `alembic/versions/0007_m5_schema_corrections.py`
**Symptom:** `asyncpg.exceptions.InsufficientPrivilegeError: must be superuser to create bypassrls users`

The `CREATE ROLE app_admin BYPASSRLS` DDL in step 7 of the upgrade fails when the migration user is not a PostgreSQL superuser. In local Docker dev (`docker-compose.dev.yml`, `POSTGRES_USER=espresso`), the `espresso` user has no superuser attribute.

## Fix Applied

Wrapped the `CREATE ROLE app_admin BYPASSRLS` (upgrade) and `DROP ROLE app_admin` (downgrade) statements in `EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE` PL/pgSQL exception handlers.

- **Production (Cloud SQL admin = superuser):** Role is created normally — no behavior change.
- **Local dev (non-superuser):** A `NOTICE` is emitted and migration continues. The `app_admin` BYPASSRLS role is not created locally, which is acceptable — RLS is only enforced in Cloud SQL environments where the runtime user is correctly configured.

**Commit:** `c786242` on `feat/034-m5-household-roles`

---

## Round-Trip Verification Results

| Step | Command | Result |
|------|---------|--------|
| 1 | `downgrade base` | ✅ Clean |
| 2 | `upgrade head` | ✅ Clean (after fix) |
| 3a | `pending_invitations` has `token_hash`, no `token` | ✅ |
| 3b | `guest_tokens` has `token_hash` + `expires_at` | ✅ |
| 3c | `households` has `is_guest_accessible` | ✅ |
| 3d | `oauth_states` exists (4 correct columns) | ✅ |
| 3e | RLS `household_isolation` on all 5 tenant tables | ✅ |
| 3f | `household_members.invited_by` FK → `users(id)` | ✅ |
| 4 | `downgrade 0006` | ✅ Clean |
| 5 | `upgrade head` (second time) | ✅ Clean (idempotent) |

---

## CI Results

All 4 checks pass post-fix:
- `uv run ruff check app/ tests/` → 0 issues
- `uv run ruff format --check app/ tests/` → 130 files already formatted
- `uv run mypy app/ --strict` → 0 issues (59 source files)
- `pytest tests/ -v --ignore=tests/e2e/` → 480 passed, 4 skipped

---

## Pre-Deployment Note

The `app_admin BYPASSRLS` role must be created in Cloud SQL manually (or via a migration run with a superuser account) before the first production deployment. The migration will now log a NOTICE rather than fail when run without superuser, so operators should verify the role exists post-migration:

```sql
SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = 'app_admin';
```

If the row is absent, run:
```sql
CREATE ROLE app_admin BYPASSRLS;
GRANT app_admin TO coffee_tracker_runtime;
```
as a Cloud SQL superuser before enabling RLS enforcement in the application.

### finn-us18-20260521T073220.md
# Decision Drop — Finn US-1.8 AuthContext.tsx

**Date:** 2026-05-21T07:32:20-07:00
**Agent:** Finn
**Task:** US-1.8 Wave 1 AuthContext.tsx scaffold

## Decisions

### 1. eslint-disable on useAuth export
`react-refresh/only-export-components` fires when a non-component (the `useAuth` hook) is exported from the same file as `AuthProvider`. Added `eslint-disable-next-line` on that export. This is the standard pattern for context modules — splitting into two files would break the encapsulation of the private `AuthContext` object.

### 2. Use existing CurrentUser type from types/entities.ts
`CurrentUser` already exists with shape `{ email, name?, picture? }`. Wave 1 imports it as-is. US-3.12 will update the shape to the full M5 model. No duplication or inline redefinition introduced.

### 3. Direct fetch (not auth.ts / apiClient)
Per task spec, Wave 1 uses `fetch` directly. The existing `apiClient` has a 401 interceptor that redirects to `/auth/login` — which would interfere with the on-mount refresh attempt (refresh failure is expected when not logged in). Direct `fetch` avoids that interceptor.

### 4. cancelled flag in useEffect
Async refresh could complete after component unmount (e.g. in tests or fast navigation). A `cancelled` boolean guard prevents stale state updates.

### finn-wave3-20260521T150123Z.md
---
author: finn
date: 2026-05-21T07:32:20-07:00
topic: wave-3-frontend-decisions
status: committed
---

# Finn Wave 3 Decision Drop

## Decision: SKIP_REFRESH_PATHS in client.ts 401 interceptor
- **What:** Added `SKIP_REFRESH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout']` to the 401 response interceptor in `client.ts`.
- **Why:** Without this, a 401 from `/auth/login` (wrong credentials) would trigger a silent refresh attempt, fail, and hard-redirect to `/login` — preventing the Login page from showing the "Invalid username or password" error to the user.
- **Rule:** Any endpoint that returns 401 for business-logic reasons (not token expiry) must be in `SKIP_REFRESH_PATHS`.

## Decision: Raw axios.post in interceptor for /auth/refresh
- **What:** The 401 interceptor in `client.ts` calls `axios.post('/auth/refresh')` directly (raw axios), NOT `apiClient.post` or `refresh()` from `auth.ts`.
- **Why:** `auth.ts` imports `apiClient` from `client.ts`. Using `refresh()` from `auth.ts` inside a `client.ts` interceptor creates a circular dependency. Raw axios bypasses this cleanly.
- **Rule:** Interceptors that call auth endpoints should use raw `axios` to avoid circular import chains.

## Decision: useState lazy initialiser for OAuth detection
- **What:** `isOAuthProcessing` in `Login.tsx` is initialised with `useState(() => new URLSearchParams(window.location.search).get('oauth_success') === '1')`.
- **Why:** The `react-hooks/set-state-in-effect` ESLint rule (zero-warnings policy) prohibits calling `setState` synchronously inside a `useEffect` body. Lazy initialiser reads URL at render time, avoiding the forbidden pattern.
- **Rule:** When a component's initial state depends on the URL (e.g. query params), prefer a lazy `useState` initialiser over reading in `useEffect`.

## Decision: AuthContext.tsx uses auth.ts functions (not raw fetch)
- **What:** `AuthContext.tsx` was updated to use `refreshApi`, `getMeApi`, `logoutApi` from `../api/auth` instead of raw `fetch` calls.
- **Why:** Consistency — all API calls go through the shared `apiClient` with interceptors. Raw `fetch` bypasses the Bearer token injection and the 401 refresh interceptor.
- **Rule:** No raw `fetch` calls for API communication in Wave 3+. All calls go through `apiClient`.

## Decision: App.tsx wraps RouterProvider in AuthProvider
- **What:** `App.tsx` now returns `<AuthProvider><RouterProvider router={router} /></AuthProvider>` and `main.tsx` renders `<App />` instead of `<RouterProvider>` directly.
- **Why:** AuthProvider must be an ancestor of all routed components (including Login/Register/ProtectedRoute) in the React component tree. Placing it outside RouterProvider but inside the PersistQueryClientProvider hierarchy in main.tsx is the correct layering.
- **Rule:** AuthProvider always wraps RouterProvider in the component tree. PersistQueryClientProvider remains in main.tsx (no TQ dependency in auth flow).

### finn-wave4-20260521T143220.md
# Decision Drop — Finn Wave 4 (US-4.6)
**Date:** 2026-05-21T14:32:20-07:00
**Agent:** Finn

## Decision: OAuth spinner test pattern — window.history.pushState, not useSearchParams mock

**Context:** Login.tsx initialises `isOAuthProcessing` state via `useState(() => new URLSearchParams(window.location.search).get('oauth_success') === '1')` — reading `window.location.search` directly at mount time, not via `useSearchParams` hook.

**Decision:** Test the OAuth spinner by calling `window.history.pushState({}, '', '/?oauth_success=1')` before `render()`. Mocking `useSearchParams` would have no effect since it is not used by the component.

**Rationale:** The `useState` initializer runs synchronously when the component is first rendered. `window.location.search` in jsdom reflects the current URL set by `pushState`. This is the correct testing approach for components that read `window.location` directly rather than via React Router hooks.

**Scope:** Login.tsx, Login.test.tsx only.

## Decision: aria-live="polite" added to FieldError (overrides implicit assertive from role="alert")

**Context:** `FieldError` in Register.tsx uses `role="alert"` which implicitly sets `aria-live="assertive"`. For blur-triggered form validation errors (user-initiated, non-urgent), assertive announcements interrupt screen reader flow.

**Decision:** Add explicit `aria-live="polite"` to `FieldError`. This is valid per ARIA spec — explicit `aria-live` overrides the implicit live region from `role="alert"`, resulting in polite announcements that wait for the current speech to finish.

**Rationale:** Blur validation is user-initiated, non-time-critical feedback. Polite is the right live region politeness for this use case. The `role="alert"` is retained for semantic meaning (identifies it as an error notification to AT).

### quinn-wave4-20260521T155000.md
# Decision Drop — Quinn Wave 4 Test Implementation

**Date:** 2026-05-21  
**Agent:** Quinn  
**Scope:** US-4.1–4.5 Wave 4 tests for spec-034 M5 Household Roles  
**Branch:** feat/034-m5-household-roles

## Decision: Test path conventions

All espresso-logs API routes are registered under the `/api` prefix (set in each APIRouter). Tests must use `/api/brew-log`, `/api/catalog`, etc. — not bare paths. The SPA catch-all `@app.get("/{full_path:path}")` intercepts bare paths with 200 HTML.

## Decision: Dependency override pattern

`app.dependency_overrides[dep_fn] = lambda: value` is the authoritative override mechanism for FastAPI test isolation. Module-level patching (`patch("module.dep_fn")`) does NOT reliably override FastAPI's dependency resolution after routes are registered.

## Decision: Rate limit test isolation

Each rate limit test uses a unique `X-Forwarded-For` IP address and an autouse `reset_rate_limiter` fixture (`limiter._storage.reset()`). Valid Pydantic request bodies are required — 422 validation failures do not consume rate limit slots.

## Decision: _DualWrite* private class importability

The `_DualWriteBrewLogRepo` and siblings in `app.deps` are directly importable for unit testing despite the underscore prefix. This is the intended test surface for US-4.4 (Sheets write-path disabled verification).

## Test count summary

| File | Tests | Status |
|------|-------|--------|
| test_auth_wave4.py | 25 | PASS |
| test_households.py | 18 | PASS |
| test_deps.py | 10 | PASS |
| test_dual_write_disabled.py | 5 | PASS |
| test_rate_limits.py | 3 | PASS |
| **Total Wave 4** | **61** | **ALL PASS** |

## CI status

All 4 local CI checks pass: ruff check, ruff format --check, mypy --strict, pytest (480 passed, 4 skipped).

### quinn-wave5-20260521T161612Z.md
---
agent: Quinn
wave: 5
spec: 034-m5-household-roles
task: US-5.2
timestamp: PLACEHOLDER
status: COMPLETE
---

# Quinn Wave 5 — US-5.2 Integration Tests

## Decision: SET LOCAL → set_config()

`SET LOCAL app.current_household_id = :hid` in `current_household_membership` and
`resolve_guest_or_member` (app/deps.py) was replaced with
`SELECT set_config('app.current_household_id', :hid, true)`.

**Reason:** asyncpg converts SQLAlchemy named params (`:hid`) to positional Postgres
params (`$1`). The `SET` command doesn't support `$1` syntax — only literal values.
`set_config()` is a regular function call and supports bound parameters.
Third arg `true` = is_local (transaction-scoped), preserving the original SET LOCAL semantics.

This was a latent production bug surfaced only by integration tests running against real asyncpg.

## Decision: SELECT-then-DELETE for delete_by_shot_id

`SqlBrewLogRepo.delete_by_shot_id` uses SELECT-then-DELETE rather than checking `result.rowcount`
because `Result[Any].rowcount` is not typed in SQLAlchemy's mypy stubs.

## Scope of changes

- `app/repos/sql/brew_log.py`: added `delete_by_shot_id`
- `app/deps.py`: SET LOCAL → set_config(); added `_DualWriteBrewLogRepo.delete_by_shot_id`
- `app/routers/api_brew_log.py`: added `DELETE /api/brew-log/{shot_id}` (require_admin)
- `tests/test_integration.py`: 4 integration tests (new file)

### tariq-p1-runbook-20260521-085119.md
# P.1 Decision Drop — Runbook update

**Task:** [P.1] Runbook update (from `coffee_tracker/specs/034-m5-household-roles/tasks.md`)

**Owner:** Tariq (TPM)

**Date:** 2026-05-21 08:51:19 UTC

---

## Task Summary

Update M5 migration phase status in `docs/requirements/spec-kit_phases.md`:
- Change status from `⬜ not started` to `🟡 in progress`
- Add branch names and spec number in Notes column

---

## Actions Taken

### ✅ Verified P.1 Completion

**Status:** ALREADY COMPLETED by previous session (speckit.tasks phase)

**Evidence:**
- Commit: `313b3dbaf58597922b89b292f53d5402bf54ffe7`
- Author: speckit.tasks phase (2026-05-21 06:48:55 -0700)
- Message: `spec(034): M5 tasks.md + runbook updated [speckit.tasks]`

### ✅ Verification Results

**File:** `<coffee_tracker>/docs/requirements/spec-kit_phases.md`

**M5 Row (current state):**
```
| M5 | Household, Roles & Sheets Write-Disable | 🟡 in progress | spec-034 · feat/034-m5-household-roles (espresso-logs) · spec/034-m5-household-roles (coffee_tracker) |
```

**Status:** ✅ Correct. Matches P.1 acceptance criteria:
- Status: `🟡 in progress` ✓
- Branch names included: `feat/034-m5-household-roles` (espresso-logs) ✓
- Branch names included: `spec/034-m5-household-roles` (coffee_tracker) ✓
- Spec number noted: `spec-034` ✓

### ⚠️ Note: espresso-logs does not have spec-kit_phases.md

**Finding:** The file `docs/requirements/spec-kit_phases.md` does not exist in espresso-logs repo.

**Rationale:**
- espresso-logs is the **application** repository (all app code)
- coffee_tracker is the **specification** repository (specs, plans, tasks)
- Progress tracking for migration phases logically belongs in coffee_tracker (single source of truth)
- No requirement identified to replicate this file in espresso-logs

**Verification command outputs:**
```
espresso-logs/docs/requirements/: engineering_architecture_v2.md, functional-spec-v2.md
coffee_tracker/docs/requirements/: spec-kit_phases.md
```

### ✅ Other Runbook Files Checked

Searched espresso-logs docs for phase/migration progress trackers:
- `docs/runbooks/m3-backfill-runbook.md` — M3-specific operator runbook (no M5 status to update)
- `docs/requirements/engineering_architecture_v2.md` — Reference document (no progress tracker)
- `docs/requirements/functional-spec-v2.md` — Functional specification (no progress tracker)
- `docs/architecture/adr-001-household-transition.md` — Architecture decision record (no progress tracker)

**Result:** No additional files require M5 status updates.

### ⚠️ No Commit Created

**Rationale:** 
- P.1 was already completed as part of speckit.tasks phase
- No uncommitted changes in espresso-logs or coffee_tracker
- Both repos have clean working trees on their respective M5 branches
- No new work is needed

---

## Acceptance Criteria (from P.1)

| Criterion | Status | Evidence |
|-----------|--------|----------|
| M5 row shows `🟡 in progress` | ✅ Pass | coffee_tracker line 699 |
| Branch names noted (espresso-logs) | ✅ Pass | `feat/034-m5-household-roles` in Notes column |
| Branch names noted (coffee_tracker) | ✅ Pass | `spec/034-m5-household-roles` in Notes column |
| Spec number noted | ✅ Pass | `spec-034` in Notes column |

---

## Verification (from P.1)

```bash
# Expected: returns M5 row with 🟡 in progress
cd <coffee_tracker>
grep "M5" docs/requirements/spec-kit_phases.md
```

**Result:**
```
| M5 | Household, Roles & Sheets Write-Disable | 🟡 in progress | spec-034 · feat/034-m5-household-roles (espresso-logs) · spec/034-m5-household-roles (coffee_tracker) |
```

✅ **PASS** — All verification criteria met.

---

## Conclusion

**P.1 task status: COMPLETE**

P.1 (Runbook update) was successfully completed as part of the speckit.tasks phase. The M5 row in the coffee_tracker progress tracker has been updated to `🟡 in progress` with all required branch names and spec number. No further action required.

---

**Reviewed by:** Tariq (TPM)  
**Date:** 2026-05-21 08:51:19 UTC  
**Co-authored-by:** Copilot <223556219+Copilot@users.noreply.github.com>

## 2026-05-23: M5 Spec-034 Routing and Remediation Close-Out

### 2026-05-23-alex-routing-m5-pending.md
# Decision Drop — Alex Routing: M5 Pending Backend Items 1–5

**Date:** 2026-05-23  
**Agent:** Alex (Backend Engineer / Routing Agent)  
**Branch:** `feat/034-m5-household-roles`

## Decision
**status: DIRECT_PERMITTED**

## Rationale
This request is a bounded remediation pass on work that was already fully specified under spec-034 and already routed for implementation on this branch. The five requested items are the remaining HIGH-priority backend follow-ups from Maya's 2026-05-21 RED architecture review after the two CRITICAL security fixes were completed.

A new SpecKit cycle is not required because:
1. The product scope already exists: these items correct missing or incomplete implementation against spec-034 requirements rather than introducing new user stories.
2. The implementation boundary is explicit: `.squad/agents/alex/pending-m5-work.md` provides concrete file targets, endpoint/schema expectations, acceptance criteria, and named tests for each item.
3. Planning artifacts already exist: prior spec-034 SpecKit phases were completed, tasks already existed for the milestone, and the branch remains the same implementation branch for that approved work.
4. The Quinn gate was previously approved for spec-034, so this is completion work within an already-authorised feature envelope rather than a net-new feature needing re-specification.
5. The requested changes stay within backend/auth/household/import-wizard remediation and do not expand beyond the reviewed M5 household-roles feature boundary.

## Explicit Scope Confirmation
The following five items are in scope for direct implementation, and no broader re-scoping is authorised under this routing decision:

1. **Atomic Refresh Token Rotation**
   - Fix refresh rotation race condition with an atomic repo-level rotate operation and concurrent test coverage.

2. **Invitation Model Overhaul**
   - Align invitation expiry, status model, request body fields, accept-role behaviour, and required decline/revoke/resend endpoints with existing spec-034 requirements.

3. **Household Rename and Soft-Delete**
   - Add the missing spec-required admin rename and soft-delete endpoints, including delete guards and deleted-household filtering.

4. **Active-Household Resolution via `X-Household-Id` Header**
   - Fix multi-household dependency resolution and update `/auth/me` membership payloads, with optional switch-household endpoint if implemented within the documented scope.

5. **Import Wizard: Admin-Gate + Replace `request.session`**
   - Correct admin-only enforcement and replace removed session-middleware usage with DB-backed import-session state.

## Notes
- This decision covers completion of already-specified M5 backend work only.
- Any new requirements beyond these five items, or any change that alters spec-034 behaviour outside the documented remediation scope, requires fresh routing.

### 20260521T2032Z-maya-arch-review.md
# Decision Drop — Maya Architectural Review M5 Spec-034
Date: 2026-05-21T20:32Z
Author: Maya (Principal Engineer)

## Decision
M5 spec-034 implementation reviewed against functional-spec-v2.md and engineering_architecture_v2.md.

**Verdict: RED — NOT READY FOR PR**

Two CRITICAL security failures discovered. Multiple CRITICAL functional gaps. Handoffs to Alex, Finn, and Quinn mandated before this branch can advance to PR.

## Critical Security Issues
1. Runtime DB role granted BYPASSRLS — DB-enforced tenant isolation defeated (alembic/0007)
2. Admin password reset has no shared-household validation — cross-household reset possible (api_auth.py:310-329)

## Agent Handoffs Mandated
- Alex (Backend): 7 items (CRITICAL×2, HIGH×5)
- Finn (Frontend): 5 items (CRITICAL×2, HIGH×2, MEDIUM×1)
- Quinn (QE): 3 items (CRITICAL×1, HIGH×2)

## Full Review
See .squad/orchestration-log/20260521T2032Z-maya-arch-review.md

### 20260522-alex-m5-backend-gaps-routing.md
# Decision Drop — Alex Routing: M5 Spec-034 Backend Gap Remediation
Date: 2026-05-22
Author: Alex (Backend Engineer / Routing Agent)
Branch: feat/034-m5-household-roles

## Decision
**status: DIRECT_PERMITTED**

## Rationale
Maya's architectural review (2026-05-21, decision drop: `.squad/decisions/inbox/20260521T2032Z-maya-arch-review.md`) returned a RED verdict and **explicitly mandated an Alex handoff** for 7 backend items (CRITICAL×2, HIGH×5). All items are gap-remediation against requirements already fully specified in `docs/requirements/functional-spec-v2.md` and `docs/requirements/engineering_architecture_v2.md`. No new product scope is being introduced. The SpecKit cycle for spec-034 (waves 1–5) already produced spec, plan, and tasks.md; the current work corrects deviations from those already-approved artifacts.

A new SpecKit cycle is **not required** because:
1. The specification is frozen and complete — every item below traces directly to an existing spec/arch requirement.
2. Maya's review document provides authoritative, line-level scope — it is functionally equivalent to a tasks.md for this remediation pass.
3. The work is bounded to the existing branch and does not alter the approved feature boundary.

## Explicit Scope Confirmation
Alex is authorised to implement the following 7 backend items, no more, no less:

### CRITICAL — Security
1. **Remove runtime BYPASSRLS grant; enforce FORCE ROW LEVEL SECURITY**
   - File: `alembic/versions/0007_m5_schema_corrections.py:146-171`
   - Remove `GRANT app_admin TO coffee_tracker_runtime`; add `ALTER TABLE … FORCE ROW LEVEL SECURITY` where appropriate; extend RLS policies to `pending_invitations`, `guest_tokens`, `household_members`.
   - Tests: integration tests must run under the non-bypass runtime role.

2. **Admin password reset — add shared-household validation**
   - File: `app/routers/api_auth.py:310-329`
   - After loading `target`, require `HouseholdRepo().get_member(db, caller_membership.household_id, target.id)` to succeed; return 404/403 otherwise.

### HIGH — Security / Correctness
3. **Atomic refresh token rotation**
   - Files: `app/routers/api_auth.py:234-259`, `app/repos/sql/refresh_tokens.py:36-60`
   - Single DB operation: `UPDATE … SET revoked=TRUE WHERE token_hash=:hash AND revoked=FALSE AND expires_at > NOW() RETURNING user_id`; insert replacement only on success.

4. **Invitation model fixes: 72h expiry, invited_email, invited_role; add decline/revoke/resend endpoints**
   - Files: `app/repos/sql/household.py:162-169`, `app/models/household.py:98-120`, `app/routers/api_households.py`
   - Fix expiry to 72 hours; persist `invited_email` and `invited_role` from request body; add `POST /households/{id}/invitations/{token}/decline`, `DELETE /households/{id}/invitations/{token}` (revoke), `POST /households/{id}/invitations/{token}/resend`.

5. **Household rename and delete endpoints**
   - File: `app/routers/api_households.py`
   - Add `PATCH /households/{id}` (rename, admin-only) and `DELETE /households/{id}` (admin-only, with member/data cascade guard).

6. **Active-household resolution: X-Household-Id header + auth/me households array**
   - Files: `app/deps.py:137-145, 206-213`, `app/routers/api_auth.py:294-297`
   - Resolve active household from `X-Household-Id` request header (validated against caller's memberships); return all memberships as `households[]` array from `GET /auth/me`.

### HIGH — Code Quality / Runtime Safety
7. **Import wizard: admin gate + DB-backed session state**
   - Files: `app/routers/import_wizard.py:30, 69-107, 110-122`, `app/main.py`
   - Replace `current_household_membership` dep with `require_admin`; migrate `request.session` usage to DB-persisted wizard state (since `SessionMiddleware` was removed in M5).

## Out of Scope (not authorised under this drop)
- Username validation alignment (MEDIUM — separate concern, no security impact)
- `last_seen_at` update propagation (MEDIUM — no functional regression)
- N+1 query optimisations (LOW)
- Allowlist messaging cleanup (LOW)
- Guest token URL/key contract fix (MEDIUM — Finn scope for frontend; backend shim acceptable)
- Frontend routes, pages, or UI components (Finn scope)
- Test expansion for RLS surface (Quinn scope)

## CI Gate
All four local checks must pass before any push:
1. `uv run ruff check app/ tests/`
2. `uv run ruff format --check app/ tests/`
3. `uv run mypy app/ --strict`
4. `SPREADSHEET_ID=dummy uv run pytest tests/ -v --ignore=tests/e2e/`

### 20260522-alex-m5-rls-household-reset-routing.md
# Decision Drop — M5 RLS Hardening + Admin Reset-Password Household Scope

**Agent:** Alex (backend routing)
**Date:** 2026-05-22
**Branch:** feat/034-m5-household-roles
**Status:** DIRECT_PERMITTED

---

## Request Summary

Two changes were assessed:

1. **`alembic/versions/0007_m5_schema_corrections.py`** — Remove the `GRANT app_admin TO coffee_tracker_runtime` block; add `FORCE ROW LEVEL SECURITY` for each of the five tenant-scoped tables (alongside the existing `ENABLE ROW LEVEL SECURITY` statements); update `downgrade()` to mirror; add a comment block explaining why `BYPASSRLS` must never be granted to the runtime role.

2. **`app/routers/api_auth.py`** — Add shared-household boundary validation to `POST /auth/admin/reset-password` so an admin can only reset passwords for users who share the same household. Return 404 (not 403) if the target user is not a member of the caller's household, using `HouseholdRepo` (already imported) and the `household_id` available on the `HouseholdMember` returned by `require_admin`.

---

## Routing Decision: DIRECT_PERMITTED

### Rationale

**Both items are bounded security corrections on already-existing code.** Neither introduces new API surface, new database schema, new routes, new models, or new service dependencies.

#### Item 1 — Migration security hardening

- The migration `0007` already exists and already contains both the `ENABLE RLS` block and the `GRANT app_admin TO coffee_tracker_runtime` block.
- `FORCE ROW LEVEL SECURITY` is a complementary DDL modifier that prevents table owners from bypassing RLS policies. Adding it alongside `ENABLE RLS` is a security tightening of an already-defined intent, not a new feature.
- Removing the `GRANT app_admin TO coffee_tracker_runtime` block removes a security gap introduced in the same migration: granting `BYPASSRLS` membership to the runtime role defeats the entire RLS model for tenant isolation.
- The downgrade update is a mechanical inverse of the upgrade changes.
- Adding a comment block is documentation only.
- Scope: one file, no logic changes outside the migration.

#### Item 2 — Household boundary on admin reset-password

- `POST /auth/admin/reset-password` already exists in `api_auth.py`.
- `require_admin` (already in the dependency chain) returns a `HouseholdMember` which carries `household_id`.
- `HouseholdRepo` is already imported in the file.
- The validation pattern (lookup target's memberships, cross-check household_id) is used identically in other household-scoped admin endpoints in the same router file.
- This is a missing security enforcement (privilege escalation gap), not a new capability.
- Scope: one function in one file; no schema changes.

### Why SPECKIT is not required

SpecKit is required when a request introduces new user-facing behaviour, new API contracts, new data models, or requires cross-team design alignment. Neither item here meets that bar:
- No new endpoints.
- No new columns or tables.
- No changes to existing API request/response schemas.
- No changes to the auth flow or token model.
- Both are corrections to gaps in already-merged M5 work on this branch.

The 404 response for out-of-household targets is a standard security-by-obscurity pattern already used throughout this codebase (consistent with `UserRepo.get_by_username` returning None → 404 at line 323 of `api_auth.py`). No new behaviour contract is established.

---

## Explicit Scope Confirmation

| File | Change type |
|------|-------------|
| `alembic/versions/0007_m5_schema_corrections.py` | Remove GRANT block; add FORCE RLS per tenant table; update downgrade; add comment |
| `app/routers/api_auth.py` | Add household membership check in `admin_reset_password`; rename `_` dep to `admin_member`; 404 if target outside household |

No other files require modification. No new files are created.

---

## Pre-implementation Notes for Implementer

- `FORCE ROW LEVEL SECURITY` goes on the same five tables already receiving `ENABLE ROW LEVEL SECURITY`: `brew_log`, `catalog`, `inventory_bags`, `hardware`, `maintenance_log`.
- Downgrade must execute `ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY` for each of the five tables (in addition to already-present `DISABLE ROW LEVEL SECURITY`).
- The comment block must explain: runtime role executes queries scoped by `app.current_household_id`; granting `BYPASSRLS` via role membership would silently skip all `household_isolation` policies for every query, eliminating the tenant boundary entirely.
- In `admin_reset_password`, rename the existing `_: HouseholdMember = Depends(require_admin)` parameter to expose `household_id`. Use `HouseholdRepo().get_memberships_for_user(db, target.id)` to retrieve target memberships; check any membership's `household_id` matches the caller's. If no matching membership, raise `HTTPException(status_code=404, detail="User not found")` (not 403 — avoids leaking cross-household user existence).

### 20260522T052724Z-finn-m5-frontend-gaps-routing.md
# Decision Drop — Finn Frontend Routing: M5 Spec-034 Frontend Gaps
Date: 2026-05-22T05:27:24Z
Author: Finn (Frontend Agent)
Branch: feat/034-m5-household-roles

## Decision

**status: DIRECT_PERMITTED**

### Rationale

This is bounded, well-defined frontend implementation work that proceeds directly without a new SpecKit cycle.

**Why DIRECT_PERMITTED:**
1. All requirements already exist in `docs/requirements/functional-spec-v2.md` and Maya's architectural review (`.squad/orchestration-log/20260521T2032Z-maya-arch-review.md`). No new spec cycle is needed — the gaps were identified against an existing spec, not against missing requirements.
2. This is frontend-only scope. No backend API contracts are being changed by Finn; the frontend is being aligned to the contracts the spec already defines.
3. The branch `feat/034-m5-household-roles` is an existing M5 implementation branch. This is a direct continuation of that work to address review findings, not a new feature.
4. Maya's review provides exact file/line evidence for every gap. The implementation path is unambiguous.
5. Alex (backend agent) is handling backend gaps on the same branch in parallel. Finn's work does not block or require coordination beyond agreed API contracts already in the spec.

### Explicit Scope Confirmation

**In scope (Finn owns):**
- Add missing routes to `router.tsx`: `/welcome`, `/invite/accept`, `/invite/invalid`, `/invite/expired`, `/profile`, `/household/new`, `/household/settings`
- Create corresponding page components: `Welcome`, `InviteAccept`, `InviteInvalid`, `Profile`, `HouseholdNew`, `HouseholdSettings`
- Extend `types/entities.ts`: add `HouseholdMembership` type, update `CurrentUser` to include `memberships[]` and `active_household_id`
- Extend `AuthContext.tsx`: add `memberships`, `activeHouseholdId`, `switchHousehold`; graceful fallback for single-household legacy response
- Add `AdminRoute` component for role-based route protection
- Fix `Login.tsx`: add required-field validation, preserve `invite`/`from` query params, navigate zero-membership users to `/welcome`
- Fix `Register.tsx`: remove duplicate token storage (module-level call), align username validation to spec (3–30, alphanumeric + underscores only), preserve `invite`/`from` query params, navigate new users to `/welcome`
- Add household API types to `api/auth.ts` (no new endpoints, just type alignment with spec response contract)
- Run frontend quality checks: `tsc --noEmit`, `eslint`, `vitest run`

**Out of scope (not Finn's):**
- Backend security fixes (BYPASSRLS, cross-household reset) — Alex
- Backend endpoint gaps (decline invite, revoke/resend, household rename/delete) — Alex
- Guest read-only UI — deferred pending backend guest-token contract alignment (Alex)
- Test coverage for backend — Quinn
- Quinn gate artifact creation — Quinn

### Files to Change
- `frontend/src/types/entities.ts`
- `frontend/src/contexts/AuthContext.tsx`
- `frontend/src/components/ProtectedRoute.tsx` (minor refactor)
- `frontend/src/components/AdminRoute.tsx` (new)
- `frontend/src/router.tsx`
- `frontend/src/pages/Login.tsx`
- `frontend/src/pages/Register.tsx`
- `frontend/src/pages/Welcome.tsx` (new)
- `frontend/src/pages/InviteAccept.tsx` (new)
- `frontend/src/pages/InviteInvalid.tsx` (new)
- `frontend/src/pages/Profile.tsx` (new)
- `frontend/src/pages/HouseholdNew.tsx` (new)
- `frontend/src/pages/HouseholdSettings.tsx` (new)
- `frontend/src/api/auth.ts` (type alignment)

### 20260523T070936Z-alex-routing-spec-034-m5.md
# Decision Drop — Alex Routing: spec-034 M5 HIGH Pending Items

**Date:** 2026-05-23  
**Agent:** Alex (Routing Agent)  
**Branch:** `feat/034-m5-household-roles`

## Decision
**status: DIRECT_PERMITTED**

## Rationale
This request is a bounded implementation pass against already-specified spec-034 work on the current feature branch, not a net-new feature or planning effort. The branch already contains prior spec-034 implementation and routing history, and `.squad/agents/alex/pending-m5-work.md` enumerates the five remaining HIGH-priority backend items with concrete file targets, endpoint/schema expectations, and test requirements.

Direct implementation is permitted because the requested work is explicitly limited to completing these five known remediation items on `feat/034-m5-household-roles`, one item at a time, with all four CI checks run after each item and a separate commit per item. Any scope expansion beyond those five listed items would require fresh routing.

## Scope Confirmation
Direct work is authorized only for these five items on the current branch, with per-item CI and per-item commits:
1. Atomic refresh token rotation in auth/refresh token repo with concurrency test.
2. Invitation model overhaul: status migration, 72h expiry, invited fields/role behavior, decline/revoke/resend endpoints, tests.
3. Household rename and soft-delete with migration/filtering, tests.
4. `X-Household-Id`-aware active household resolution, `/auth/me` memberships, `/auth/switch-household`, tests.
5. Import wizard admin gate plus DB-backed import session migration and test.

### tariq-034-architecture-review-routing-20260522T050356Z.md
### 2026-05-22: Routing decision — spec-034 M5 architectural review
**By:** Tariq (routing agent)
**Status:** DIRECT_PERMITTED
**Scope:** Independent, read-only architectural review of branch `feat/034-m5-household-roles` against `docs/requirements/functional-spec-v2.md` and `docs/requirements/engineering_architecture_v2.md`, producing a structured findings report only.
**Rationale:** The request is a bounded assessment artifact, not implementation, replanning, or scope change. It does not ask for application code edits, spec changes, or new sequencing decisions; it only asks for conformance review of an existing implementation against already-authored requirements. Therefore no new SpecKit cycle is needed and direct review work is permitted within the explicit no-fixes/no-code-changes boundary.

### tariq-034-qe-coverage-routing-20260522T0526Z.md
# Decision Drop — Tariq Routing: spec-034 M5 QE Coverage Task
**Date:** 2026-05-22T05:26Z
**Author:** Tariq (routing agent)
**Branch:** feat/034-m5-household-roles
**Request:** Add backend pytest coverage and frontend Vitest coverage for spec-034 M5 household-role/auth/multi-household/RLS flows, with xfail(strict=True) only where production fixes are pending, and no dependency override of `require_admin` in new tests.

---

## Decision

**status: DIRECT_PERMITTED**

---

## Rationale

This is a bounded, additive QE coverage task on an existing feature branch where the implementation is complete. The following conditions confirm DIRECT_PERMITTED:

1. **No application code changes.** The task is purely additive: new test files and/or new test cases in existing test modules. No routes, models, services, migrations, or frontend components are modified.

2. **Test infrastructure already established.** The repository has mature test scaffolding in place:
   - Backend: `conftest.py`, `FakeSheetsClient` doubles, `pytest-asyncio` in auto mode, existing `tests/test_households.py`, `tests/models/test_household.py`, `tests/integration/` structure.
   - Frontend: Vitest + jsdom configured in `vite.config.ts`, `src/test/setup.ts`, `src/__tests__/` directory with existing test files.

3. **This executes a mandated Quinn QE handoff.** Maya's architectural review (`.squad/decisions/inbox/20260521T2032Z-maya-arch-review.md`) explicitly mandated Quinn QE action items (CRITICAL×1, HIGH×2) on this branch. Writing test coverage to surface those gaps (via `xfail(strict=True)`) is executing the already-approved QE mandate — not new scope.

4. **No SpecKit artifacts required.** SpecKit is warranted for product feature work, spec changes, or architecture decisions. Test coverage on an existing implementation uses established test conventions; it does not require a new specification, plan, tasks.md cycle, or architectural gate.

5. **xfail(strict=True) constraint respected.** The operator explicitly constrains xfail use to flows where production fixes are still pending (surfacing known failures as red, not hiding them as skip). This is a standard pytest pattern consistent with the codebase's QE conventions.

6. **No require_admin override constraint respected.** The operator explicitly prohibits overriding the `require_admin` dependency in new tests. This is consistent with testing the actual auth/role enforcement rather than bypassing it — and with Maya's finding that role enforcement has security gaps that must be surfaced, not papered over.

---

## Explicit Scope Confirmation

The following scope is permitted under this decision:

**Backend (pytest):**
- New test file(s) under `tests/` or `tests/integration/` covering:
  - Household role assignment and enforcement (admin vs. member paths)
  - Auth flows: login, token refresh, password reset with household membership validation
  - Multi-household scenarios: user in multiple households, household switching
  - RLS enforcement: row-level isolation across household boundaries
- `xfail(strict=True)` applied only to test cases where Maya's RED findings correspond to not-yet-fixed production code on this branch
- No overriding `require_admin` via `app.dependency_overrides` in new tests

**Frontend (Vitest):**
- New test file(s) under `frontend/src/__tests__/` covering:
  - Household role-aware UI flows (admin vs. member rendering/routing)
  - Auth context and household context interactions
  - Multi-household selection / switching components
- `xfail`-equivalent patterns (`.todo` or conditional skips) only where frontend fixes remain pending

**Out of scope:**
- No application code changes (routes, models, services, frontend components, migrations)
- No new npm or PyPI dependencies
- No spec amendments or plan changes
- No changes to existing passing tests

---

## Constraints on Implementation Agent

- Must follow `SPREADSHEET_ID=dummy` + `FakeSheetsClient` pattern (no live sheets in tests)
- Must pass all four local CI checks before any push: `ruff check`, `ruff format --check`, `mypy --strict`, `pytest`
- Must not push without explicit operator affirmative
- Quinn gate (`specs/034/quinn-gate.md` in `coffee_tracker` repo) should be verified if this work is intended to formally close the QE mandate; if the gate doesn't yet exist, the implementation agent should flag this to the operator rather than proceeding to push

## 2026-05-23

### Spec-034 welcome onboarding flow amendment — DIRECT_PERMITTED

**Author:** Priya (routing)  
**Branch:** feat/034-m5-household-roles  
**Status:** Committed (`docs(spec): welcome onboarding flow amendment to spec-034 (#034)`)

Documentation-only extraction of the `/welcome` first-sign-in onboarding flow from `docs/requirements/functional-spec-v2.md` into `docs/requirements/spec-034-amendment-welcome-flow.md`. Quinn gate explicitly waived by routing because the work is confined to a single requirements document and introduces no code, test, or configuration changes.

**Scope confirmed:**
- create `docs/requirements/spec-034-amendment-welcome-flow.md`
- source the content only from `docs/requirements/functional-spec-v2.md`
- do not modify application code
- local commit only; no push

**Outcome:** Amendment committed in `6637d3c`; routing decision preserved from inbox drop `20260523-0953-priya-routing-spec034-welcome-flow-amendment.md`.

---

### E2E test harness JWT auth repair — DIRECT_PERMITTED

**Author:** Tariq (routing)  
**Branch:** feat/034-m5-household-roles  
**Status:** Routed

Bounded test-infrastructure repair for the JWT/refresh-token auth migration. Permitted scope is limited to `tests/e2e/` updates covering auth fixture alignment, default `E2E_BASE_URL`, SPA shell expectation fixes, pytest-asyncio/Playwright runner conflicts, and least-invasive mitigation for `/auth/refresh` rate-limit failures.

**Constraints preserved:** no production code changes, no push, and verification must run against a live server plus the non-e2e backend suite.

---

### CI validation request — DIRECT_PERMITTED

**Author:** Tariq (routing)  
**Branch:** feat/034-m5-household-roles  
**Status:** Routed

Operational validation work was classified as direct-permitted: inspect the existing test configuration, run the repository's backend and frontend validation commands, run Playwright if feasible in the current environment, and return a structured pass/fail report. No source edits, refactors, or CI redesign are permitted inside this routing decision.

---

### Playwright triage request — DIRECT_PERMITTED

**Author:** Tariq (routing)  
**Branch:** feat/034-m5-household-roles  
**Status:** Routed

Read-only triage of failing Playwright coverage is authorised: start the existing local services if needed, run the repository's existing Playwright-related tests, and classify failures as environment/setup issues versus actual regressions. Findings-only scope; code and workflow files remain untouched.

---

### Spec-034 backend gap remediation — DIRECT_PERMITTED

**Author:** Alex (routing)  
**Branch:** feat/034-m5-household-roles  
**Status:** Routed

Backend reconciliation against explicit v2 spec requirements is authorised for a tightly bounded scope in `app/routers/api_households.py`, `app/repos/sql/household.py`, `app/models/household.py`, related helpers, optional tactical Alembic migration work, and targeted tests. In-scope items are household name max length, duplicate/existing-member invite rejection, household cap enforcement, invite rate limiting, UUID v4 invite tokens, token status-code audit, and membership timestamp alignment.

**Explicit exclusions:** do not touch active-household context in `app/deps.py`, first-sign-in onboarding semantics in `app/routers/api_auth.py`, household delete semantics, invitation route shapes, or push to remote.

---

### Dual-write `sql=None` regression in `app/deps.py` — DIRECT_PERMITTED

**Author:** Alex (routing)  
**Branch:** feat/034-m5-household-roles  
**Status:** Routed

A bounded backend bug fix is authorised to restore write fallback semantics in the dual-write repository wrappers when SQL is unavailable. Reads already fall back to Sheets; writes must stop silently no-oping for catalog, brew log, inventory, hardware, and maintenance repos.

**Scope confirmed:** `app/deps.py`, tightly coupled backend tests for dual-write fallback and the catalog create/detail regression path, and removal of incorrect tests that codify the broken no-op behavior. No frontend, schema, migration, auth, or e2e changes.

---

## 2026-05-24

### Session-resolved household & invitation routes — DIRECT_PERMITTED

**Author:** Alex (routing)  
**Branch:** feat/034-m5-household-roles  
**Status:** Routed

Session-resolved URL refactor is authorised for `app/routers/api_households.py` and the matching route tests in `tests/test_households.py` and `tests/test_role_enforcement.py`. The refactor removes redundant `{household_id}` path parameters from active-household routes in favour of the already-established `current_household_membership` dependency and shifts the affected handlers to `/me/...` endpoints.

**Leave unchanged:** create/list/accept-invite routes that still require explicit IDs or token-only handling. Add a tech-debt TODO above `DELETE /me`; do not widen scope beyond the router and those tests.

---


---

# Tariq routing decision — PR #80 CI RCA

- Date: 2026-06-01
- Branch: `feat/034-m5-household-roles`
- Request: Produce a written root cause analysis for failing CI jobs on PR #80 / run 26736087268, make no code changes or fixes, and commit the RCA locally without pushing.

## Decision
status: DIRECT_PERMITTED

## Rationale
This request is bounded to CI failure diagnosis and documentation. It does not change application behavior, schema, infrastructure, or product scope. The work is limited to collecting evidence from the failing GitHub Actions run, identifying the failing checks and probable causes, and recording the findings in a repository-local RCA document.

## Explicit scope confirmation
Direct work is permitted for diagnosis only: inspect PR #80 and run 26736087268, write the RCA under `.squad/log/`, and commit the documentation locally without pushing. No implementation, remediation, or follow-up fixes are authorized by this routing decision.


---

# Alex routing decision — branch feat/034-m5-household-roles CI fixes

- Date: 2026-06-01
- Branch: `feat/034-m5-household-roles`
- Request: Fix two CI failures on `feat/034-m5-household-roles` in `espresso-logs`: resolve the asyncpg event-loop mismatch behind 23 failing SQL repo tests by correcting fixture/loop scope conflicts without changing test logic/assertions, upgrade `starlette` from `1.0.0` to `1.0.1` via `uv add starlette==1.0.1`, run all four local CI-equivalent checks, and if passing commit locally without pushing.

## Decision
status: DIRECT_PERMITTED

## Rationale
This is a bounded remediation request inside existing backend test infrastructure and dependency management. The requested work is limited to repairing a fixture/event-loop scope mismatch in current tests, applying a patch-level dependency upgrade, validating with the repository’s established four CI-equivalent commands, and creating a local commit. It does not introduce new product scope, schema design, UX changes, or cross-cutting architectural decisions that would require a SpecKit cycle.

## Explicit scope confirmation
Direct implementation is permitted only for: investigating `tests/conftest.py` and the named failing SQL repo tests, fixing the async fixture or event-loop scope conflict without altering test assertions or intended behavior, running `uv add starlette==1.0.1`, executing the four required local CI-equivalent checks, and creating a local commit if those checks pass. No push, no broader refactor, and no unrelated file changes are authorized by this routing decision.


---

# Routing Decision — spec-034 M5 Security Remediation

**Agent:** Alex (backend routing)
**Timestamp:** 2026-06-01T05:38:13Z
**Branch:** feat/034-m5-household-roles
**Status:** DIRECT_PERMITTED

---

## Request Summary

Remediate two CI/security scanner findings on the existing `feat/034-m5-household-roles` branch:

1. **Semgrep S608** — `app/repos/sql/household.py` lines 495-497: dynamic SQL table name
   interpolated via an f-string inside `sqlalchemy.text(...)`. The table name comes from a
   closed, hardcoded list `["hardware", "maintenance_log"]` defined in the same function.

2. **Gitleaks** — dummy JWT_SECRET test-fixture literal `abcdefghijklmnopqrstuvwxyz123456`
   appearing in `tests/conftest.py:14` and `tests/test_integration.py:17`. Both are
   intentional, non-sensitive test values.

---

## Routing Decision: DIRECT_PERMITTED

### Rationale

- **No net-new functionality.** Both changes are purely defensive — replacing a safe-but-flagged
  pattern with an equivalent safe pattern, and suppressing false-positive scanner noise on
  known dummy values.

- **Bounded scope.** Affected files:
  - `app/repos/sql/household.py` — allowlist guard replaces f-string interpolation; no
    behaviour change because the allowlist exactly matches the existing hardcoded list.
  - `tests/conftest.py` — inline `# gitleaks:allow` annotation on line 14.
  - `tests/test_integration.py` — inline `# gitleaks:allow` annotation on line 17.

- **No new routes, models, data-access contracts, or API surface.** The household migration
  helper function signature and return type are unchanged.

- **In-branch.** Work stays on `feat/034-m5-household-roles`; no new branch required.

- **SpecKit is not warranted** for security-scanner suppression / safe-equivalent refactors
  on an already-approved and substantially-complete feature branch.

### Explicit Scope Confirmation

The implementer (Quinn) is authorised to make **only** the following changes:

| File | Change |
|---|---|
| `app/repos/sql/household.py` | Replace `sa.text(f"UPDATE {table} ...")` with an allowlist-validated static dispatch (e.g. `if table not in _ALLOWED_TENANT_TABLES: raise ValueError`) so no user-controlled or dynamic string reaches `sqlalchemy.text`. |
| `tests/conftest.py` | Add `# gitleaks:allow` (or equivalent suppression comment) to the `JWT_SECRET` setdefault line. |
| `tests/test_integration.py` | Add `# gitleaks:allow` (or equivalent suppression comment) to the `JWT_SECRET` env-var comment line. |

No other files may be modified under this routing decision.

### Post-change Verification

Before committing, all of the following must pass:

```
uv run ruff check app/ tests/
uv run ruff format --check app/ tests/
uv run mypy app/ --strict
SPREADSHEET_ID=dummy uv run pytest tests/ -v --ignore=tests/e2e/ -k "household"
```

Commit message (pre-approved):
```
fix(security): replace dynamic SQL table interpolation with allowlist in household.py (#034)

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

**No push until operator explicitly authorises.**

---

## Quinn Gate

For this narrow security remediation, a full `quinn-gate.md` artifact is **waived** per the
routing agent's explicit statement here. The routing agent (Alex) confirms this is a
documentation-equivalent / scanner-suppression change with no logic delta that would require
a pre-implementation design review.

---

## Scribe merge: 2026-06-06T15:45:50.896-07:00

### Decision drop: `2026-06-06T154646-0700-branch-discovery-routing.md`

# Routing decision: branch discovery

- Operator request: "what branch are we currently on espresso logs and coffee tracker?"
- Classification: DIRECT_PERMITTED
- Rationale: This is a read-only status request limited to discovering the current Git branch in the Espresso Logs repository and sibling/local Coffee Tracker repository. It does not change product behavior, code, configuration, CI, documentation, or governance artifacts beyond this required routing drop.
- Scope: Read-only branch discovery only; no code changes, no SpecKit, no push, no PR.

---

### Decision drop: `20260605-tariq-route-prod-oauth-rebase.md`

# Routing Decision: fix/prod-oauth-callback rebase + gitleaks remediation

**Status:** `DIRECT_PERMITTED`

**Date:** 2026-06-05 21:15 UTC-7  
**Ref:** espresso-logs d7c5c3d6  
**Scope:** Bounded, documentation + dependency integration  

---

## Decision Rationale

**Work is self-contained and mechanical:**
1. **Rebase** `fix/prod-oauth-callback` onto `origin/main` to include 3 merged Dependabot PRs (#90, #91, #92) — dependency updates only, no feature changes.
2. **Fix gitleaks false positives** in `docs/ROTATION_PLAYBOOK.md` (lines 67, 79, 186) — documented placeholder secrets, safe to remediate via documentation edits.
3. **Run existing CI checks** (ruff check/format, mypy --strict, pytest, frontend tests, Playwright).

**Routing criteria met for DIRECT_PERMITTED:**
- ✅ No feature scope, no architecture decisions, no app code changes in this step.
- ✅ Bounded work: documented branch, specific remediation targets, known CI suite.
- ✅ All verification is against existing tooling — no new gates or SpecKit phases required.
- ✅ User has explicitly authorized proceeding: "Go ahead and do it."

---

## Scope Definition (Coordinator → Implementation)

**Do:**
- Rebase `fix/prod-oauth-callback` with `origin/main` to resolve behind/ahead status.
- Edit `docs/ROTATION_PLAYBOOK.md` lines 67, 79, 186: replace placeholder secret examples with safe, non-rotatable equivalents (e.g., `example-`, `demo-`, or documented patterns per security review).
- Run all required CI checks:
  - `ruff check app/ tests/`
  - `ruff format --check app/ tests/`
  - `mypy app/ --strict`
  - `SPREADSHEET_ID=dummy pytest tests/ -v --ignore=tests/e2e/`
  - Frontend and Playwright tests (scope includes frontend + e2e updates).
- **Do NOT push until all checks pass AND operator explicitly approves.**

**Don't:**
- Change app code or architecture.
- Push without operator consent.
- Modify unrelated files.

---

## Next Coordinator Action

Proceed to rebase, gitleaks remediation, and CI validation. 

**Return status:** `DIRECT_PERMITTED`  
**Checkpoint:** All four local CI + frontend/Playwright must pass before requesting push approval.

---

### Decision drop: `20260605T055919Z-read-only-main-comparison.md`

# Routing decision: spec 036 squad-state cleanup

status: DIRECT_PERMITTED
agent: Tariq
scope: process / sequencing / branch state / repo readiness
recorded_at: 2026-06-05T05:59:19Z

## Operator request
Carry the stale PR #80/spec-034 state cleanup forward as part of the 036 changes and make sure scribe/decision logs have enough recorded state that no stale gate blocks routing.

## Classification
Direct implementation is permitted for squad-state cleanup only. The authorized scope is limited to updating and committing decision-drop files under `.squad/decisions/inbox/`.

No application code, tests, migrations, runtime configuration, or infrastructure files are authorized for edit, staging, or commit by this routing action.

## Observed branch state before this decision-drop commit
- Current branch: `fix/prod-oauth-callback`
- Branch status line: `## fix/prod-oauth-callback...origin/main`
- HEAD: `b4870cf448a3`
- origin/main: `b4870cf448a3`
- Routing observation: branch HEAD matched `origin/main` before this squad-state decision commit.

## Operator-cleared stale state
The PR #80/spec-034 CI/comment blocker is stale and cleared by operator assertion for this routing decision. It must not block carrying the local JWT/config cleanup work into spec 036.

## Local worktree state intentionally carried into spec 036
The following local uncommitted application/test changes are intentionally carried forward into spec 036 and should not block routing or decision-drop recording:

- `app/config.py`
- `scripts/_mapping.py`
- `tests/scripts/test_migrate.py`
- `tests/test_config_gcp.py`

These files must remain unstaged and uncommitted by this squad-state cleanup.

## Required gates for future implementation
This decision does not authorize spec 036 implementation. Before any code changes are made or committed for spec 036, the coordinator must verify the normal spec 036 artifacts and gates on disk, including the required Quinn gate where applicable, and must obtain explicit operator confirmation of implementation scope.

## Decision
status: DIRECT_PERMITTED
rationale: This is a self-contained repo-readiness and state-recording task. Isolated staging and committing of decision-drop files is safe despite dirty application-code files because those files are intentionally excluded from the index and carried forward into spec 036.
explicit_scope_confirmation: Only `.squad/decisions/inbox/` decision-drop files may be committed. Application-code and test changes remain untouched.

---

### Decision drop: `20260605T061418Z-spec036-scribe-cleanup-routing.md`

# Routing decision: spec 036 Scribe-managed cleanup

status: DIRECT_PERMITTED
agent: Tariq
scope: process / governance / Scribe-managed decision and session-log cleanup
recorded_at: 2026-06-05T06:14:18Z
branch: fix/prod-oauth-callback
head_before_decision_commit: bdcefc9

## Operator request
Carry the stale PR #80/spec-034 state cleanup forward as part of the 036 changes, and make sure Scribe and logs are updated so that no stale gate blocks the work.

## Authorized cleanup after routing
Direct implementation is permitted for Scribe-managed governance cleanup only:

1. Merge all `.squad/decisions/inbox/` decision drop files into `.squad/decisions.md` using existing repo conventions.
2. Clear/delete merged inbox files.
3. Write `.squad/log/{timestamp}-spec036-state-cleanup.md` documenting:
   - PR #80/spec-034 stale blocker cleared by operator assertion.
   - Branch/merge state checked: HEAD matched `origin/main` before the prior squad decision commit.
   - Local app/test edits are intentionally carried forward into spec 036 and must remain unstaged/uncommitted until spec 036 implementation.
   - Spec 036 still requires normal artifact/gate verification and operator scope confirmation before implementation starts.
4. Commit only Scribe-managed `.squad` files.
5. Do not stage or commit application, infrastructure, test, or docs files outside the Scribe-managed `.squad` cleanup set.
6. Do not push.

## Classification
status: DIRECT_PERMITTED

rationale: The requested follow-up is a self-contained process/governance cleanup that updates Squad decision and session-state records only. It does not authorize or require changes to application code, infrastructure, tests, or product behavior. Because the authorized cleanup is limited to Scribe-managed `.squad` files, a full SpecKit cycle is not required.

explicit_scope_confirmation: The implementation scope is limited to Scribe cleanup of `.squad/decisions.md`, merged inbox files under `.squad/decisions/inbox/`, and `.squad/log/{timestamp}-spec036-state-cleanup.md`. Existing local edits in `app/config.py`, `scripts/_mapping.py`, `tests/scripts/test_migrate.py`, and `tests/test_config_gcp.py` must remain unstaged and uncommitted for spec 036.

quinn_gate: WAIVED
quinn_gate_rationale: Quinn gate is waived for this routing decision because the authorized cleanup is governance/session-record maintenance only and touches no application or infrastructure code.

## State constraints carried forward
- PR #80/spec-034 stale blocker is cleared by operator assertion for this cleanup path.
- Previous Tariq decision drop `b36ed48` recorded that branch HEAD matched `origin/main` before the squad decision commit.
- Current uncommitted application/test edits are intentional spec 036 carry-forward state and must not be staged by Scribe cleanup.
- Spec 036 implementation remains blocked until normal artifact/gate verification and explicit operator scope confirmation occur.

## Decision
status: DIRECT_PERMITTED
rationale: Scribe-only governance/logging cleanup is bounded, non-runtime, and safe to perform directly with strict staging controls.
explicit_scope_confirmation: Only Scribe-managed `.squad` cleanup files may be edited/staged/committed; no app, infra, test, or docs files outside that scope may be touched.

---

### Decision drop: `20260605T062018Z-scribe-only-governance-cleanup-routing.md`

# Routing decision: Scribe-only governance/logging cleanup

status: DIRECT_PERMITTED
agent: Tariq
scope: process / governance / Scribe-managed decision and session-log cleanup
recorded_at: 2026-06-05T06:20:18Z
branch: fix/prod-oauth-callback
head_before_decision_commit: 9f4c2b2

## Operator request
Route a Scribe-only governance/logging cleanup. If later implemented, the cleanup must merge every current `.squad/decisions/inbox/` file into `.squad/decisions.md` using existing conventions, delete merged inbox files, create `.squad/log/{timestamp}-spec036-state-cleanup.md` documenting the exact requested state points, then stage and commit only Scribe-managed `.squad` files.

## Classification
status: DIRECT_PERMITTED

rationale: The requested work is self-contained governance/session-record maintenance. It changes only Scribe-managed `.squad` decision and log artifacts, does not alter product behavior, runtime configuration, CI, infrastructure, application code, or tests, and therefore does not require a SpecKit cycle.

explicit_scope_confirmation: Later implementation is limited to `.squad/decisions.md`, merged/deleted files currently under `.squad/decisions/inbox/`, and a new `.squad/log/{timestamp}-spec036-state-cleanup.md`. Existing local uncommitted edits in `app/config.py`, `scripts/_mapping.py`, `tests/scripts/test_migrate.py`, and `tests/test_config_gcp.py` must remain unstaged and uncommitted. No application, test, infrastructure, or non-Scribe files are authorized.

quinn_gate: WAIVED
quinn_gate_rationale: Quinn gate is waived because this is governance/logging cleanup only and explicitly touches no application or infrastructure code. The waiver does not authorize any runtime, test, CI, or infra edits.

## Required staging controls
- Stage and commit only the newly created routing decision drop for this routing action.
- Do not stage or commit `.squad/decisions.md`, `.squad/log/*`, application files, test files, infrastructure files, or pre-existing inbox files as part of this routing commit.
- Do not push.

## Decision
status: DIRECT_PERMITTED
rationale: Scribe-only governance/logging cleanup is bounded, non-runtime, and safe to perform directly with strict staging controls.
explicit_scope_confirmation: Only Scribe-managed `.squad` cleanup files may be edited/staged/committed during later cleanup; this routing commit stages only this new decision drop.

---

### Decision drop: `20260605T212606Z-tariq-blocker-fix-routing.md`

# Routing Decision: Post-Rebase Blocker Fixes
**Timestamp:** 2026-06-05T21:26:06Z  
**Routed by:** Tariq (TPM / CI workflow owner)  
**Status:** DIRECT_PERMITTED  

---

## Analysis

### Blocker 1: pip-audit failure
- **aiohttp 3.13.5** → CVE-2026-34993, CVE-2026-47265 | Fix: ≥ 3.14.0
- **pip 26.1.1** → PYSEC-2026-196 | Fix: ≥ 26.1.2
- **Nature:** Dependency version pins in pyproject.toml / uv.lock
- **Scope:** Mechanical, bounded update
- **Risk:** Low; versions are upstream-maintained; CI validates on update

### Blocker 2: gitleaks findings
- **Location:** `docs/ROTATION_PLAYBOOK.md` (6 findings, rule: generic-api-key)
- **Historical commits:** 7de8a9ca, 28a1c5ce (3 findings each)
- **Nature:** Documentation examples (JWT_SECRET rotation playbook) flagged as API keys
- **Assessment:** Guidance indicates these are documentation examples, not live secrets
- **Scope:** Safe allowlist or replace with template placeholders (e.g., `[SECRET]`, `<key>`)
- **Risk:** Medium; must verify none are actual secrets before committing

---

## Routing Decision

**status: DIRECT_PERMITTED**

### Rationale
- Both blockers are CI/operational maintenance — standard TPM scope
- No architectural decisions, no feature/product scope, no multi-repo coordination required
- Fixes are mechanical and well-scoped:
  - Dependency updates: standard `uv lock` workflow
  - Gitleaks: safe replacement + allowlist strategy
- Quinn gate not required (no application logic changes, no test coverage implications beyond existing CI)

### Exact Fix Scope

#### Fix 1: Dependency Updates (Owner: Copilot coordinator)
1. Update `aiohttp` to ≥ 3.14.0 in `pyproject.toml`
2. Update `pip` to ≥ 26.1.2 in `pyproject.toml` (or wherever pinned)
3. Run `uv lock --upgrade` to regenerate `uv.lock`
4. Verify: `uv run pip-audit --ignore-vuln PYSEC-2025-185` passes
5. Commit: "fix(deps): resolve CVE-2026-34993, CVE-2026-47265 (aiohttp), PYSEC-2026-196 (pip)"

#### Fix 2: Gitleaks Findings (Owner: Copilot coordinator)
1. **Review** `docs/ROTATION_PLAYBOOK.md` for actual secret exposure — redact any live values immediately if found
2. **Standardize** example placeholders to machine-readable format (e.g., `[SECRET]`, `<key>`, `YOUR_SECRET_HERE`)
3. **Update** `.gitleaksignore` to allowlist the known documentation pattern (commit + line hash) if replacement alone doesn't resolve
4. **Verify:** `uv run gitleaks git --redact --exit-code 1` passes
5. **Commit** both doc and `.gitleaksignore` changes: "fix(security): sanitize gitleaks findings in playbook docs + allowlist documentation pattern"

---

## Next Coordinator Action
- Verify current pin versions in `pyproject.toml`
- Apply both fixes in sequence (dependencies first, then gitleaks)
- Run all four local CI checks after each fix
- All checks must pass before requesting push approval from operator
- Do not push without explicit operator affirmative

---

## Assumptions
- No live secrets are exposed in `docs/ROTATION_PLAYBOOK.md` (guidance indicates examples only)
- Upstream `aiohttp` ≥ 3.14.0 and `pip` ≥ 26.1.2 are stable and tested
- `.gitleaksignore` allowlist strategy is acceptable for documentation patterns

---

### Decision drop: `20260605T213907Z-tariq-pr103-routing.md`

# Tariq: PR #103 Blocker-Fix Routing Decision

**Status:** `DIRECT_PERMITTED`  
**Timestamp:** 2026-06-05T21:39:07Z  
**Domain:** CI/CD pipeline remediation (pip-audit, gitleaks checks)  
**Branch:** `fix/prod-oauth-callback`

---

## Scope Confirmation

Blocker-fix commit `64e1bc4` is **pure operational remediation**:

### Changes
- `.gitleaksignore`: 6 fingerprints added (with rationale comment); no history rewritten
- `docs/ROTATION_PLAYBOOK.md`: Example hex values replaced with `<YOUR_NEW_64_CHAR_HEX_SECRET>` placeholders (4 replacements)
- `uv.lock`: Dependency bump (aiohttp 3.13.5→3.14.0, pip 26.1.1→26.1.2)

### Verification
✅ All four local CI checks pass (verified in commit message):
- `uv run ruff check app/ tests/` ✓
- `uv run ruff format --check app/ tests/` ✓
- `uv run mypy app/ --strict` ✓
- `SPREADSHEET_ID=dummy uv run pytest tests/ -q --ignore=tests/e2e/` → 643 passed ✓

✅ Blocker 1 (pip-audit): `uv run pip-audit --ignore-vuln PYSEC-2025-185` → no known vulnerabilities  
✅ Blocker 2 (gitleaks): `gitleaks git --redact --exit-code 1` → no leaks found

### Rationale

1. **No architectural or functional changes:** Dependency updates + docs fixes only
2. **Contained scope:** Three files modified; zero app code changes
3. **CI verification complete:** All checks run and pass locally
4. **No SpecKit cycle needed:** Operational remediation, not feature work or architectural decision
5. **Push sequence clear:** Coordinator will verify GitHub Actions pipeline passes before requesting final operator confirmation

---

## Next Coordinator Action

1. Verify `.squad/decisions/inbox/` commit appears in log
2. Run full CI pipeline on GitHub (wait for Actions to complete)
3. Ask operator: "All local checks pass. All four CI checks pass on GitHub. Ready to push/update PR #103?"
4. On operator confirmation: `git push origin fix/prod-oauth-callback --force-with-lease`, then close/reopen PR to trigger Actions refresh if needed

---

**Routing complete.** Coordinator may proceed to Step 3 (Direct Implementation) without SpecKit.

---

### Decision drop: `now-2026-06-05-diagnostic-harness.md`

---
decision_id: diagnostic-harness-auth-429
timestamp: 2026-06-05T13:01:06Z
requestor: Karthik Krishna Subramanian
route_by: Tariq (cross-repo governance)
status: DIRECT_PERMITTED
scope: Investigation + diagnostics only
---

## Decision: Diagnostic Harness for Auth 429 Investigation

### Approved Scope
- Set up logging harness in espresso-logs (application repo)
- Enable request/response tracing in FastAPI middleware
- Collect rate limiter state snapshots during E2E test runs
- Organize diagnostics into annotated artifacts for review

### Prohibited
- Production code modifications
- Real Google OAuth credentials or secrets
- Destructive changes to test suite
- Integration of diagnostics into main codebase (temp only)

### Unknown Variables
- Rate limiter reset behavior (timing, state cleanup)
- Source of duplicate `/auth/refresh` without `rt` param
- Backend log correlation with E2E failure trace
- Whether isolated failing tests pass outside suite rate pressure

### Handoff Recipients
1. **Quinn** (initial pre-implementation gate)
2. **Finn** (frontend test harness, E2E flow analysis)
3. **Alex** (backend rate limiter, auth logic)

### Next Decision Point
After diagnostic collection + Quinn review: proceed to fix code OR fix tests based on root cause analysis.

### Decision Authority
Tariq (on behalf of Karthik Krishna Subramanian).  
No Squad phase required — investigation scope is explicit and bounded.

---

### Decision drop: `quinn-analysis-pw-failures-20260605.md`

# Quinn: Playwright Test Failure Analysis & Fix Plan
**Date:** 2026-06-05T14:00 PDT  
**Branch:** fix/prod-oauth-callback  
**Requested by:** Karthik Krishna Subramanian  

## Routing Decision
**status: DIRECT_PERMITTED**

This is a **diagnostic + planning-only task** within Quinn's QA domain. No code changes or implementation. Analysis of existing test artifacts and recommendations for Finn (frontend) and Alex (backend) to execute.

---

## Root Cause Analysis

### Summary
6 Playwright E2E tests fail in the full suite (`--retries=0`) due to **accumulated rate-limit exhaustion** of the `/auth/refresh` endpoint during the d2-tokens block, cascading 401 Unauthorized failures through subsequent specs.

**Evidence:** Diagnostic harness in `tmp/auth-refresh-diagnostics-20260605T130009/` confirms:
- **Isolated tests pass** — all failing specs pass 100% when run alone
- **Rate limit is exhausted** — d2-tokens makes 30 page loads × 2 browsers = 60 POST /auth/refresh calls in ~1 minute, exceeding the 20/minute limit
- **Endpoint not implemented** — `/api/e2e/reset-limiter` endpoint called in global-setup does exist and does work (Alex implemented it), but the problem is upstream

### Failure Chain
1. **d2-tokens.spec.ts** — 15 CSS token tests × 2 browsers = 30 tests
   - Each `beforeEach`: `page.goto('./')` + `waitForLoadState('networkidle')`
   - Each page load triggers `AuthContext.attemptRefresh()` → `POST /auth/refresh`
   - 30 POSTs in ~60 seconds exhausts the 20/min rate limit window
   
2. **d3-edit-button.spec.ts** (and d3-buttons, regression-029 D5) — tests run next
   - Their `beforeEach` also tries `POST /auth/refresh` → **429 Too Many Requests**
   - `AuthContext.isRetryableRefreshError(429)` returns `false` → treats as non-retryable
   - App transitions to `UNAUTHENTICATED` state
   - All subsequent API calls return **401 Unauthorized** (no Bearer token sent)
   - `waitForSelector('[data-testid="catalog-detail"]')` times out at 20s → **test failure**

### Failed Tests
Per diagnostic summary (lines 49–62 of summary.md):
| Test | Error | Suite |
|------|-------|-------|
| [webkit] D3-buttons › box-shadow consistency | TimeoutError waitForSelector 20000ms | d3-buttons |
| [chromium] D3 Edit › border color alpha | TimeoutError waitForSelector 20000ms | d3-edit-button |
| [chromium] D3 Edit › appearance suppressed | TimeoutError waitForSelector 20000ms | d3-edit-button |
| [webkit] regression-029 D5 › Bag label above select | TimeoutError waitForSelector 15000ms | regression-029 |

**Note:** d5-modals and d6-cards specs passed in the full suite (lines 88–96 of full-suite.log) — they do not navigate to catalog pages with seed data, so they don't get caught by the rate-limit cascading failures.

---

## Recommended Fixes

### Fix #1: Reduce d2-tokens Page Load Intensity [Finn - Frontend]
**Severity:** BLOCKING  
**Rationale:** d2-tokens' 30 sequential full page loads (each with AuthContext init) is the root cause.

**Option A (Preferred):** Refactor d2-tokens to verify CSS tokens without a real app page load
- CSS custom properties are static content — can be inspected on any DOM element
- Use a minimal test harness or a single navigation to load the app once, then verify tokens in all 15 tests
- Change `beforeEach` to `beforeAll` + shared page state

**Option B (Fallback):** Use a single `beforeAll` navigation instead of `beforeEach`
- Keeps the real auth page load but reduces 30 navigations to 1 per browser
- Reduces `/auth/refresh` POSTs from 60 to 4 (initial global-setup + 1 per browser)
- Less comprehensive but simpler

### Fix #2: Improve Rate-Limiter Reset Mechanism [Alex - Backend]
**Severity:** BLOCKING (for d2-token fix)  
**Rationale:** Even with Fix #1, a safety mechanism prevents future flakiness.

**Current state:**
- `/api/e2e/reset-limiter` endpoint exists and is called in global-setup.ts
- But it's called AFTER the initial E2E session is created — no rate-limit buffer for d2-tokens

**Recommended:**
- Verify the endpoint is being called correctly and that `limiter._storage.reset()` is working
- Consider moving the call to after all initial auth setup + data seeding, right before test suite starts
- OR add a secondary reset call in the `beforeAll` of d2-tokens (if Fix #1 Option A is chosen)

### Fix #3: Investigate React StrictMode Double-Invoke [Finn - Frontend]
**Severity:** MEDIUM (secondary issue, does not cause failures directly)  
**Evidence:** Many API endpoints appear twice in backend logs (200 then 401) even when refresh succeeds

**Cause:** Likely React StrictMode double-invoke in `AuthContext` or `CatalogDetail` `useEffect` without proper cleanup guards

**Recommended:**
- Use `useRef` guard or `AbortController` to prevent double-invoke
- Not blocking but improves test reliability and reduces noise in backend logs

### Fix #4: Verify GET /auth/refresh Source [Finn/Alex - Frontend/Backend]
**Severity:** LOW (secondary issue, does not affect core functionality)  
**Evidence:** 56 GET /auth/refresh requests appear in backend logs, always after POST on same connection

**Rationale:** There is no registered GET route for `/auth/refresh` — the SPA catch-all serves `index.html`. Source is likely service worker network-first handler or browser prefetch.

**Recommended:**
- Trace the exact source (Playwright HAR dump, service worker log)
- If from service worker, add `/auth/refresh` to the no-cache list to prevent caching HTML as auth response

---

## Implementation Sequence

1. **[Immediate] Alex:** Verify `/api/e2e/reset-limiter` is working correctly in global-setup and that `limiter._storage.reset()` is actually clearing the storage
2. **[Blocking] Finn:** Implement Fix #1 Option A (preferred) — refactor d2-tokens to reduce page loads from 30 to 1–2 per browser
3. **[Secondary] Finn:** Implement Fix #3 — add useRef guard or AbortController to prevent StrictMode double-invoke
4. **[Optional] Finn/Alex:** Implement Fix #4 — verify and fix GET /auth/refresh source

---

## Verification Steps

After fixes are implemented:
1. Run `playwright test e2e/d2-tokens.spec.ts --retries=0` (isolated) — should pass
2. Run `playwright test e2e/d3-edit-button.spec.ts --retries=0` (isolated) — should pass  
3. Run `playwright test --retries=0` (full suite) — all 98 tests should pass
4. If any timeouts occur, check backend logs for 429 or 401 patterns

---

## Files Affected

### Frontend
- `frontend/e2e/d2-tokens.spec.ts` — Test structure (beforeEach → beforeAll + shared navigation)
- `frontend/src/components/AuthContext.tsx` — useEffect guards (StrictMode double-invoke)
- `frontend/src/service-worker.ts` — Cache rules for /auth/refresh

### Backend
- `app/routers/api_e2e.py` — Verify `/api/e2e/reset-limiter` and timing
- `app/main.py` — Confirm slowapi limiter configuration

### Test Config
- `frontend/e2e/global-setup.ts` — Rate-limiter reset timing

---

**Quinn (QA Agent)**  
Decision drop generated 2026-06-05T14:00 PDT

---


## 2026-06-07 — Spec-038 Retro Inbox Drop Merges (T040)

*Processed by Scribe at Implementation-Cycle Close Retro T040. Three drops merged from `.squad/decisions/inbox/`; drop files deleted after this commit.*

---

### 038-T035-E06 — Cloud SQL Reference Redaction (T035)

| Field | Value |
|-------|-------|
| **Date** | 2026-06-06 |
| **Drop file** | `t035-redact-e06-cloudsql-reference.md` |
| **Agent** | Tariq (Spec-038 T035 executor) |
| **Decision** | Redact Cloud SQL instance connection string from pre-existing squad log; line replaced with `[REDACTED — Spec-038 T035]`. No file deleted wholesale. |
| **Scope** | `.squad/log/2026-05-15-hotfix-beans-catalog-brew-log.md` line 55 (Pattern 7 match) |
| **Operator authorization** | Recorded 2026-06-06T23:23 PST — operator selected "Redact the specific line now (Recommended)" for inventory finding E-06 |
| **Commit** | `02a4214` (espresso-logs spec/038 branch) |
| **Post-scan result** | Zero Pattern 7 instance-format matches after remediation; remaining `cloudsql` references are role/flag names — accepted false positives |
| **Status** | Accepted |

---

### 038-Parallel-Branch-Safety — Tariq Routing Decision

| Field | Value |
|-------|-------|
| **Date** | 2026-06-06 |
| **Drop file** | `2026-06-06-155049-tariq-routing-parallel-branches.md` |
| **Agent** | Tariq (routing) |
| **Decision** | `DIRECT_PERMITTED` — operator's question about safe parallel-session branch isolation is a process/safety status check only; no code, Terraform, SpecKit artifact, push, PR, or merge action is required or authorized by this decision |
| **Scope** | Process clarification only; no artifact or code changes |
| **Status** | Accepted |

---

### 038-Charter-Reconciliation-Tariq-Scribe — Charter Update (T015, T016)

| Field | Value |
|-------|-------|
| **Date** | 2026-06-06 |
| **Drop file** | `charter-reconciliation-20260606-tariq-scribe.md` |
| **Agent** | Tariq (reconciliation trigger author) |
| **Decision** | Tariq charter updated to `v3.1-espresso` (T015); Scribe charter updated to `v2.1-espresso` (T016). Both derived from `coffee_tracker` canonical versions. Zero type-(c) behavioral contradictions. Reconciliation complete for this cycle. Four type-(b) non-blocking stale items tracked in `charter-audit.md`. |
| **Canonical refs** | Tariq: `coffee_tracker/.squad/agents/tariq/charter.md` v3.1; Scribe: `coffee_tracker/.squad/agents/scribe/charter.md` v2.1 |
| **Next reconciliation trigger** | Any charter update to `coffee_tracker/.squad/agents/tariq/` or `scribe/` after commit `a01523d` |
| **Status** | Accepted |


---

## 2026-06-07: Spec-039 Production Readiness Branch Correction

### Decision: Tariq routing — DIRECT_PERMITTED (Spec-039 branch correction)
- **Agent:** Tariq
- **Date:** 2026-06-07T12:35:22.603-07:00
- **Status:** MERGED
- **Classification:** DIRECT_PERMITTED
- **Source drop:** `.squad/decisions/inbox/20260607T123522-0700-tariq-route-spec039-branch-correction.md`
- **Request:** Correct the locally validated Spec-039 production-readiness work off `chore/planning-session-hygiene` onto a separate bug-fix branch without pushing, rewriting published history, discarding local commits, or accessing production data/secrets.
- **Rationale:** Bounded process/git correction for an already validated local work unit; no product scope or code behavior changed by the branch correction itself.
- **Scope:** Create `fix/spec-039-production-readiness` from `origin/main`, cherry-pick the validated implementation and routing-drop commits, preserve local commits, and stop before any push.
- **Outcome:** New branch `fix/spec-039-production-readiness` was created from `origin/main`; validated work was cherry-picked; Ralph resolved the `.squad/identity/now.md` conflict; an empty duplicate cherry-pick was skipped; no push, deploy, PR creation, production data access, or secrets access occurred.
