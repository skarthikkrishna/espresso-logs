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
