# Routing Decision — GET /auth/me Membership N+1 Fix

**Date:** 2026-05-23T00:00:00Z  
**Agent:** Alex (routing)  
**Branch:** feat/034-m5-household-roles  
**Status:** DIRECT_PERMITTED

---

## Request Summary

Fix the Quinn-flagged N+1 lookup on `GET /auth/me` by replacing the per-membership household lookup with a single membership query for the authenticated user. The user explicitly scoped inspection to:

- `app/routers/api_auth.py`
- `app/repos/sql/`

The user also asked that the eventual implementation run the four CI-equivalent checks and commit with:

`fix(auth): eliminate N+1 on /auth/me memberships (#034)`

---

## Routing Assessment

**DIRECT_PERMITTED**

### Rationale

1. **Self-contained backend performance fix.** The issue is limited to an existing endpoint implementation in `app/routers/api_auth.py:294-330`, where `get_me()` loads memberships once and then performs `HouseholdRepo().get_by_id(...)` inside a loop.

2. **Existing repo surface already supports the change.** `app/repos/sql/household.py:84-96` already owns membership retrieval and is the correct place to consolidate household data into one query or equivalent bulk fetch. This is a localized repository/handler adjustment, not a product or architecture change.

3. **No new acceptance criteria or UX behaviour.** The request does not add endpoints, schema concepts, or user-visible workflow changes. It only removes inefficient query behaviour while preserving the existing `/auth/me` response contract.

4. **Branch and scope are already fixed.** Work is explicitly constrained to `feat/034-m5-household-roles` and the named backend files. That makes this appropriate for direct implementation without a new SpecKit cycle.

---

## Explicit Scope Confirmation

Direct implementation is authorised for the following scope only:

- `app/routers/api_auth.py`
- `app/repos/sql/household.py` and any tightly coupled files under `app/repos/sql/` needed to support a single-query membership load
- Tests covering `/auth/me` membership loading behaviour, if required
- Running all four local CI-equivalent checks before concluding the work
- Committing implementation with the requested message:
  - `fix(auth): eliminate N+1 on /auth/me memberships (#034)`

Implementation must **not** expand scope into unrelated auth, household, migration, or frontend work.
