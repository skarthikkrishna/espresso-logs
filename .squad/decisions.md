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
