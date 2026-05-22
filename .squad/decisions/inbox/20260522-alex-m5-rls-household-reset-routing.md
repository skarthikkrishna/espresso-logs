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
