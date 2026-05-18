# Squad Decisions

## Active Decisions

### 2025-07-30: ZoneBoundaries — frontend utility, no backend sheet tab

ZoneBoundaries live in `frontend/src/utils/zoneBoundaries.ts` as static TypeScript constants. `MACHINE_TIME_PROFILES` and `ROAST_RATIO_PROFILES` are frontend-only. CompassChart gets optional `zoneBoundaries` prop; defaults to equal-thirds (backward compat, 87 tests unaffected).

---

### 2025-07-30: roast_level already exists end-to-end — no schema change

`roast_level` is declared in `InventoryBagOut`, `BrewLogEntryOut` (Python), `InventoryBag`, `BrewLogEntry` (TypeScript), and resolved in `_resolve_names_from_dicts` from `Inventory.RoastLevel` → `Catalog.Roast_Level` → `None`. No new columns, no form inputs, no regex heuristics needed.

---

### 2025-07-30: LLM call strategy — embed, enrich, persist Zone_Taste

Keep inference embedded in `POST /api/brew-log` (fire-and-forget via `asyncio.create_task`). Enrich prompt with: `machine_name`, `basket_name`, `roast_level` (server-resolved, passed as `extra_context`), `zone_taste` (client-sent, new field on `_BrewLogCreateBody`). `Zone_Taste` persists as new column in `Brew_Log` sheet tab. Frontend: navigate to detail with `?fresh=1` on submit; poll `GET /api/brew-log/{id}/feedback` every 3s until `ai_feedback` arrives.

---

### 2025-07-29: CatalogList FAB Portal Fix — GO

**By:** Product Manager (Priya), Design (Aria), Frontend (Finn), QA (Quinn), Architecture (Maya)  
**Status:** ✅ **APPROVED FOR MERGE**  
**Branch:** bugfix/brew-log-ux-gaps  

**What:** Apply `createPortal(..., document.body)` to the "Add bean" FAB button in `frontend/src/pages/CatalogList.tsx`, and add three portal regression test files to prevent future regressions:
- `frontend/src/pages/CatalogList.test.tsx` (T029)
- `frontend/src/pages/BrewLogList.test.tsx` (T030)  
- `frontend/src/pages/Dashboard.test.tsx` (T031)

**Root Cause:** `#main-content` applies `backdrop-filter: blur(4px)`, which per the CSS Positioned Layout spec creates a new containing block for `position: fixed` descendants. The FAB scrolls with page content instead of staying pinned to viewport bottom-right.

**Why:**
- Same pattern already deployed successfully in BrewLogList.tsx and Dashboard.tsx
- Fixes genuine UX friction point (P1 priority justified)
- Regression tests prevent future removal of `createPortal`
- No API changes, no spec impact, low-risk consolidation

**Verdicts by agent:**
- **Priya (PM):** ✅ GO — user impact justified, scope aligned, ACs met, no unrelated changes
- **Aria (Designer):** ✅ APPROVED — visual behavior preserved; position, z-index, style, CSS inheritance, accessibility all verified
- **Finn (Frontend):** ✅ DECISION MADE — portal applied; adds `import { createPortal }` and wraps FAB; no changes to AddBeanModal or query logic
- **Quinn (QA):** ✅ DECISION MADE — three test files added using three-assertion portal guard pattern (element exists, NOT in component subtree, IS at document.body)
- **Maya (Architect):** ✅ DECISION MADE — audit found 2 non-compliant fixed elements: CatalogList FAB (fixed) + BottomNav (separate issue, deferred); CatalogList fix is low-risk, affecting only render hierarchy

**Conditions:**
- Regression tests must pass pre-merge
- No other unrelated changes on branch

---

### 2025-07-28: Storage Method dropdown — resolved

**By:** Product Owner (relayed via session)
**What:** Storage Method dropdown will remain dynamic (Hardware tab-driven). The seed script (`scripts/seed_storage_hardware.py`) has been corrected to use the 7 canonical values from `docs/requirements/sheet-schema.md`:
1. Frozen — Glass Tube (S01)
2. Frozen — Plastic Tube (S02)
3. Frozen — Bag (S03)
4. Ambient — Glass Tube (S04)
5. Ambient — Plastic Tube (S05)
6. Ambient — Bag (S06)
7. Ambient — Airtight Container (S07)

The seed script has been run against the live spreadsheet. All 7 rows are present in the Hardware tab. The dropdown will populate correctly on next page load.

**Why:** Bootstrapping the spreadsheet with the static enum satisfies the dynamic pull without removing the flexibility of the Hardware-driven approach.
**Closes:** Storage Method dropdown HOLD condition (data-layer track, Phase 5).

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

**By:** skarthikkrishna (via Copilot)  
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

---

## 2026-05-14: Routing decision — M4 read switchover (Priya)

**Status:** DIRECT_PERMITTED

M4 Read Switchover is execution of a pre-specified, pre-architected migration milestone. No new product scope. Implementation plan already defined in `docs/requirements/engineering_architecture_v2.md` (§ Phase M4). All infrastructure already in place: SQL repos have `list()`/`get()` read methods, `USE_POSTGRES` flag exists in `app/config.py`, and `self._sql` is injected into all five `_DualWrite*` wrappers in `app/deps.py`.

**Scope:** Flip read path in all five `_DualWrite*` classes in `app/deps.py` from `self._sheets` to `self._sql` when `settings.use_postgres=True`. Update tests to cover both read paths. No router, service, frontend, or schema changes required.

**Gates:** Quinn gate required (application code change). M3 backfill completion must be verified before flipping env var in prod.

---

## 2026-05-15: Household transition strategy — UPDATE-based reassignment (Maya)

**Status:** PENDING (open questions outstanding)

**ADR:** `docs/architecture/adr-001-household-transition.md`

When the multi-user auth milestone arrives, the `default_household` (seeded in M4, now containing all migrated data) **must be claimed by the first real authenticated user via UPDATE, not delete+recreate**.

- **MUST:** UPDATE `household.owner_user_id` (or equivalent) to link the default household to a real user
- **MUST NOT:** Delete or recreate the `default_household` UUID — all foreign keys depend on it
- **MUST NOT:** Move data rows to a different household UUID

**Open questions (must resolve before auth milestone):**
- Single-user app (household ≈ user) or multi-tenant (multiple households)?
- Should `system_user` be soft-deleted, hard-deleted, or archived?
- Should the default household claim be automatic (on first login) or manual (admin command)?

---

---

### 2026-05-15T14:37:34-07:00: Routing decision — USE_POSTGRES to APP_SECRETS

**By:** Alex (routing)
**What:** DIRECT_PERMITTED — move `USE_POSTGRES` from Cloud Run standalone env var into the `APP_SECRETS` JSON blob and ensure the app reads it exclusively via `settings.use_postgres`.
**Scope:**
- `app/config.py` — minor comment update only: clarify that `use_postgres` / `USE_POSTGRES` may be sourced from the APP_SECRETS blob in production (no logic changes required)
- Operational (not in repo): remove `USE_POSTGRES=true` standalone env var from Cloud Run service; add `"USE_POSTGRES": true` to the APP_SECRETS JSON blob in Secret Manager
- `.env.example` — no change needed (standalone `USE_POSTGRES=false` remains correct for local dev)
- `cloudbuild.yaml` — no change needed (`USE_POSTGRES` is not in `--set-env-vars` already)

**Why:** The `_load_app_secrets` model validator in `config.py` already handles this generically — it iterates all APP_SECRETS blob keys, lowercases them, and injects them into the pydantic-settings `data` dict before field validation. `USE_POSTGRES` from the blob maps directly to `use_postgres` field via `field_name = key.lower()`. No direct `os.environ.get("USE_POSTGRES")` calls exist anywhere in app code — all access is through `settings.use_postgres`. The change is bounded: one optional comment clarification in `config.py`; the rest is a GCP Console / Secret Manager operation outside the repo.

---

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction

---

## 2026-05-15 — Session: hotfix/beans-catalog-brew-log

### Routing Decision — Beans/Catalog Hotfix (Priya)

**Date:** 2026-05-15  
**Agent:** Priya  
**Decision:** DIRECT_PERMITTED  
**Trigger:** Three user-reported production bugs in the beans/catalog domain

**Bugs:**
1. Cannot add new beans
2. Cannot view catalog or add to catalog
3. New brew log form shows empty beans dropdown

**Root Cause Hypotheses:**
- Bug 1 & 2a: `AddBeanModal.tsx` — no client-side validation for required fields (`roast_level`, `roaster`, `bean_name`); backend returns HTTP 422 silently
- Bug 2b: Production `APP_SECRETS` blob may be missing `use_postgres: true` → Sheets fallback → 500 if Sheets auth stale
- Bug 3: `BrewLogAdd.tsx` — `isError` not destructured from inventory query; silent failure renders empty dropdown

**Fix scope:** `frontend/src/components/AddBeanModal.tsx`, `frontend/src/pages/BrewLogAdd.tsx` — no new API endpoints, no schema changes.

**Status: DIRECT_PERMITTED**

---

### Decision Drop — IAM Grants for Cloud Build SA (Tariq)

**Date:** 2026-05-15  
**Agent:** Tariq  
**Triggered by:** hotfix/beans-catalog-brew-log

`cloudbuild.yaml` updated to mount `DATABASE_URL` via `--set-secrets` and pass `--add-cloudsql-instances`. Cloud Build SA (`coffee-tracker-cloudbuild@<your-gcp-project>.iam.gserviceaccount.com`) required two new IAM grants:

- `roles/secretmanager.secretAccessor` on `DATABASE_URL` secret (resource-scoped)
- `roles/cloudsql.client` at project level

**Path taken:** Terraform (`tf-infra` repo) — consistent with existing codified IAM patterns. New resources added to `secrets.tf` and `iam.tf`. Branch `hotfix/iam-cloudbuild-database-url`, commit `23d1236`. PR #26 merged; `terraform apply` succeeded — grants live in GCP.

**Sequence dependency:** `hotfix/beans-catalog-brew-log` deploy was BLOCKED until tf-infra apply completed.

---

### Decision Drop — PR #71 Copilot Review Fixes (Alex)

**Date:** 2026-05-15  
**Author:** Alex  
**Branch:** config/use-postgres-to-app-secrets  
**Commit:** bffbe7a

Narrowed `use_postgres` inline comment in `app/config.py` to accurately reflect:
1. Env vars take precedence over APP_SECRETS blob values — stale standalone `USE_POSTGRES` env var would silently override (now documented as warning)
2. Scope boundary: secrets (DATABASE_URL, USE_POSTGRES, API keys) → APP_SECRETS blob; infra config (APP_ENV, OAUTH_REDIRECT_URI) → standalone env vars
3. `docs/requirements/engineering_architecture_v2.md` rollback instructions corrected to reference APP_SECRETS blob (not standalone env var)

No logic changes — purely documentation/comment correctness.

---

### Decision Drop — PR #72 Feedback Addressed (Alex)

**Date:** 2026-05-15

1. Stale inbox merged — `decisions/inbox/alex-use-postgres-routing.md` appended and deleted
2. `scribe-charter.md` template synced — added `Reuse Before Create` section, APP_SECRETS line, Git Protocol update
3. `SKILL.md` corrected — `reuse-before-create/SKILL.md` now references `app/config.py` (`Settings._load_app_secrets`) as canonical APP_SECRETS pattern
4. `charter.md` template push wording collapsed to single authoritative line
5. All 9 agent charters updated with consistent push prohibition wording

---

### Routing Decision — PR #72 Feedback (Tariq)

**Date:** 2026-05-15  
**What:** DIRECT_PERMITTED — 5 governance file updates (`.squad/` only)  
**Scope:** templates, skills, inbox merge — no feature work, no code, no tests  
**Rationale:** Mechanical template maintenance and policy wording. No SpecKit trigger; no blocking dependencies.

---

# Routing Decision — Beans/Catalog Hotfix

**Date:** 2026-05-15  
**Agent:** Priya  
**Decision:** DIRECT_PERMITTED  
**Trigger:** Three user-reported production bugs in the beans/catalog domain

---

## Bugs Under Investigation

1. Cannot add new beans
2. Cannot view catalog or add to catalog
3. New brew log form shows empty beans dropdown

---

## Investigation Summary

### Backend (all clean)
- `app/routers/api_catalog.py` — routes correctly registered; all async/await patterns correct
- `app/repos/catalog.py` + `_DualWriteCatalogRepo` — properly wired; `list`, `get`, `upsert`, `_fetch_all` all present
- `app/routers/api_inventory.py` — `_resolve_display_name` correctly falls back when catalog entry is absent
- `app/main.py` — `api_catalog.router` is included
- **400 tests pass**, `mypy --strict` clean, `ruff check` clean
- No route conflicts: `POST /api/catalog` and `POST /api/catalog/infer` are distinct paths

### Frontend (builds clean, type-checks pass)
- `frontend/src/api/catalog.ts` — all API calls correctly typed and targeted
- `frontend/src/pages/CatalogList.tsx` — correct error/loading states for the catalog query
- `frontend/src/components/AddBeanModal.tsx` — **no client-side validation** for required fields (`roast_level`, `roaster`, `bean_name`) before submit
- `frontend/src/pages/BrewLogAdd.tsx` — **no error handling** for the inventory query (`isError` not destructured); silent failure renders empty dropdown

### Recent commit context
- `eb1fddb` — react-router-dom 6 → 7 (May 12, Dependabot); API-compatible, no breaking usage
- `a8471c4` — TypeScript 5 → 6 (May 12, Dependabot); compiles cleanly
- `68d7505` — `USE_POSTGRES` moved into `APP_SECRETS` blob (May 15); if production APP_SECRETS blob does not include `use_postgres: true`, `use_postgres` defaults to `False`, reads fall back to Sheets. Sheets writes are always first in the dual-write pattern so Sheets data should be intact — this is low-suspicion for the catalog list failure but should be verified in production.

---

## Root Cause Hypothesis (per bug)

### Bug 1 — Cannot add new beans
**Primary cause:** `AddBeanModal.tsx` has no client-side validation for required fields. When `roast_level` is empty (inference returned no roast level and user did not select one), the backend returns HTTP 422. The catch block surfaces a generic "Failed to save bean. Please try again." with no field-level guidance. Users retry and fail repeatedly, perceiving the feature as broken.

**Fix target:** `frontend/src/components/AddBeanModal.tsx` — add field-presence checks before calling `createCatalogItem`; surface which field is missing.

### Bug 2 — Cannot view catalog or add to catalog
**Two sub-causes:**
- **2a (add to catalog):** Same as Bug 1 — save silently fails due to missing `roast_level`. "Add to catalog" is the modal's save path; it errors with no useful feedback.
- **2b (view catalog):** If production `APP_SECRETS` blob is missing `use_postgres: true` after the M5 migration, `use_postgres` defaults to `False`. Reads go to Sheets. If Sheets auth credentials are stale or misconfigured on the current Cloud Run revision, `GET /api/catalog` returns 500 and `CatalogList` enters its error state. This is a production-environment issue, not a code defect, but worth noting.

**Fix targets:**
- `frontend/src/components/AddBeanModal.tsx` (same as Bug 1)
- Production: verify APP_SECRETS blob contains `use_postgres` and that Sheets service-account credentials are valid

### Bug 3 — Empty beans dropdown in brew log form
**Primary cause:** `BrewLogAdd.tsx` does not handle the error state for the inventory query. `isError` is not destructured from `useQuery`; when `listInventory('Active')` fails, `inventory` is `undefined` and `inventory?.map()` renders zero options silently. The user sees only "Select bag…" — indistinguishable from "no active bags."

**Secondary cause (data):** If there are genuinely no bags with status "Active" in inventory (e.g. all bags are "Finished"), the dropdown is also empty — correct behaviour but uninformative.

**Fix target:** `frontend/src/pages/BrewLogAdd.tsx` — destructure `isError` from the inventory query; show an inline error or retry prompt when the query fails.

---

## Scope Confirmation

All changes are frontend-only (plus optional production config verification):

| File | Change |
|---|---|
| `frontend/src/components/AddBeanModal.tsx` | Add client-side required-field validation; improve save-error message |
| `frontend/src/pages/BrewLogAdd.tsx` | Add `isError` handling for inventory query; surface load failure to user |
| Production APP_SECRETS (out-of-band) | Verify `use_postgres` key present and Sheets credentials valid |

No new API endpoints, no schema changes, no new feature surface. Changes are self-contained within two component files.

---

## Routing Decision

**status: DIRECT_PERMITTED**

Rationale: All three bugs trace to bounded, identifiable defects in existing frontend components (missing validation, missing error state) plus a probable production config state to verify out-of-band. No new features, no data model changes, no cross-service impact. A hotfix touching two component files is the correct response. SpecKit cycle is not warranted.
# Decision Drop — Priya routing assessment
# 2026-05-15 — Hardware maintenance display + Brew log internal IDs

**Agent:** Priya (Product Manager)
**Date:** 2026-05-15
**Scope:** Bugs reported post-Postgres-migration

---

## Bugs assessed

### Bug 1 — Hardware view does not show maintenance logs

**Status: DIRECT_PERMITTED**

**Symptom:** Hardware detail panel always shows "No maintenance records." regardless of whether events
exist in Google Sheets.

**Root cause (confirmed by source inspection):**

The `maintenance_log` table has a `sheets_hardware_id TEXT` column added by migration 0005
(2026-05-14). That migration adds the column with no backfill SQL. Before 0005 was applied to
production, `SqlMaintenanceRepo.add()` tried to insert rows with `sheets_hardware_id` into a table
that didn't have that column yet. SQLAlchemy raised a DB error. `_DualWriteMaintenanceRepo.add()`
silently catches all SQL exceptions and continues. Result: every maintenance event written during
the period when 0005 was un-applied was accepted by Sheets but **rejected from Postgres without
surfacing an error to the caller**. The data exists in Sheets; it does not exist in Postgres.

After migration 0005 was applied (via `alembic upgrade head` in the PR #73 session), the column
now exists but there is no Postgres data to filter by. `SqlMaintenanceRepo.list(hardware_id=...)`
executes `WHERE sheets_hardware_id = ?` and returns an empty result. The frontend renders
"No maintenance records."

Additionally: `MaintenanceLog.hardware_id` (UUID FK → `hardware.id`) is never populated by
`SqlMaintenanceRepo.add()`. There is therefore no UUID-based join path that could be used for a
pure-SQL backfill. The data must be re-read from Sheets.

**Fix scope (bounded, no product decisions needed):**
1. Add a `SqlMaintenanceRepo.upsert()` method that inserts or updates by `sheets_id` (unique
   constraint exists) — prevents duplicate rows during backfill.
2. Add a startup backfill hook (or `POST /api/admin/resync-maintenance` endpoint) that reads all
   maintenance events from the Sheets-backed `MaintenanceRepo`, then calls
   `SqlMaintenanceRepo.upsert()` for each row. This populates `sheets_hardware_id` from
   `row["Hardware_ID"]`.
3. No schema migration needed (column already exists after 0005).
4. No frontend changes (frontend code is correct; it correctly renders `detail.maintenance`).

---

### Bug 2 — Brew Log and home page show internal Bag_IDs instead of bean/catalog names

**Status: DIRECT_PERMITTED**

**Symptom:** Brew log list and detail views display raw IDs like `Ve20250201M` instead of
"Roaster — Bean name".

**Root cause (confirmed by source inspection):**

`_resolve_names_from_dicts()` in `app/routers/api_brew_log.py` resolves bean display names by:

```
shot["Bag_ID"] → bags[bag_id]["Catalog_ID"] → catalog[catalog_id]["Roaster"] + ["Bean_Name"]
```

When `use_postgres=True`, `bags` is populated from `SqlInventoryRepo.list_all()` which returns
`"Catalog_ID": row.sheets_catalog_id or ""`.

`sheets_catalog_id` was added to `inventory_bags` by migration 0006 (2026-05-15). That migration
adds the column with no backfill. Before 0006 was applied, `SqlInventoryRepo.upsert()` tried to
set `existing.sheets_catalog_id` — a column that didn't exist in the DB yet — and received a DB
error that was silently caught by `_DualWriteInventoryRepo`. Inventory bags may exist in Postgres
(written before the `sheets_catalog_id` attribute was added to the ORM model), but those rows
have `sheets_catalog_id = NULL`.

Result: `bag_row.get("Catalog_ID", "")` returns `""` for all existing bags →
`catalog.get("", {})` returns `{}` → neither `Roaster` nor `Bean_Name` is resolved →
`bag_display` falls back to `bag_id` (the internal Sheets composite key like `Ve20250201M`).

This is a V1 core functional requirement violation (spec §9.2: "List view: frosted-glass cards;
date, **bean name**, roast level…"; §9.7: "no internal IDs in UI").

**Relationship to PR #73:** PR #73 fixes the migration pipeline (cloudbuild.yaml) and the
`DATABASE_URL` injection gap. Migration 0006 was applied manually to production during that
session. However, PR #73 does **not** backfill existing `inventory_bags` rows. All rows written
before 0006 was applied still have `sheets_catalog_id = NULL`. This bug is NOT fixed by PR #73
merging — it requires a separate backfill.

**Fix scope (bounded, no product decisions needed):**
1. A Sheets→Postgres backfill for existing `inventory_bags` rows: read all bags from
   `InventoryRepo` (Sheets-backed), call `SqlInventoryRepo.upsert(row)` for each. Since
   `upsert()` already handles INSERT vs UPDATE by `sheets_id`, and the column now exists, this
   will set `sheets_catalog_id = row["Catalog_ID"]` for all existing rows.
2. Implement as a startup backfill hook (idempotent: `WHERE sheets_catalog_id IS NULL`) or as an
   admin endpoint `POST /api/admin/resync-inventory`.
3. No schema migration needed (0006 already added the column and was applied to production).
4. No frontend changes (frontend correctly uses `entry.bag_display`).

---

## Combined routing verdict

| Bug | Status | Rationale |
|-----|--------|-----------|
| Hardware maintenance not displayed | DIRECT_PERMITTED | Pure data backfill regression. No product decisions. Backend only. |
| Brew log shows internal IDs | DIRECT_PERMITTED | Pure data backfill regression. V1 spec violation but fix is a Sheets→Postgres re-sync. No product decisions. Backend only. |

**Both bugs can be addressed on a single new branch off `main`.**
Branch name suggestion: `fix/postgres-backfill-maintenance-catalog`

**Relationship to open work:**
- PR #73 (`hotfix/beans-catalog-brew-log`): Addresses configuration and CI gaps. Not overlapping.
  Both PRs can coexist; this new work is complementary. However, PR #73 should merge first (or
  this branch should be based on PR #73's branch) since PR #73 includes the `cloudbuild.yaml`
  migration step that ensures this doesn't regress on future deploys.
- No SpecKit artifacts required. No Quinn gate required (no new user-facing behaviour; pure
  regression fix restoring V1 spec compliance).

**Implementation note for Alex:**
Both fixes follow the same pattern — a startup idempotent backfill via the DualWrite repos.
Consider a single `_backfill_postgres_from_sheets()` coroutine (or equivalent) called from
`app/main.py` `lifespan()` when `USE_POSTGRES=True`, covering both entities. Guard with
`WHERE sheets_catalog_id IS NULL` / `WHERE sheets_hardware_id IS NULL` so subsequent deploys
are no-ops.
# RCA: CI/format Failure on PR #73 — hotfix/beans-catalog-brew-log

**Author:** Tariq  
**Date:** 2026-05-16  
**Run ID:** 25954236107  
**PR:** #73  
**Branch:** hotfix/beans-catalog-brew-log  
**Failing job:** `CI/format`  
**Status:** Root cause identified. No fix applied. Awaiting operator authorisation.

---

## What Failed

```
Would reformat: app/routers/api_catalog.py
1 file would be reformatted, 109 files already formatted
Process completed with exit code 1
```

`ruff format --check app/ tests/` exits 1 because `app/routers/api_catalog.py` does not
comply with ruff's output format. All other 109 files pass.

---

## Why It Failed

**Proximate cause:** Commit `1e9a15c0ba24e4f81b695c562c533639a2449ad7` ("ci: force
synchronize event on PR #73") appended a trailing blank line to the end of
`app/routers/api_catalog.py`.

**Exact change:**
```diff
-    return JSONResponse({"image_path": image_path})
+    return JSONResponse({"image_path": image_path})
+
```

The file now ends with two newline characters (`\n\n`) — a blank trailing line after the
final statement. Ruff's formatter requires exactly one trailing newline with no blank line
after the last code line. The extra blank line causes ruff to report the file as needing
reformatting.

**Verified locally:**
```
$ uv run ruff format --check app/ tests/
Would reformat: app/routers/api_catalog.py
1 file would be reformatted, 109 files already formatted
Exit code: 1
```

---

## Scope

- **Only one file is affected:** `app/routers/api_catalog.py`, line 470 (trailing blank line).
- All other CI jobs (lint, mypy, pytest) pass. This is an isolated formatting issue.
- No logic, types, or tests are involved.

---

## Minimal Fix (authorisation required before applying)

Remove the trailing blank line from `app/routers/api_catalog.py` so the file ends with
exactly one newline after `return JSONResponse({"image_path": image_path})`. Equivalently,
run `uv run ruff format app/routers/api_catalog.py` and commit the result.

After the fix:
```
$ uv run ruff format --check app/ tests/
110 files already formatted
Exit code: 0
```

---

## Decision

**No fix has been applied.** This RCA is submitted to the coordinator for authorisation
per Inviolable Rule 3 (build failures trigger Tariq triage before any fix attempt).

The fix is trivial and self-contained. Once authorised, it can be committed directly on
`hotfix/beans-catalog-brew-log` with a `[skip ci]` commit message prefix, then CI should
be re-triggered on the resulting push to confirm green.
# Decision Drop — Cloud Build Shell Variable Escape Fix

**Date:** 2026-05-17  
**Agent:** Tariq (CI/CD)  
**Type:** Hotfix  
**Status:** Committed (not pushed)

## Context

Deploy workflow run 25978094988 failed at submission time with:

```
ERROR: (gcloud.builds.submit) INVALID_ARGUMENT: generic::invalid_argument:
invalid value for 'build.substitutions': key in the template "PROXY_PID"
is not a valid built-in substitution
```

## Root Cause

In the `migrate` step of `cloudbuild.yaml`, the shell script used `$!` and `$PROXY_PID` as
POSIX shell variables to track the Cloud SQL Auth Proxy PID. Cloud Build parses **all** `$VAR`
references in step `args` as substitution variables at submission time — before the shell
ever executes. `PROXY_PID` is not a declared substitution variable, so the build was rejected
before any step ran.

## Decision

Escape both shell variable references with `$$` syntax (Cloud Build's escape sequence for a
literal `$` passed through to the shell):

- `PROXY_PID=$!`  →  `PROXY_PID=$$!`
- `kill $PROXY_PID || true`  →  `kill $$PROXY_PID || true`

`$_CLOUDSQL_INSTANCE` on the same line is a declared substitution variable and requires no
change.

## Validation

All four local CI checks passed after the fix:
- `ruff check` — ✅ All checks passed
- `ruff format --check` — ✅ 110 files already formatted
- `mypy --strict` — ✅ No issues found in 53 source files
- `pytest` — ✅ 403 passed, 4 skipped

## Commit

`fix(deploy): escape shell variables in cloudbuild migrate step`

## Rule Applied

Cloud Build YAML convention: shell variables in multi-line bash `args` must use `$$VAR`
syntax to prevent Cloud Build from interpreting them as substitution variables at submission time.
# Decision: _CLOUDSQL_INSTANCE placement in Cloud Build pipeline

**Date:** 2026-05-17  
**Authors:** Maya (architect) + Alex (backend engineer)  
**Status:** DECIDED  
**Urgency:** Production deploy was blocked — decision needed immediately.

---

## Decision

**Option A — Hardcode in `cloudbuild.yaml` substitutions block.**

`_CLOUDSQL_INSTANCE: <your-gcp-project>:us-west1:espresso-logs-db` is committed directly in the `substitutions:` block of `cloudbuild.yaml`. This is already the current state as of this decision.

---

## Rationale

### Maya (architectural view)

Option B (set in Cloud Build trigger via GCP Console) was invalidated by a concrete infrastructure fact: `buildtrigger.tf` in the tf-infra repo **explicitly states that `google_cloudbuild_trigger` resources have been removed**. Builds are triggered by GitHub Actions via `gcloud builds submit` — there is no GCP Console trigger to configure. Option B does not exist as an operational path.

Option C (parse from APP_SECRETS at build time) adds unjustified complexity. APP_SECRETS is a Cloud Run runtime secret injected by Cloud Run's `--set-secrets` mechanism — it is not available to Cloud Build steps without additional `secretEnv` wiring and JSON parsing logic. The complexity cost is high; the benefit (avoiding a single non-sensitive string in code) is negligible.

Option A is therefore the only viable choice, and it is architecturally sound:
- `_CLOUDSQL_INSTANCE` is **not sensitive**. Cloud SQL instance connection names appear in Cloud Run `--add-cloudsql-instances` flags, logs, and IAM bindings — they are infra identifiers, not secrets.
- **Precedent already exists in this file**: `_REGION: us-west1` and `_SERVICE_NAME: coffee-tracker` are hardcoded in the same substitutions block. `_CLOUDSQL_INSTANCE` is structurally identical — a non-sensitive, environment-specific infra identifier.
- Keeping it in code makes the build fully self-describing. Any developer can read `cloudbuild.yaml` and understand exactly what instance the migrate step connects to, without consulting GCP Console or a separate config store.

If the Cloud SQL instance ever changes, a one-line commit to `cloudbuild.yaml` is the correct mechanism — auditable, reviewable, and version-controlled.

### Alex (implementation view)

The value is already present in `cloudbuild.yaml` line 214 as of this decision:
```yaml
_CLOUDSQL_INSTANCE: <your-gcp-project>:us-west1:espresso-logs-db
```

No further implementation action is required for this variable. The migrate step (Step 5b-2) consumes it correctly:
```bash
/workspace/cloud-sql-proxy --unix-socket=/cloudsql $_CLOUDSQL_INSTANCE &
```

And the deploy step consumes it:
```
--add-cloudsql-instances=$_CLOUDSQL_INSTANCE
```

The only variables that legitimately belong in `<SET_IN_TRIGGER>` are those that **cannot be known at commit time** or that are **service-account email addresses** (which vary by GCP project setup and are closer to infrastructure identity than app config). `_RUNTIME_SA` and `_CLOUDBUILD_SA` correctly remain as `<SET_IN_TRIGGER>` — they are passed via `--substitutions` in the GitHub Actions workflow.

---

## Conditions and future considerations

- If the project ever moves back to GCP Console-managed Cloud Build triggers (e.g., Terraform codifies a `google_cloudbuild_trigger` resource again), `_CLOUDSQL_INSTANCE` should be migrated to that trigger's substitutions block to keep all environment-specific config in one place.
- If espresso-logs ever becomes multi-environment (staging vs. prod triggers), `_CLOUDSQL_INSTANCE` should be parameterised per trigger at that point.
- Neither condition applies today.

---

## Alternatives considered and rejected

| Option | Verdict | Reason |
|--------|---------|--------|
| B — GCP Console trigger | Rejected | No Cloud Build trigger exists; builds run via `gcloud builds submit` from GitHub Actions |
| C — Parse from APP_SECRETS | Rejected | APP_SECRETS is a Cloud Run runtime secret; making it available at build time requires extra `secretEnv` wiring and JSON parsing — unjustified complexity for a non-sensitive value |
# Decision Drop — Cloud Run Health Probe 302 Redirect: Root Cause Analysis

**Date:** 2026-05-17T06:29:25Z  
**Agent:** Tariq  
**Status:** DIAGNOSIS COMPLETE — fix required before next deploy  
**Type:** Deployment failure RCA

---

## Symptom

Cloud Run probes `GET /health` on the new revision and receives `302 Found` (redirect to `/auth/login`). Cloud Run requires a 2xx response to declare the revision healthy. The revision remains in "Deploying" state until the deploy step times out.

---

## Root Cause

### There is no `/health` route in the application.

`app/routers/health.py` exposes only two unauthenticated endpoints:

```
GET /livez   → {"status": "ok"}
GET /readyz  → {"status": "ok"}
```

`GET /health` is not defined. It was never defined — `git log` shows `health.py` has existed unchanged since the initial commit (`ed413fe`).

### What happens when Cloud Run probes `/health`

1. Request hits FastAPI. No router matches `/health`.
2. Falls through to the SPA catch-all in `app/main.py`:
   ```python
   @app.get("/{full_path:path}", include_in_schema=False)
   async def spa_catch_all(full_path: str, _user: CurrentUser) -> HTMLResponse:
   ```
3. `CurrentUser` → `_get_current_user(request)` → no session cookie on a Cloud Run probe → raises `_RequiresLogin`.
4. `requires_login_handler` in `app/main.py` catches `_RequiresLogin`:
   ```python
   @app.exception_handler(_RequiresLogin)
   async def requires_login_handler(request: Request, exc: _RequiresLogin) -> RedirectResponse:
       return RedirectResponse(url="/auth/login", status_code=302)
   ```
5. Cloud Run receives `302` → not 2xx → health check failure → deploy timeout.

### Why `cloudbuild.yaml` doesn't protect against this

The `gcloud run deploy` step in `cloudbuild.yaml` does not specify `--startup-probe` or any health check path. Cloud Run inherits whatever probe is persisted in the service's existing configuration. This configuration is set outside `cloudbuild.yaml` — most likely via the GCP Console or a prior `gcloud` invocation that explicitly set an HTTP startup probe at `/health`.

### Why it worked before

The most likely explanation: the Cloud Run service originally used **TCP probing** (the default for Cloud Run Gen1, and the initial Cloud Run Gen2 default when no probe is configured). TCP probing only checks that the container is listening on port 8080 — it doesn't make an HTTP request. This always succeeds once the app starts.

Something changed the probe to **HTTP GET `/health`** — either:
- A manual change in the GCP Console (Health checks tab on the revision or service)
- A previous `gcloud run deploy` call that included `--startup-probe=httpGet.path=/health`
- A Cloud Run platform update that changed default probe behaviour for this service generation

Once set, this probe configuration persists across all deployments because `cloudbuild.yaml` never explicitly configures or resets it.

---

## Evidence Summary

| Finding | File | Detail |
|---|---|---|
| No `/health` route | `app/routers/health.py` | Only `/livez` and `/readyz` defined |
| SPA catch-all requires auth | `app/main.py:196` | `CurrentUser` dependency on `/{full_path:path}` |
| Auth failure → 302 | `app/main.py:131-133` | `_RequiresLogin` → `RedirectResponse(url="/auth/login", status_code=302)` |
| No probe config in CI | `cloudbuild.yaml:125-152` | `gcloud run deploy` step has no `--startup-probe` flag |
| `/health` never existed | `git log -- app/routers/health.py` | Single commit: `ed413fe` initial commit |

---

## Fix Options

### Option A — Add `/health` to the application (recommended primary fix)

Add an unauthenticated `GET /health` route to `app/routers/health.py`:

```python
@router.get("/health")
async def health() -> JSONResponse:
    """Cloud Run startup probe — returns 200 as long as the process is running."""
    return JSONResponse({"status": "ok"})
```

**Pros:** Application explicitly handles the probe path. Works regardless of what probe path is configured in Cloud Run or any other infrastructure. Zero config change required in Cloud Build or GCP Console.

**Cons:** Slightly duplicates `/livez` functionality. (Acceptable — the paths serve different audiences: Cloud Run infrastructure vs Kubernetes-style tooling.)

### Option B — Pin the startup probe in `cloudbuild.yaml` (recommended defence-in-depth)

Add `--startup-probe=httpGet.path=/livez,port=8080` to the `gcloud run deploy` step:

```yaml
- '--startup-probe=httpGet.path=/livez,port=8080'
```

This makes the probe configuration explicit and version-controlled. Any manually-set probe in the GCP Console will be overridden on the next deploy.

**Pros:** Infrastructure-as-code — probe path is declared in the repo, not hidden in GCP Console. Explicit intent.  
**Cons:** Requires an operator to push a change to trigger the override.

### Recommendation

**Apply both.** A is the immediate unblock — it makes the app respond 200 on any probe path the infra team has configured. B is the long-term guard — it pins the probe to `/livez` in source and prevents this class of misconfiguration from recurring.

Do not apply B alone: if the GCP Console probe is still set to `/health`, B only fixes the probe on the next deploy. If Option A is applied first, both `/health` and `/livez` respond 200 and the deploy unblocks immediately.

---

## Action Required

1. **Alex or skarthikkrishna** to implement Fix A (`GET /health` in `health.py`) — one-line change, no auth, no deps.
2. **skarthikkrishna** to add Fix B (`--startup-probe` in `cloudbuild.yaml`) as the follow-up defence.
3. Verify by re-triggering the Cloud Build pipeline after Fix A is merged to main.

**Blocked state:** Every deploy will fail until Fix A or an equivalent probe reconfiguration (pointing `/health` to `/livez` via a Cloud Run console update) is in place.

---

## Out of Scope

- Investigating the exact mechanism that changed the probe to `/health` (Cloud Run console audit log would show this but is not accessible from this repo)
- Changing the existing `/livez` or `/readyz` routes
- Any changes to auth middleware or `_RequiresLogin` handling
# Routing Decision — Bean Name Display + Maintenance Log Bugs

**Agent:** Alex (Backend Engineer)  
**Date:** 2026-05-17  
**Status:** DIRECT_PERMITTED  
**Requested by:** skarthikkrishna  

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
### 2026-05-17T06:36:45-07:00: Operator authorised resumption post-RCA

**By:** skarthikkrishna (operator)
**What:** Operator has read Tariq's RCA (`.squad/log/20260517T133037Z-rca.md`) covering four Inviolable Rule violations (no squad dispatch, direct pushes to main, no operator push approval, integration tests skipped) and has explicitly authorised work to resume under correct protocol.
**Why:** Satisfies Remediation Step R6 — formal operator acknowledgment required before work continues.

---



---

# Routing Decision — Beans/Catalog Hotfix

**Date:** 2026-05-15  
**Agent:** Priya  
**Decision:** DIRECT_PERMITTED  
**Trigger:** Three user-reported production bugs in the beans/catalog domain

---

## Bugs Under Investigation

1. Cannot add new beans
2. Cannot view catalog or add to catalog
3. New brew log form shows empty beans dropdown

---

## Investigation Summary

### Backend (all clean)
- `app/routers/api_catalog.py` — routes correctly registered; all async/await patterns correct
- `app/repos/catalog.py` + `_DualWriteCatalogRepo` — properly wired; `list`, `get`, `upsert`, `_fetch_all` all present
- `app/routers/api_inventory.py` — `_resolve_display_name` correctly falls back when catalog entry is absent
- `app/main.py` — `api_catalog.router` is included
- **400 tests pass**, `mypy --strict` clean, `ruff check` clean
- No route conflicts: `POST /api/catalog` and `POST /api/catalog/infer` are distinct paths

### Frontend (builds clean, type-checks pass)
- `frontend/src/api/catalog.ts` — all API calls correctly typed and targeted
- `frontend/src/pages/CatalogList.tsx` — correct error/loading states for the catalog query
- `frontend/src/components/AddBeanModal.tsx` — **no client-side validation** for required fields (`roast_level`, `roaster`, `bean_name`) before submit
- `frontend/src/pages/BrewLogAdd.tsx` — **no error handling** for the inventory query (`isError` not destructured); silent failure renders empty dropdown

### Recent commit context
- `eb1fddb` — react-router-dom 6 → 7 (May 12, Dependabot); API-compatible, no breaking usage
- `a8471c4` — TypeScript 5 → 6 (May 12, Dependabot); compiles cleanly
- `68d7505` — `USE_POSTGRES` moved into `APP_SECRETS` blob (May 15); if production APP_SECRETS blob does not include `use_postgres: true`, `use_postgres` defaults to `False`, reads fall back to Sheets. Sheets writes are always first in the dual-write pattern so Sheets data should be intact — this is low-suspicion for the catalog list failure but should be verified in production.

---

## Root Cause Hypothesis (per bug)

### Bug 1 — Cannot add new beans
**Primary cause:** `AddBeanModal.tsx` has no client-side validation for required fields. When `roast_level` is empty (inference returned no roast level and user did not select one), the backend returns HTTP 422. The catch block surfaces a generic "Failed to save bean. Please try again." with no field-level guidance. Users retry and fail repeatedly, perceiving the feature as broken.

**Fix target:** `frontend/src/components/AddBeanModal.tsx` — add field-presence checks before calling `createCatalogItem`; surface which field is missing.

### Bug 2 — Cannot view catalog or add to catalog
**Two sub-causes:**
- **2a (add to catalog):** Same as Bug 1 — save silently fails due to missing `roast_level`. "Add to catalog" is the modal's save path; it errors with no useful feedback.
- **2b (view catalog):** If production `APP_SECRETS` blob is missing `use_postgres: true` after the M5 migration, `use_postgres` defaults to `False`. Reads go to Sheets. If Sheets auth credentials are stale or misconfigured on the current Cloud Run revision, `GET /api/catalog` returns 500 and `CatalogList` enters its error state. This is a production-environment issue, not a code defect, but worth noting.

**Fix targets:**
- `frontend/src/components/AddBeanModal.tsx` (same as Bug 1)
- Production: verify APP_SECRETS blob contains `use_postgres` and that Sheets service-account credentials are valid

### Bug 3 — Empty beans dropdown in brew log form
**Primary cause:** `BrewLogAdd.tsx` does not handle the error state for the inventory query. `isError` is not destructured from `useQuery`; when `listInventory('Active')` fails, `inventory` is `undefined` and `inventory?.map()` renders zero options silently. The user sees only "Select bag…" — indistinguishable from "no active bags."

**Secondary cause (data):** If there are genuinely no bags with status "Active" in inventory (e.g. all bags are "Finished"), the dropdown is also empty — correct behaviour but uninformative.

**Fix target:** `frontend/src/pages/BrewLogAdd.tsx` — destructure `isError` from the inventory query; show an inline error or retry prompt when the query fails.

---

## Scope Confirmation

All changes are frontend-only (plus optional production config verification):

| File | Change |
|---|---|
| `frontend/src/components/AddBeanModal.tsx` | Add client-side required-field validation; improve save-error message |
| `frontend/src/pages/BrewLogAdd.tsx` | Add `isError` handling for inventory query; surface load failure to user |
| Production APP_SECRETS (out-of-band) | Verify `use_postgres` key present and Sheets credentials valid |

No new API endpoints, no schema changes, no new feature surface. Changes are self-contained within two component files.

---

## Routing Decision

**status: DIRECT_PERMITTED**

Rationale: All three bugs trace to bounded, identifiable defects in existing frontend components (missing validation, missing error state) plus a probable production config state to verify out-of-band. No new features, no data model changes, no cross-service impact. A hotfix touching two component files is the correct response. SpecKit cycle is not warranted.

---

# Decision Drop — Priya routing assessment
# 2026-05-15 — Hardware maintenance display + Brew log internal IDs

**Agent:** Priya (Product Manager)
**Date:** 2026-05-15
**Scope:** Bugs reported post-Postgres-migration

---

## Bugs assessed

### Bug 1 — Hardware view does not show maintenance logs

**Status: DIRECT_PERMITTED**

**Symptom:** Hardware detail panel always shows "No maintenance records." regardless of whether events
exist in Google Sheets.

**Root cause (confirmed by source inspection):**

The `maintenance_log` table has a `sheets_hardware_id TEXT` column added by migration 0005
(2026-05-14). That migration adds the column with no backfill SQL. Before 0005 was applied to
production, `SqlMaintenanceRepo.add()` tried to insert rows with `sheets_hardware_id` into a table
that didn't have that column yet. SQLAlchemy raised a DB error. `_DualWriteMaintenanceRepo.add()`
silently catches all SQL exceptions and continues. Result: every maintenance event written during
the period when 0005 was un-applied was accepted by Sheets but **rejected from Postgres without
surfacing an error to the caller**. The data exists in Sheets; it does not exist in Postgres.

After migration 0005 was applied (via `alembic upgrade head` in the PR #73 session), the column
now exists but there is no Postgres data to filter by. `SqlMaintenanceRepo.list(hardware_id=...)`
executes `WHERE sheets_hardware_id = ?` and returns an empty result. The frontend renders
"No maintenance records."

Additionally: `MaintenanceLog.hardware_id` (UUID FK → `hardware.id`) is never populated by
`SqlMaintenanceRepo.add()`. There is therefore no UUID-based join path that could be used for a
pure-SQL backfill. The data must be re-read from Sheets.

**Fix scope (bounded, no product decisions needed):**
1. Add a `SqlMaintenanceRepo.upsert()` method that inserts or updates by `sheets_id` (unique
   constraint exists) — prevents duplicate rows during backfill.
2. Add a startup backfill hook (or `POST /api/admin/resync-maintenance` endpoint) that reads all
   maintenance events from the Sheets-backed `MaintenanceRepo`, then calls
   `SqlMaintenanceRepo.upsert()` for each row. This populates `sheets_hardware_id` from
   `row["Hardware_ID"]`.
3. No schema migration needed (column already exists after 0005).
4. No frontend changes (frontend code is correct; it correctly renders `detail.maintenance`).

---

### Bug 2 — Brew Log and home page show internal Bag_IDs instead of bean/catalog names

**Status: DIRECT_PERMITTED**

**Symptom:** Brew log list and detail views display raw IDs like `Ve20250201M` instead of
"Roaster — Bean name".

**Root cause (confirmed by source inspection):**

`_resolve_names_from_dicts()` in `app/routers/api_brew_log.py` resolves bean display names by:

```
shot["Bag_ID"] → bags[bag_id]["Catalog_ID"] → catalog[catalog_id]["Roaster"] + ["Bean_Name"]
```

When `use_postgres=True`, `bags` is populated from `SqlInventoryRepo.list_all()` which returns
`"Catalog_ID": row.sheets_catalog_id or ""`.

`sheets_catalog_id` was added to `inventory_bags` by migration 0006 (2026-05-15). That migration
adds the column with no backfill. Before 0006 was applied, `SqlInventoryRepo.upsert()` tried to
set `existing.sheets_catalog_id` — a column that didn't exist in the DB yet — and received a DB
error that was silently caught by `_DualWriteInventoryRepo`. Inventory bags may exist in Postgres
(written before the `sheets_catalog_id` attribute was added to the ORM model), but those rows
have `sheets_catalog_id = NULL`.

Result: `bag_row.get("Catalog_ID", "")` returns `""` for all existing bags →
`catalog.get("", {})` returns `{}` → neither `Roaster` nor `Bean_Name` is resolved →
`bag_display` falls back to `bag_id` (the internal Sheets composite key like `Ve20250201M`).

This is a V1 core functional requirement violation (spec §9.2: "List view: frosted-glass cards;
date, **bean name**, roast level…"; §9.7: "no internal IDs in UI").

**Relationship to PR #73:** PR #73 fixes the migration pipeline (cloudbuild.yaml) and the
`DATABASE_URL` injection gap. Migration 0006 was applied manually to production during that
session. However, PR #73 does **not** backfill existing `inventory_bags` rows. All rows written
before 0006 was applied still have `sheets_catalog_id = NULL`. This bug is NOT fixed by PR #73
merging — it requires a separate backfill.

**Fix scope (bounded, no product decisions needed):**
1. A Sheets→Postgres backfill for existing `inventory_bags` rows: read all bags from
   `InventoryRepo` (Sheets-backed), call `SqlInventoryRepo.upsert(row)` for each. Since
   `upsert()` already handles INSERT vs UPDATE by `sheets_id`, and the column now exists, this
   will set `sheets_catalog_id = row["Catalog_ID"]` for all existing rows.
2. Implement as a startup backfill hook (idempotent: `WHERE sheets_catalog_id IS NULL`) or as an
   admin endpoint `POST /api/admin/resync-inventory`.
3. No schema migration needed (0006 already added the column and was applied to production).
4. No frontend changes (frontend correctly uses `entry.bag_display`).

---

## Combined routing verdict

| Bug | Status | Rationale |
|-----|--------|-----------|
| Hardware maintenance not displayed | DIRECT_PERMITTED | Pure data backfill regression. No product decisions. Backend only. |
| Brew log shows internal IDs | DIRECT_PERMITTED | Pure data backfill regression. V1 spec violation but fix is a Sheets→Postgres re-sync. No product decisions. Backend only. |

**Both bugs can be addressed on a single new branch off `main`.**
Branch name suggestion: `fix/postgres-backfill-maintenance-catalog`

**Relationship to open work:**
- PR #73 (`hotfix/beans-catalog-brew-log`): Addresses configuration and CI gaps. Not overlapping.
  Both PRs can coexist; this new work is complementary. However, PR #73 should merge first (or
  this branch should be based on PR #73's branch) since PR #73 includes the `cloudbuild.yaml`
  migration step that ensures this doesn't regress on future deploys.
- No SpecKit artifacts required. No Quinn gate required (no new user-facing behaviour; pure
  regression fix restoring V1 spec compliance).

**Implementation note for Alex:**
Both fixes follow the same pattern — a startup idempotent backfill via the DualWrite repos.
Consider a single `_backfill_postgres_from_sheets()` coroutine (or equivalent) called from
`app/main.py` `lifespan()` when `USE_POSTGRES=True`, covering both entities. Guard with
`WHERE sheets_catalog_id IS NULL` / `WHERE sheets_hardware_id IS NULL` so subsequent deploys
are no-ops.

---

# RCA: CI/format Failure on PR #73 — hotfix/beans-catalog-brew-log

**Author:** Tariq  
**Date:** 2026-05-16  
**Run ID:** 25954236107  
**PR:** #73  
**Branch:** hotfix/beans-catalog-brew-log  
**Failing job:** `CI/format`  
**Status:** Root cause identified. No fix applied. Awaiting operator authorisation.

---

## What Failed

```
Would reformat: app/routers/api_catalog.py
1 file would be reformatted, 109 files already formatted
Process completed with exit code 1
```

`ruff format --check app/ tests/` exits 1 because `app/routers/api_catalog.py` does not
comply with ruff's output format. All other 109 files pass.

---

## Why It Failed

**Proximate cause:** Commit `1e9a15c0ba24e4f81b695c562c533639a2449ad7` ("ci: force
synchronize event on PR #73") appended a trailing blank line to the end of
`app/routers/api_catalog.py`.

**Exact change:**
```diff
-    return JSONResponse({"image_path": image_path})
+    return JSONResponse({"image_path": image_path})
+
```

The file now ends with two newline characters (`\n\n`) — a blank trailing line after the
final statement. Ruff's formatter requires exactly one trailing newline with no blank line
after the last code line. The extra blank line causes ruff to report the file as needing
reformatting.

**Verified locally:**
```
$ uv run ruff format --check app/ tests/
Would reformat: app/routers/api_catalog.py
1 file would be reformatted, 109 files already formatted
Exit code: 1
```

---

## Scope

- **Only one file is affected:** `app/routers/api_catalog.py`, line 470 (trailing blank line).
- All other CI jobs (lint, mypy, pytest) pass. This is an isolated formatting issue.
- No logic, types, or tests are involved.

---

## Minimal Fix (authorisation required before applying)

Remove the trailing blank line from `app/routers/api_catalog.py` so the file ends with
exactly one newline after `return JSONResponse({"image_path": image_path})`. Equivalently,
run `uv run ruff format app/routers/api_catalog.py` and commit the result.

After the fix:
```
$ uv run ruff format --check app/ tests/
110 files already formatted
Exit code: 0
```

---

## Decision

**No fix has been applied.** This RCA is submitted to the coordinator for authorisation
per Inviolable Rule 3 (build failures trigger Tariq triage before any fix attempt).

The fix is trivial and self-contained. Once authorised, it can be committed directly on
`hotfix/beans-catalog-brew-log` with a `[skip ci]` commit message prefix, then CI should
be re-triggered on the resulting push to confirm green.

---

# Decision Drop — Cloud Build Shell Variable Escape Fix

**Date:** 2026-05-17  
**Agent:** Tariq (CI/CD)  
**Type:** Hotfix  
**Status:** Committed (not pushed)

## Context

Deploy workflow run 25978094988 failed at submission time with:

```
ERROR: (gcloud.builds.submit) INVALID_ARGUMENT: generic::invalid_argument:
invalid value for 'build.substitutions': key in the template "PROXY_PID"
is not a valid built-in substitution
```

## Root Cause

In the `migrate` step of `cloudbuild.yaml`, the shell script used `$!` and `$PROXY_PID` as
POSIX shell variables to track the Cloud SQL Auth Proxy PID. Cloud Build parses **all** `$VAR`
references in step `args` as substitution variables at submission time — before the shell
ever executes. `PROXY_PID` is not a declared substitution variable, so the build was rejected
before any step ran.

## Decision

Escape both shell variable references with `$$` syntax (Cloud Build's escape sequence for a
literal `$` passed through to the shell):

- `PROXY_PID=$!`  →  `PROXY_PID=$$!`
- `kill $PROXY_PID || true`  →  `kill $$PROXY_PID || true`

`$_CLOUDSQL_INSTANCE` on the same line is a declared substitution variable and requires no
change.

## Validation

All four local CI checks passed after the fix:
- `ruff check` — ✅ All checks passed
- `ruff format --check` — ✅ 110 files already formatted
- `mypy --strict` — ✅ No issues found in 53 source files
- `pytest` — ✅ 403 passed, 4 skipped

## Commit

`fix(deploy): escape shell variables in cloudbuild migrate step`

## Rule Applied

Cloud Build YAML convention: shell variables in multi-line bash `args` must use `$$VAR`
syntax to prevent Cloud Build from interpreting them as substitution variables at submission time.

---

# Decision: _CLOUDSQL_INSTANCE placement in Cloud Build pipeline

**Date:** 2026-05-17  
**Authors:** Maya (architect) + Alex (backend engineer)  
**Status:** DECIDED  
**Urgency:** Production deploy was blocked — decision needed immediately.

---

## Decision

**Option A — Hardcode in `cloudbuild.yaml` substitutions block.**

`_CLOUDSQL_INSTANCE: <your-gcp-project>:us-west1:espresso-logs-db` is committed directly in the `substitutions:` block of `cloudbuild.yaml`. This is already the current state as of this decision.

---

## Rationale

### Maya (architectural view)

Option B (set in Cloud Build trigger via GCP Console) was invalidated by a concrete infrastructure fact: `buildtrigger.tf` in the tf-infra repo **explicitly states that `google_cloudbuild_trigger` resources have been removed**. Builds are triggered by GitHub Actions via `gcloud builds submit` — there is no GCP Console trigger to configure. Option B does not exist as an operational path.

Option C (parse from APP_SECRETS at build time) adds unjustified complexity. APP_SECRETS is a Cloud Run runtime secret injected by Cloud Run's `--set-secrets` mechanism — it is not available to Cloud Build steps without additional `secretEnv` wiring and JSON parsing logic. The complexity cost is high; the benefit (avoiding a single non-sensitive string in code) is negligible.

Option A is therefore the only viable choice, and it is architecturally sound:
- `_CLOUDSQL_INSTANCE` is **not sensitive**. Cloud SQL instance connection names appear in Cloud Run `--add-cloudsql-instances` flags, logs, and IAM bindings — they are infra identifiers, not secrets.
- **Precedent already exists in this file**: `_REGION: us-west1` and `_SERVICE_NAME: coffee-tracker` are hardcoded in the same substitutions block. `_CLOUDSQL_INSTANCE` is structurally identical — a non-sensitive, environment-specific infra identifier.
- Keeping it in code makes the build fully self-describing. Any developer can read `cloudbuild.yaml` and understand exactly what instance the migrate step connects to, without consulting GCP Console or a separate config store.

If the Cloud SQL instance ever changes, a one-line commit to `cloudbuild.yaml` is the correct mechanism — auditable, reviewable, and version-controlled.

### Alex (implementation view)

The value is already present in `cloudbuild.yaml` line 214 as of this decision:
```yaml
_CLOUDSQL_INSTANCE: <your-gcp-project>:us-west1:espresso-logs-db
```

No further implementation action is required for this variable. The migrate step (Step 5b-2) consumes it correctly:
```bash
/workspace/cloud-sql-proxy --unix-socket=/cloudsql $_CLOUDSQL_INSTANCE &
```

And the deploy step consumes it:
```
--add-cloudsql-instances=$_CLOUDSQL_INSTANCE
```

The only variables that legitimately belong in `<SET_IN_TRIGGER>` are those that **cannot be known at commit time** or that are **service-account email addresses** (which vary by GCP project setup and are closer to infrastructure identity than app config). `_RUNTIME_SA` and `_CLOUDBUILD_SA` correctly remain as `<SET_IN_TRIGGER>` — they are passed via `--substitutions` in the GitHub Actions workflow.

---

## Conditions and future considerations

- If the project ever moves back to GCP Console-managed Cloud Build triggers (e.g., Terraform codifies a `google_cloudbuild_trigger` resource again), `_CLOUDSQL_INSTANCE` should be migrated to that trigger's substitutions block to keep all environment-specific config in one place.
- If espresso-logs ever becomes multi-environment (staging vs. prod triggers), `_CLOUDSQL_INSTANCE` should be parameterised per trigger at that point.
- Neither condition applies today.

---

## Alternatives considered and rejected

| Option | Verdict | Reason |
|--------|---------|--------|
| B — GCP Console trigger | Rejected | No Cloud Build trigger exists; builds run via `gcloud builds submit` from GitHub Actions |
| C — Parse from APP_SECRETS | Rejected | APP_SECRETS is a Cloud Run runtime secret; making it available at build time requires extra `secretEnv` wiring and JSON parsing — unjustified complexity for a non-sensitive value |

---

# Decision Drop — Cloud Run Health Probe 302 Redirect: Root Cause Analysis

**Date:** 2026-05-17T06:29:25Z  
**Agent:** Tariq  
**Status:** DIAGNOSIS COMPLETE — fix required before next deploy  
**Type:** Deployment failure RCA

---

## Symptom

Cloud Run probes `GET /health` on the new revision and receives `302 Found` (redirect to `/auth/login`). Cloud Run requires a 2xx response to declare the revision healthy. The revision remains in "Deploying" state until the deploy step times out.

---

## Root Cause

### There is no `/health` route in the application.

`app/routers/health.py` exposes only two unauthenticated endpoints:

```
GET /livez   → {"status": "ok"}
GET /readyz  → {"status": "ok"}
```

`GET /health` is not defined. It was never defined — `git log` shows `health.py` has existed unchanged since the initial commit (`ed413fe`).

### What happens when Cloud Run probes `/health`

1. Request hits FastAPI. No router matches `/health`.
2. Falls through to the SPA catch-all in `app/main.py`:
   ```python
   @app.get("/{full_path:path}", include_in_schema=False)
   async def spa_catch_all(full_path: str, _user: CurrentUser) -> HTMLResponse:
   ```
3. `CurrentUser` → `_get_current_user(request)` → no session cookie on a Cloud Run probe → raises `_RequiresLogin`.
4. `requires_login_handler` in `app/main.py` catches `_RequiresLogin`:
   ```python
   @app.exception_handler(_RequiresLogin)
   async def requires_login_handler(request: Request, exc: _RequiresLogin) -> RedirectResponse:
       return RedirectResponse(url="/auth/login", status_code=302)
   ```
5. Cloud Run receives `302` → not 2xx → health check failure → deploy timeout.

### Why `cloudbuild.yaml` doesn't protect against this

The `gcloud run deploy` step in `cloudbuild.yaml` does not specify `--startup-probe` or any health check path. Cloud Run inherits whatever probe is persisted in the service's existing configuration. This configuration is set outside `cloudbuild.yaml` — most likely via the GCP Console or a prior `gcloud` invocation that explicitly set an HTTP startup probe at `/health`.

### Why it worked before

The most likely explanation: the Cloud Run service originally used **TCP probing** (the default for Cloud Run Gen1, and the initial Cloud Run Gen2 default when no probe is configured). TCP probing only checks that the container is listening on port 8080 — it doesn't make an HTTP request. This always succeeds once the app starts.

Something changed the probe to **HTTP GET `/health`** — either:
- A manual change in the GCP Console (Health checks tab on the revision or service)
- A previous `gcloud run deploy` call that included `--startup-probe=httpGet.path=/health`
- A Cloud Run platform update that changed default probe behaviour for this service generation

Once set, this probe configuration persists across all deployments because `cloudbuild.yaml` never explicitly configures or resets it.

---

## Evidence Summary

| Finding | File | Detail |
|---|---|---|
| No `/health` route | `app/routers/health.py` | Only `/livez` and `/readyz` defined |
| SPA catch-all requires auth | `app/main.py:196` | `CurrentUser` dependency on `/{full_path:path}` |
| Auth failure → 302 | `app/main.py:131-133` | `_RequiresLogin` → `RedirectResponse(url="/auth/login", status_code=302)` |
| No probe config in CI | `cloudbuild.yaml:125-152` | `gcloud run deploy` step has no `--startup-probe` flag |
| `/health` never existed | `git log -- app/routers/health.py` | Single commit: `ed413fe` initial commit |

---

## Fix Options

### Option A — Add `/health` to the application (recommended primary fix)

Add an unauthenticated `GET /health` route to `app/routers/health.py`:

```python
@router.get("/health")
async def health() -> JSONResponse:
    """Cloud Run startup probe — returns 200 as long as the process is running."""
    return JSONResponse({"status": "ok"})
```

**Pros:** Application explicitly handles the probe path. Works regardless of what probe path is configured in Cloud Run or any other infrastructure. Zero config change required in Cloud Build or GCP Console.

**Cons:** Slightly duplicates `/livez` functionality. (Acceptable — the paths serve different audiences: Cloud Run infrastructure vs Kubernetes-style tooling.)

### Option B — Pin the startup probe in `cloudbuild.yaml` (recommended defence-in-depth)

Add `--startup-probe=httpGet.path=/livez,port=8080` to the `gcloud run deploy` step:

```yaml
- '--startup-probe=httpGet.path=/livez,port=8080'
```

This makes the probe configuration explicit and version-controlled. Any manually-set probe in the GCP Console will be overridden on the next deploy.

**Pros:** Infrastructure-as-code — probe path is declared in the repo, not hidden in GCP Console. Explicit intent.  
**Cons:** Requires an operator to push a change to trigger the override.

### Recommendation

**Apply both.** A is the immediate unblock — it makes the app respond 200 on any probe path the infra team has configured. B is the long-term guard — it pins the probe to `/livez` in source and prevents this class of misconfiguration from recurring.

Do not apply B alone: if the GCP Console probe is still set to `/health`, B only fixes the probe on the next deploy. If Option A is applied first, both `/health` and `/livez` respond 200 and the deploy unblocks immediately.

---

## Action Required

1. **Alex or skarthikkrishna** to implement Fix A (`GET /health` in `health.py`) — one-line change, no auth, no deps.
2. **skarthikkrishna** to add Fix B (`--startup-probe` in `cloudbuild.yaml`) as the follow-up defence.
3. Verify by re-triggering the Cloud Build pipeline after Fix A is merged to main.

**Blocked state:** Every deploy will fail until Fix A or an equivalent probe reconfiguration (pointing `/health` to `/livez` via a Cloud Run console update) is in place.

---

## Out of Scope

- Investigating the exact mechanism that changed the probe to `/health` (Cloud Run console audit log would show this but is not accessible from this repo)
- Changing the existing `/livez` or `/readyz` routes
- Any changes to auth middleware or `_RequiresLogin` handling

---

# Routing Decision — Bean Name Display + Maintenance Log Bugs

**Agent:** Alex (Backend Engineer)  
**Date:** 2026-05-17  
**Status:** DIRECT_PERMITTED  
**Requested by:** skarthikkrishna  

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


---

## 2026-05-18T06:29:04Z: Scribe Inbox Merge

### 20260518T062708Z-tariq-routing-pr-review-fix-032.md

```md
---
date: 2026-05-18
agent: Tariq
topic: Routing decision for PR comment '@copilot can you review this please' on "fix(032): redact live GCP service account emails from HEAD"
status: DIRECT_PERMITTED
decision: |
  Direct implementation is permitted. Scope is strictly bounded to PR review/triage workflow for an existing PR comment trigger,
  with no product-scope, architecture, or cross-phase requirements changes. No SpecKit cycle is required for this request.
scope_confirmation: |
  Authorized scope is limited to handling the review request on the existing PR only.
  It does not include feature development, requirement changes, or infrastructure redesign.
---
```

### alex-finn-el-pii-redaction.md

```md
---
date: 2026-05-18
agent: Alex + Finn
topic: espresso-logs HEAD PII redaction + CLOUDSQL secret migration — spec-032 T-EL-01 + T-EL-02
decision: |
  - cloudbuild.yaml _CLOUDSQL_INSTANCE hardcoded value removed (set to '')
  - cloudbuild.yaml comment updated to reflect secret-based supply
  - deploy.yml updated to pass _CLOUDSQL_INSTANCE=${{ secrets.GCP_CLOUDSQL_INSTANCE }}
  - .squad/decisions.md: full legal name → skarthikkrishna (3 occurrences)
  - .env (gitignored, local only): ALLOWLIST_EMAILS email redacted locally — not a tracked file,
    no HEAD risk, but redacted for local hygiene.
  - Full grep validation clean on HEAD state (tracked files only).
  CRITICAL: T-CLOSE-01 pending — operator must add GCP_CLOUDSQL_INSTANCE secret to espresso-logs
  repo settings before next deploy triggers. Without it, Cloud Build will receive an empty
  _CLOUDSQL_INSTANCE substitution and the migrate step will fail at proxy startup.
files_changed:
  - cloudbuild.yaml
  - .github/workflows/deploy.yml
  - .squad/decisions.md
status: committed — branch chore/032-pii-redaction
---
```
