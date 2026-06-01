# Team Decisions Log

**Project:** espresso-logs  
**Last Updated:** 2026-06-01T04:36:41Z

---

## 2026-05-15

### USE_POSTGRES belongs in APP_SECRETS, not as a standalone Cloud Run env var

**Author:** Alex  
**Branch:** config/use-postgres-to-app-secrets  
**Status:** Committed

`USE_POSTGRES` (which controls the Sheets vs Postgres backend switch) must live inside the `APP_SECRETS` Secret Manager JSON blob, not as a standalone Cloud Run env var.

**Rationale:**
1. `app/config.py`'s `_load_app_secrets` validator already injects all blob keys into `Settings` before individual env vars are evaluated. No code change was required to support blob-sourced `USE_POSTGRES`.
2. Centralising all non-infra configuration in the APP_SECRETS blob prevents config drift: operators only need to update one Secret Manager secret to flip the backend, rather than also editing Cloud Run revision environment variables.
3. `APP_ENV` and `OAUTH_REDIRECT_URI` remain as standalone Cloud Run env vars because they are infra/routing concerns, not application secrets.

**What was done:**
- Added inline comment on the `use_postgres` field in `Settings` (`app/config.py`) documenting the production sourcing rule.
- Added matching comment in `.env.example` explaining the local-dev vs production split.
- Updated Secret Manager: `APP_SECRETS` version 3 now includes `"USE_POSTGRES": true`.
- `cloudbuild.yaml` already omits `USE_POSTGRES` from `--set-env-vars`; no change required.

**Affected files:**
- `app/config.py`
- `.env.example`

**Rule:** In production (Cloud Run), `USE_POSTGRES` must be set via the APP_SECRETS JSON blob. It must NOT appear as a standalone `--set-env-vars` entry in `cloudbuild.yaml` or in any Cloud Run revision configuration.

---

## 2026-05-13

### Chrome desktop backdrop-filter + async background image pattern

**Author:** Finn  
**Branch:** fix/ui-safari-polish  
**Status:** Committed

When a `backdrop-filter` element has a `position: fixed; z-index: -1` sibling that loads a background image asynchronously, **always apply `will-change: transform` to the background element**.

**Rationale:** Chrome desktop's GPU compositor invalidates and re-promotes the background element's compositor layer when its `background-image` URL loads asynchronously. During the promotion window, `backdrop-filter` on a sibling element samples from a black/empty compositor layer. The `will-change: transform` hint pre-promotes the element to its own GPU layer before the image arrives, so the update happens in-place without disrupting the backdrop-filter chain.

Chrome mobile and Safari are unaffected, so the fix is Chrome desktop-only in effect but safe to apply universally.

**Also:** Remove `transition: background-image` from background elements. `background-image` is not a CSS-animatable property per CSS Transitions Level 1. Any `transition: background-image` declaration is a no-op in spec-compliant browsers and may interfere with compositor layer management.

**Implementation:** `.app-bg` in `frontend/src/index.css` now carries `will-change: transform` and the `transition: background-image 300ms ease` has been removed.

---

### Chip/Badge Sizing Convention

**Author:** Finn (Frontend)  
**Branch:** fix/ui-safari-polish  
**Status:** Committed

All roast/machine chip badges in the espresso-logs React SPA use the following consistent class pattern:

```
badge badge-sm text-xs <colour-tokens>
```

**Rationale:** DaisyUI's `badge-sm` sets a compact height but does not always enforce `font-size: 0.75rem` explicitly across all DaisyUI versions — it depends on the cascade. Adding `text-xs` explicitly guarantees the chip label text is 12px regardless of parent context or DaisyUI version. Without `text-xs`, badge text can inherit `text-sm` (14px) from the surrounding card or list context, which causes the label to push against the chip edges and appear broken.

**Applied to:**
- `frontend/src/pages/BrewLogDetail.tsx`
- `frontend/src/pages/Dashboard.tsx`
- `frontend/src/pages/CatalogList.tsx`
- `frontend/src/pages/CatalogDetail.tsx` (also fixed missing `badge-sm`)

**Rule:** When using DaisyUI `badge` as a compact metadata chip/tag, always specify both `badge-sm` **and** `text-xs`. Never rely on DaisyUI's implicit font-size inheritance for compact chips.

---

### Spec-031 Data Remediation — DIRECT_PERMITTED

**Date:** 2026-05-17  
**Author:** Alex (backend routing)  
**Branch:** fix/031-brew-log-duplication-missing-ai  
**Status:** Committed (decision drop: `20260517T231941Z-remediation-routing.md`)

Bounded operational data remediation for spec-031 classified as `DIRECT_PERMITTED`.

**Scope permitted:** Single script (`scripts/remediate_031.py`) to (1) delete confirmed Case A duplicate rows 78 & 80 from Brew_Log (higher index first to avoid row-shift) and (2) backfill blank `AI_Feedback` for rows dated 2026-05-16 and 2026-05-17 using existing `get_ai_feedback` from `app/services/inference.py`.

**Explicitly excluded:** No changes to `app/`, `frontend/`, `alembic/`, or any schema. No new tests, no new dependencies, no new API endpoints.

**Constraints:** Delete row 80 before row 78; script must be dry-run capable (`--dry-run`); idempotent; auth via same env-var pattern as `diagnose_brew_log_duplicates.py`.

**Outcome:** 2 duplicate rows deleted, 2 AI feedbacks backfilled, 0 errors. Scripts dropped (one-time operational use, not committed).

---

## 2026-05-22

### Ralph session-close after spec-034 M5 items 1–5 — DIRECT_PERMITTED

**Author:** Tariq (routing)  
**Branch:** feat/034-m5-household-roles  
**Status:** Committed

Ralph session-close governance operation after spec-034 M5 items 1–5 were completed locally. CI green; no push performed per operator instruction.

**Scope permitted:** Strictly limited to updating `.squad/identity/now.md` with current team focus and open work state, plus any local commit(s) required. No application code, tests, migrations, or frontend assets touched. Quinn gate explicitly waived for documentation/governance-only changes per protocol §STEP 3.

**Completed items (local, not pushed):**
1. Atomic refresh token rotation (race condition fix)
2. Invitation model: 72h expiry, invited_email, invited_role, decline/revoke/resend endpoints
3. Household rename (`PATCH /households/{id}`) and soft-delete (`DELETE /households/{id}`)
4. Active-household resolution via `X-Household-Id` header in `deps.py`
5. Import wizard: admin-gate + DB-backed session state

**Remaining open work:** Spec-034 HIGH items beyond items 1–5; spec-033 brew_log_reconcile dry-run.

---

## 2026-05-23

### GET /auth/me membership N+1 fix — DIRECT_PERMITTED

**Author:** Alex (routing)  
**Branch:** feat/034-m5-household-roles  
**Status:** Committed (`fix(auth): eliminate N+1 on /auth/me memberships (#034)`)

Quinn-flagged N+1 lookup on `GET /auth/me` fixed by replacing per-membership household lookups with a single consolidated membership query.

**Scope permitted:**
- `app/routers/api_auth.py`
- `app/repos/sql/household.py` and tightly coupled files under `app/repos/sql/`
- Tests covering `/auth/me` membership loading behaviour

**Constraint:** Must not expand scope to unrelated auth, household, migration, or frontend work.

---

### Quinn QA review of spec-034 M5 backend commits — DIRECT_PERMITTED

**Author:** Alex (routing)  
**Branch:** feat/034-m5-household-roles  
**Status:** Committed

Post-implementation QA pass by Quinn on 5 spec-034 M5 backend commits. Classified as DIRECT_PERMITTED because this is QA/quality-gate work on already-committed code, not a new feature introduction.

**Commits in scope:**
| SHA | Subject |
|-----|---------|
| `58e786c` | fix(import-wizard): admin-gate + DB-backed session state (#034) |
| `091d9e3` | feat(auth): X-Household-Id header routing + /auth/me memberships (#034) |
| `07d3c78` | feat(households): rename and soft-delete endpoints (#034) |
| `ccaddda` | feat(households): invitation model overhaul — status, 72h expiry, role, decline/revoke/resend (#034) |
| `6ab408d` | fix(auth): atomic refresh token rotation (#034) |

**Scope permitted:** Type annotations, docstrings, missing tests, `xfail`/`skip` marker removal across `app/routers/`, `app/services/`, `app/deps.py`, `tests/`. Quinn gate artifact not required (QA close-out, not implementation start).

**Pre-push checklist required:** All four CI-equivalent checks + explicit operator push authorisation.

---

### Spec-034 M5 feature analysis (top-down audit) — DIRECT_PERMITTED

**Author:** Priya (routing)  
**Branch:** feat/034-m5-household-roles  
**Status:** Complete (analysis session, no code changes)

Read-only top-down audit of spec-034 (M5 Household Roles): cross-reference spec artifacts in `coffee_tracker/specs/034-m5-household-roles/` against current implementation on `feat/034-m5-household-roles`. Classified as DIRECT_PERMITTED (research task; no SpecKit trigger; no Quinn gate).

**Scope permitted (read-only):**
- `coffee_tracker/specs/034-m5-household-roles/` — spec.md, plan.md, tasks.md, compliance.md, aria-gate.md, quinn-gate.md
- `app/`, `tests/`, `frontend/src/` on feature branch — implementation tracing only

**Explicitly prohibited:** Modifying source files, committing code, opening PRs, invoking SpecKit phases.

**Key findings surfaced:** Household lifecycle completeness, invitation status/expiry flows, multi-household active context (X-Household-Id), auth token rotation correctness, import wizard access control. Full analysis in session log `20260523T155630Z-spec034-feature-analysis.md`.

---

### Hardware mutation cache invalidation — DIRECT_PERMITTED

**Author:** Finn (routing)  
**Branch:** feat/034-m5-household-roles  
**Status:** Committed (`fix(hardware): invalidate React Query cache after add/edit mutations (#034)`)

Bounded frontend bug fix authorised to make the hardware list and detail panel refresh reactively after add/edit mutations without a full page reload.

**Scope confirmed:**
- `frontend/src/components/EditHardwareModal.tsx` — explicitly invalidate the detail query key for the edited hardware item
- `frontend/src/components/AddHardwareModal.tsx` — preserve list invalidation behavior and align post-save refresh semantics
- `frontend/src/pages/HardwarePage.tsx` — update edit-save handling only if required to refresh the selected detail panel
- `frontend/src/components/EditHardwareModal.test.tsx` — cover the invalidation contract

**Constraint:** No backend, schema, auth, or unrelated frontend changes.

---

### Spec-034 QA validation scenarios A–E — DIRECT_PERMITTED

**Author:** Tariq (routing)  
**Branch:** feat/034-m5-household-roles  
**Status:** Committed (`chore(routing): Tariq decision drop — QA validation scenarios A-E [DIRECT_PERMITTED]`)

Independent QA validation of scenarios A–E is authorised as a bounded, read-only verification pass over the current branch state.

**Scope confirmed:**
- start the existing FastAPI and/or React services locally if needed
- exercise live API and browser scenarios A–E
- inspect source code as evidence and report PASS / PARTIAL / FAIL findings

**Explicit exclusions:** no changes to `app/`, `frontend/src/`, `tests/`, `docs/`, or `specs/`; no push.

---
