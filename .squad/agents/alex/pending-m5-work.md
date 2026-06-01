# Alex — Pending M5 Work (spec-034)

**Created:** 2026-05-22  
**Branch:** `feat/034-m5-household-roles`  
**Context:** Maya architectural review returned RED (2026-05-21). Both CRITICAL security items are resolved. The 5 HIGH backend items below are the remaining blockers before this branch is ready for PR.

---

## Status at Handoff

| Check | State |
|---|---|
| Backend CI (`ruff`, `mypy`, `pytest`) | ✅ Green — 485 passed, 5 xfailed |
| Frontend CI (`lint`, `test`, `build`) | ✅ Green — 188 passed |
| CRITICAL-1: BYPASSRLS removed, FORCE RLS added | ✅ Done (`b992181`) |
| CRITICAL-2: Cross-household admin reset blocked | ✅ Done (`e66ad69`) |
| HIGH items 1–5 below | ❌ Not started |

---

## Item 1 — Atomic Refresh Token Rotation

**Priority:** HIGH — race condition  
**Files:** `app/routers/api_auth.py:234-259`, `app/repos/sql/refresh_tokens.py:36-60`

**Problem:** Refresh token validation does SELECT → Python checks → revoke old → insert new across separate DB round-trips. Concurrent refresh calls can both read the same valid token and each mint a valid successor.

**Required fix:**
1. Add `RefreshTokenRepo.rotate(db, token_hash) -> RefreshToken | None` that performs a single atomic `UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = :hash AND revoked = FALSE AND expires_at > NOW() RETURNING *` and returns the matched row (or `None` if already revoked/expired).
2. In `api_auth.py` refresh route: call `repo.rotate()`, only mint and insert the new token if rotation returned a row; return `401` otherwise.
3. Add a test: `test_concurrent_refresh_only_one_wins` — two concurrent refreshes with the same token; assert only one succeeds (the other gets 401).

---

## Item 2 — Invitation Model Overhaul

**Priority:** HIGH — multiple spec violations  
**Files:** `app/models/household.py`, `app/repos/sql/household.py`, `app/routers/api_households.py`

**Problems:**
- Expiry is 7 days; spec requires **72 hours** (`functional-spec-v2.md:171, 1038`)
- `POST /households/{id}/invitations` takes no body; spec requires optional `invited_email` and `invited_role: "admin" | "member"` fields
- `invited_email` field exists on the model but is never persisted
- Accepted invitations always create `"member"` membership regardless of `invited_role`
- No **decline** endpoint (`POST /households/{id}/invitations/{token}/decline`)
- No **revoke** endpoint (`DELETE /households/{id}/invitations/{id}`, admin-only)
- No **resend** endpoint (`POST /households/{id}/invitations/{id}/resend`, admin-only)

**Required fixes (in order):**

### 2a. Invitation status column
Add a `status` column to `pending_invitations`: `Literal["pending", "accepted", "declined", "revoked"]`, default `"pending"`. Write a new Alembic migration (`0008_invitation_status.py`).

### 2b. Fix expiry and body fields
- Change expiry from 7 days to 72 hours in `HouseholdRepo.create_invitation()`
- Add `invited_email: str | None` and `invited_role: Literal["admin", "member"] = "member"` to the create-invitation request body (`CreateInvitationRequest` Pydantic model)
- Persist both fields when creating the invitation

### 2c. Use `invited_role` on accept
In `HouseholdRepo.accept_invitation()` (or the accept route), read `invitation.invited_role` and pass it to `HouseholdRepo.add_member()` instead of hardcoding `"member"`.

### 2d. Decline endpoint
`POST /households/{id}/invitations/{token}/decline`
- No auth required (invitee may not have an account yet)
- Validates token is `pending` and not expired; sets `status = "declined"`
- Returns `204`; does NOT create a membership

### 2e. Revoke endpoint
`DELETE /households/{id}/invitations/{invitation_id}` (admin-only, `Depends(require_admin)`)
- Sets `status = "revoked"` on the invitation
- Returns `204`

### 2f. Resend endpoint
`POST /households/{id}/invitations/{invitation_id}/resend` (admin-only)
- Resets `expires_at = now() + 72h` and `status = "pending"` on an existing invitation
- Returns the updated invitation

---

## Item 3 — Household Rename and Soft-Delete

**Priority:** HIGH — missing spec-required endpoints  
**File:** `app/routers/api_households.py`, `app/repos/sql/household.py`

**Required fixes:**

### 3a. Rename
`PATCH /households/{id}` (admin-only, `Depends(require_admin)`)
- Body: `{ "name": str }` — 1–50 chars, strip whitespace
- Updates `households.name`; returns updated household object
- Add `HouseholdRepo.rename(db, household_id, name) -> Household`

### 3b. Soft-delete
`DELETE /households/{id}` (admin-only)
- Add `deleted_at: datetime | None` column to `households` table via new migration (can be `0008` or `0009` depending on Item 2)
- Sets `deleted_at = now()`; returns `204`
- Guard: if household has 2+ active members, return `409 Conflict` with message `"Cannot delete a household with active members. Remove all members first."` (admin counts as a member)
- Deleted households must be filtered from `GET /households` and all dependency resolution

---

## Item 4 — Active-Household Resolution via `X-Household-Id` Header

**Priority:** HIGH — multi-household users always get wrong data  
**Files:** `app/deps.py:137-145, 206-213`, `app/routers/api_auth.py:294-297`

**Problem:** `current_household_membership` and `require_admin` resolve the active household by taking `memberships[0]` with no ordering guarantee. A user in multiple households will get inconsistent or wrong data.

**Required fixes:**

### 4a. Header-aware dependency resolution
In `current_household_membership` (and `require_admin` which depends on it):
1. Read `X-Household-Id` header from the incoming request
2. If present: look up the membership for `(authenticated_user.id, household_id_from_header)`; return it if found; raise `403` if user is not a member of that household
3. If absent: fall back to first membership ordered by `joined_at ASC` (current behaviour, for backward compat)

### 4b. `/auth/me` returns all memberships
`GET /auth/me` currently returns only the first membership. Update the response to include a `memberships: list[MembershipSchema]` field with all of the user's household memberships. The frontend already expects this (`AuthContext.tsx` multi-household model).

### 4c. `/auth/switch-household` endpoint (optional but preferred)
`POST /auth/switch-household` with body `{ "household_id": UUID }`:
- Validates the caller is a member of `household_id`
- Returns `{ "household_id": str, "role": str, "household_name": str }` — the frontend stores this as the active household in localStorage

---

## Item 5 — Import Wizard: Admin-Gate + Replace `request.session`

**Priority:** HIGH — broken at runtime + incorrect permission  
**Files:** `app/routers/import_wizard.py`, `app/main.py`

**Problem A — Wrong permission:** Import wizard is guarded by `current_household_membership`. Spec requires admin-only (`functional-spec-v2.md:1050-1053`).

**Problem B — Broken at runtime:** M5 removed `SessionMiddleware` from `main.py`. Import wizard uses `request.session` throughout (`import_wizard.py:69-107, 110-122`). Every wizard step will raise `AttributeError: 'Request' object has no attribute 'session'` at runtime.

**Required fixes:**

### 5a. Admin-gate
Change the dependency on all import wizard routes from `Depends(current_household_membership)` to `Depends(require_admin)`.

### 5b. DB-backed wizard state
Replace all `request.session[...]` reads/writes with a `ImportSession` table:

```sql
CREATE TABLE import_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id),
    state JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '2 hours'
);
```

- On wizard start (`GET /import`), create an `ImportSession` row and return its `id` as a cookie or response field
- Each subsequent wizard step reads/writes `import_session.state` (JSONB) keyed by session `id`
- Add a new Alembic migration for this table
- Import sessions expire after 2 hours; add a cleanup query on startup or rely on TTL

---

## Testing Checklist (Quinn will add coverage once each item is implemented)

| Item | Test to add |
|---|---|
| Atomic refresh | `test_concurrent_refresh_only_one_wins` |
| Invite 72h expiry | `test_invite_expires_after_72_hours` |
| Invite role on accept | `test_accept_invite_as_admin_creates_admin_member` |
| Decline invite | `test_decline_invitation` (remove current `xfail`) |
| Revoke invite | `test_accept_revoked_invitation_rejected` (already passes — regression guard) |
| Household rename | `test_admin_can_rename_household` (remove current `xfail`) |
| Household delete | `test_member_cannot_delete_household` (remove current `xfail`) |
| X-Household-Id routing | `test_brew_log_scoped_to_active_household` (remove current `skip`) |
| X-Household-Id wrong header | `test_wrong_household_id_header_rejected` (remove current `skip`) |
| Import wizard admin-gate | `test_member_cannot_access_import_wizard` |

---

## Key Files for Context

| File | What's in it |
|---|---|
| `docs/requirements/functional-spec-v2.md` | Full product spec — source of truth for all item requirements |
| `docs/requirements/engineering_architecture_v2.md` | Engineering architecture — auth, RLS, multi-tenancy patterns |
| `app/models/household.py` | ORM models: `Household`, `HouseholdMember`, `PendingInvitation`, `GuestToken` |
| `app/repos/sql/household.py` | All household data access methods |
| `app/routers/api_households.py` | Household API routes |
| `app/routers/api_auth.py` | Auth routes (refresh rotation is here) |
| `app/repos/sql/refresh_tokens.py` | Refresh token repo (rotate method goes here) |
| `app/deps.py` | `current_household_membership`, `require_admin` (Item 4 changes go here) |
| `app/routers/import_wizard.py` | Import wizard routes (Item 5 changes go here) |
| `tests/test_households.py` | Household tests — xfail markers to remove when items are done |
| `tests/test_role_enforcement.py` | Role enforcement tests — xfail markers to remove |
| `tests/test_integration.py` | Integration tests — skip markers to remove for Item 4 |

---

## Protocol Notes

- Work against branch `feat/034-m5-household-roles` — do NOT branch off or create a new branch
- Each item should be a separate commit with a clear message (e.g. `fix(auth): atomic refresh token rotation`)
- Run all four CI checks after completing each item — do not batch
- Do NOT run `git push` — operator will review and push when all items are complete
- Quinn will update xfail/skip markers to live tests as each item lands
