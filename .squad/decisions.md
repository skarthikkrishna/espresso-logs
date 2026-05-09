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

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
