# Session Log — Spec-034 M5 Feature Analysis

**Timestamp:** 2026-05-23T15:56:30Z  
**Branch:** feat/034-m5-household-roles  
**Session type:** Read-only feature analysis / implementation audit  
**Scribe:** Scribe (session-close)

---

## Session Summary

Top-down feature analysis and implementation audit of spec-034 (M5 Household Roles) on the `feat/034-m5-household-roles` branch. No code was modified during this session. The session produced findings about implementation completeness, correctness, and gaps.

---

## Protocol Steps Completed

### Step 0 — Ralph check
Ralph confirmed `.squad/identity/now.md` was up to date and no conflicting in-progress state existed. **CLEAR — proceed** returned.

### Step 1 — Routing
**Priya** was spawned as routing agent. Returned `status: DIRECT_PERMITTED` with explicit rationale: analysis/reporting task only; no code changes; no SpecKit trigger; no Quinn gate required. Decision drop committed to `.squad/decisions/inbox/2026-05-23-priya-route-spec034-feature-analysis.md`.

---

## Source Documents Reviewed

### Available on this branch
- `docs/requirements/functional-spec-v2.md` — authoritative product behaviour, entity definitions, household lifecycle, role semantics, invitation flows, and multi-household active context rules
- `docs/requirements/engineering_architecture_v2.md` — system design, auth token flows, dependency injection, repo layer contracts, middleware design

### Absent on this branch (noted)
- `docs/requirements/sheet-schema.md` — not present on `feat/034-m5-household-roles`; Sheets backend schema doc is on other branches. All data access on this branch uses the SQL/Postgres repo layer, making the Sheets schema irrelevant for this analysis.

---

## Implementation Files Reviewed

| File | Purpose |
|------|---------|
| `app/routers/api_households.py` | Household CRUD, rename, soft-delete, invitation lifecycle (create, accept, decline, revoke, resend), membership management |
| `app/routers/api_auth.py` | OAuth callback, token refresh, `GET /auth/me`, logout |
| `app/auth.py` | JWT encode/decode, token validation, Google OAuth exchange |
| `app/deps.py` | Dependency injection — active household resolution via `X-Household-Id` header, repo and service providers |
| `app/repos/sql/household.py` | SQL repo for households, memberships, invitations |
| `app/models/household.py` | Pydantic request/response models for household domain |
| `app/routers/import_wizard.py` | Multi-step import wizard with admin-gate and DB-backed session state |
| `app/main.py` | App factory, middleware registration, router mounting |
| `app/services/auth.py` | Token service — refresh rotation, revocation, persistence |
| `app/config.py` | Settings, secret loading, feature flags |

---

## Key Findings

### 1. Household Lifecycle

**Finding:** Create, rename (`PATCH /households/{id}`), and soft-delete (`DELETE /households/{id}`) are implemented. Soft-delete sets a `deleted_at` timestamp rather than removing the row.

**Completeness:** The functional spec requires that a household with active members cannot be deleted without transfer or removal of members first. The implementation enforces this guard — deletion is blocked if the household has any active memberships other than the deleting admin. ✅

**Edge case noted:** If the last admin leaves a household (not soft-delete, but membership removal), the household becomes ownerless. The current implementation does not auto-promote another member to admin, nor does it prevent the last admin from leaving. This matches the spec's stated deferral of "orphan household" handling to a future milestone, but should be tracked.

---

### 2. Invitation Model

**Finding:** Invitations are fully implemented with:
- Status enum: `pending`, `accepted`, `declined`, `revoked`, `expired`
- 72-hour expiry enforced at invite creation (`expires_at = now + 72h`) and validated at accept time
- `invited_email` stored at creation; checked against authenticated user email at accept
- `invited_role` field defaults to `member`; admins can invite as `admin`
- Endpoints: create, accept, decline, revoke (`DELETE`), resend (resets expiry)

**Deviation noted:** The spec requires that resend generates a new invitation token and invalidates the old one. Implementation sets `status = 'pending'` and resets `expires_at` on the existing row rather than creating a new row. This is functionally equivalent from the invitee's perspective but differs from the spec's stated "new token" language. Not a blocking gap — confirm intent with operator before PR.

---

### 3. Multi-Household Active Context

**Finding:** Active household resolution is implemented in `deps.py` via the `X-Household-Id` request header. The dependency validates that the requesting user is an active member of the named household before granting access.

**Completeness:**
- Header is optional; requests without it default to the user's primary household (earliest membership by `joined_at`)
- `GET /auth/me` returns all household memberships including roles — client can use this to populate a household switcher
- N+1 on `/auth/me` memberships was identified (Quinn-flagged) and fixed in a subsequent session (`fix(auth): eliminate N+1 on /auth/me memberships (#034)`)

**Open question:** The functional spec mentions a "default household" concept that can be explicitly set per user. The current implementation uses `earliest joined_at` as the implicit default — no explicit default-setting endpoint exists yet. This may be deferred to a later milestone; confirm.

---

### 4. Auth Token Flows

**Finding:** Atomic refresh token rotation is implemented in `app/services/auth.py`. The fix addresses a race condition where concurrent refresh requests could both succeed with the same token.

**Implementation detail:** Rotation uses a DB-level compare-and-swap: the refresh operation atomically checks the token hash matches the stored hash and is not revoked, then rotates in a single transaction. Concurrent second attempt fails cleanly with 401.

**Correctness:** Matches the spec requirement for single-use refresh tokens. Prior implementation allowed a brief window where the old token remained valid. ✅

**Token revocation:** `POST /auth/logout` revokes the refresh token. Access tokens are short-lived (15 min) and not explicitly revoked — consistent with the architecture doc's stated tradeoff.

---

### 5. Import Wizard Access Control

**Finding:** The import wizard (`app/routers/import_wizard.py`) is gated to household admins only. The admin check is performed in `deps.py` as a dependency on all import wizard routes.

**DB-backed session state:** Wizard progress is persisted to the database (not in-memory/Redis), so progress survives pod restarts on Cloud Run. Session is keyed by `(user_id, household_id)`.

**Completeness:** Admin gate enforced ✅. Session persistence ✅. Step validation (cannot skip steps) ✅.

**Note:** The import wizard does not validate that the target household is not soft-deleted before beginning an import. This is a minor gap — a soft-deleted household's admin could theoretically initiate an import if they hold an active session. Low-risk given soft-delete is an admin-only action, but worth a guard.

---

## Inbox Decisions Merged This Session

Four routing decision drops were present in `.squad/decisions/inbox/` and have been merged into `decisions.md`:

1. `2026-05-22-tariq-route-ralph-session-close.md` — Ralph session-close DIRECT_PERMITTED
2. `2026-05-23-alex-route-auth-me-nplus1.md` — N+1 fix DIRECT_PERMITTED
3. `2026-05-23-alex-route-quinn-qa-spec034-m5.md` — Quinn QA pass DIRECT_PERMITTED
4. `2026-05-23-priya-route-spec034-feature-analysis.md` — Feature analysis DIRECT_PERMITTED

All four archived to `.squad/decisions/archive/`.

---

## Open Items / Handoff Notes

| Priority | Item | Owner |
|----------|------|-------|
| Confirm | Resend invitation: new row vs reset-in-place — align with spec intent | Priya / operator |
| Confirm | Explicit "default household" endpoint — deferred to later milestone? | Priya |
| Low risk | Import wizard should guard against soft-deleted household | Alex |
| Track | Orphan household on last-admin leave — deferred per spec | Future milestone |
| Pending | Spec-034 HIGH items beyond items 1–5 (not yet started) | Alex / Finn |
| Pending | Spec-033 brew_log_reconcile dry-run | Alex |

---

## Session Close Artifacts Written

- `.squad/decisions/decisions.md` — updated (4 inbox entries merged; last-updated timestamp bumped)
- `.squad/decisions/archive/` — 4 inbox files moved here
- `.squad/log/20260523T155630Z-spec034-feature-analysis.md` — this file

---
