# Routing Decision — spec-031 Data Remediation

**Date:** 2026-05-17  
**Agent:** Alex (backend routing)  
**Branch:** fix/031-brew-log-duplication-missing-ai  
**Request:** Delete confirmed duplicate rows 78 & 80 from Brew_Log; backfill missing AI_Feedback for 2026-05-16 and 2026-05-17

---

## status: DIRECT_PERMITTED

---

## Rationale

This is bounded operational data remediation, not a product feature:

1. **Row deletion** — rows 78 and 80 are confirmed Case A duplicates (same Shot_ID) identified by the existing diagnostic script. The Sheets client and gspread access pattern are already established in the codebase. A standalone script can call the sheets client directly to delete specific rows by index.

2. **AI backfill** — `get_ai_feedback` already exists in `app/services/inference.py` and already implements the correct short-circuit logic (`if existing: return existing`). Calling it for blank-AI_Feedback rows from the last two days requires no new service logic.

No schema changes, no new API endpoints, no new dependencies, no new test surface requiring SpecKit. The diagnostic script scaffold (`scripts/diagnose_brew_log_duplicates.py`) confirms the pattern of standalone operational scripts in this repo.

---

## Explicit Scope

### Permitted

| Deliverable | File | What it does |
|---|---|---|
| Remediation script | `scripts/remediate_031.py` | Single script, two phases: (1) delete rows 80 and 78 (higher index first to avoid shift) from Brew_Log tab; (2) scan rows dated 2026-05-16 and 2026-05-17 where AI_Feedback is blank and call `get_ai_feedback` for each, writing result back to the sheet |

### Explicitly Excluded

- No changes to `app/` (routers, services, repos, deps, main)
- No changes to `frontend/`
- No new tests (script is one-time remediation, not application logic)
- No changes to `alembic/` or any schema
- No new pip/uv dependencies
- No new API endpoints
- Row 79 and any rows outside the confirmed duplicate set are untouched

---

## Constraints on Implementation

1. Delete row 80 before row 78 — delete higher index first to avoid row-shift corrupting the lower index.
2. Backfill must use `get_ai_feedback` from `app/services/inference.py` — do not reimplement LLM call inline.
3. Script must be dry-run capable (`--dry-run` flag) — prints proposed actions without writing.
4. Auth follows the same pattern as `diagnose_brew_log_duplicates.py` (env vars: `SPREADSHEET_ID`, `GOOGLE_APPLICATION_CREDENTIALS` or ADC, `APP_SECRETS`).
5. Script is idempotent: re-running after rows are deleted and AI_Feedback is filled is a no-op.
