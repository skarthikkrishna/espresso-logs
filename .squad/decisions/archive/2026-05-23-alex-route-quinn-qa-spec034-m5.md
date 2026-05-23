# Routing Decision — Quinn QA Review of spec-034 M5 Backend Commits

**Date:** 2026-05-23T07:32:25Z  
**Agent:** Alex (routing)  
**Branch:** feat/034-m5-household-roles  
**Status:** DIRECT_PERMITTED

---

## Request Summary

Quinn must:
1. Review Alex's 5 recent backend implementation commits for code quality
2. Verify a defined testing checklist and add any missing tests
3. Remove obsolete `xfail`/`skip` markers where tests should now pass
4. Run the full `pytest` suite and confirm green
5. Scan commits for missing type annotations, missing docstrings, and security issues
6. Fix any issues found and commit them

---

## Commits in Scope

| SHA | Subject |
|-----|---------|
| `58e786c` | fix(import-wizard): admin-gate + DB-backed session state (#034) |
| `091d9e3` | feat(auth): X-Household-Id header routing + /auth/me memberships (#034) |
| `07d3c78` | feat(households): rename and soft-delete endpoints (#034) |
| `ccaddda` | feat(households): invitation model overhaul — status, 72h expiry, role, decline/revoke/resend (#034) |
| `6ab408d` | fix(auth): atomic refresh token rotation (#034) |

---

## Routing Assessment

**DIRECT_PERMITTED**

### Rationale

1. **No new feature scope.** This is entirely QA/quality-gate work on already-implemented, committed code. Quinn's mandate is explicitly to operate as the pre-implementation gate and PR quality reviewer — this request is squarely in that mandate.

2. **Bounded and self-contained.** The scope is fixed to 5 named commits on a single branch (`feat/034-m5-household-roles`). No architectural decisions are needed; no new product behaviour is introduced.

3. **SpecKit is inappropriate here.** SpecKit cycles are for introducing or clarifying new features or significant architectural changes. A QA pass — adding missing tests, fixing annotations, removing stale markers, running the suite — is the *output* of SpecKit, not an input to it. Opening a new SpecKit cycle for a code-review/test-coverage task would be process waste.

4. **Quinn gate artifact is not required for this task.** The Quinn gate (`specs/034/quinn-gate.md`) guards *implementation start*, not post-implementation QA cleanup. Quinn is already operating downstream of the gate; this request asks Quinn to perform its natural QA close-out duties.

5. **Precedent.** Comparable QA close-out work (e.g., `dd238cd test(security): cross-household reset, expired refresh, revoked invite coverage`) was similarly handled as direct implementation without a new SpecKit cycle.

---

## Explicit Scope Confirmation

Quinn is authorised to proceed directly with all of the following **without a new SpecKit cycle**:

- `app/routers/` — review and patch type annotations / docstrings in files touched by the 5 commits
- `app/services/` — same
- `app/deps.py` — same
- `tests/` — add missing tests, remove obsolete `xfail`/`skip` markers, run full suite
- Commit fixes on `feat/034-m5-household-roles`

Quinn must **not**:
- Alter product behaviour or add new endpoints
- Change migration files
- Push to remote (per Inviolable Rule 1 + Rule 10 — operator must authorise push explicitly)

---

## Pre-Push Checklist (Quinn must complete before any push)

1. `uv run ruff check app/ tests/` — must pass
2. `uv run ruff format --check app/ tests/` — must pass
3. `uv run mypy app/ --strict` — must pass
4. `SPREADSHEET_ID=dummy uv run pytest tests/ -v --ignore=tests/e2e/` — must pass
5. **Ask the operator for explicit push authorisation.** Do not push silently.
