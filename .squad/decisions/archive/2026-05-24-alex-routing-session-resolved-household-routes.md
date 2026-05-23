# Routing Decision — Session-Resolved Household & Invitation Routes

**Date:** 2026-05-24  
**Agent:** Alex (routing)  
**Branch:** feat/034-m5-household-roles  
**Request:** Restructure invitation and household-member management routes to be session-resolved so `household_id` is not visible in URLs for routes that operate on the caller's active household.

---

## Decision

**status: DIRECT_PERMITTED**

---

## Rationale

This is a self-contained, internally-complete refactor with fully-specified implementation details. No new product behaviour, no new data models, no new architecture decisions, and no new spec content is required. All needed infrastructure (`current_household_membership` dep in `app/deps.py`) already exists and is in production use on other routes.

### What makes this bounded and safe for direct implementation

1. **Single primary file change:** `app/routers/api_households.py` — drop the `{household_id}` path parameter from routes that already validate `membership.household_id == household_id`. The session-resolved membership already carries the correct `household_id`; the URL param is redundant and leaks internal IDs.

2. **Routes to restructure (session-resolved — remove `{household_id}` from path):**
   - `GET /{household_id}` → `GET /me`
   - `PATCH /{household_id}` → `PATCH /me`
   - `DELETE /{household_id}` → `DELETE /me` *(add tech-debt TODO above this handler)*
   - `POST /{household_id}/invite` → `POST /me/invite`
   - `DELETE /{household_id}/invitations/{invitation_id}` → `DELETE /me/invitations/{invitation_id}`
   - `POST /{household_id}/invitations/{invitation_id}/resend` → `POST /me/invitations/{invitation_id}/resend`
   - `POST /{household_id}/invitations/{token}/decline` → `POST /me/invitations/{token}/decline`
   - `DELETE /{household_id}/members/{user_id}` → `DELETE /me/members/{user_id}`
   - `PATCH /{household_id}/members/{user_id}` → `PATCH /me/members/{user_id}`
   - `GET /{household_id}/guest-token` → `GET /me/guest-token`

3. **Routes to leave unchanged (require explicit household_id):**
   - `POST /` → create_household (no household context yet)
   - `GET /` → list_my_households (lists all, no single-household context)
   - `POST /accept` → accept_invite (token-based, no session household)

4. **Dependency already in use:** `current_household_membership` (and its `Annotated` alias `CurrentMembership`) is already imported and used throughout the file. The refactor simply replaces `if membership.household_id != household_id: raise 403` guards with direct use of `membership.household_id`.

5. **Test updates are scoped:** `tests/test_households.py` and `tests/test_role_enforcement.py` URL patterns need updating to match new `/me/...` paths. No new test logic required — just URL path corrections.

6. **Tech-debt TODO:** A comment must be added above `DELETE /me` (formerly `DELETE /{household_id}`) noting that hard-delete is a placeholder; soft-delete + cascade cleanup is required before production.

7. **Source-of-truth docs** (`docs/requirements/functional-spec-v2.md`, `docs/requirements/engineering_architecture_v2.md`) confirm the session-resolution model as intended design.

8. **CI gates:** All four required checks must pass before commit:
   - `uv run ruff check app/ tests/`
   - `uv run ruff format --check app/ tests/`
   - `uv run mypy app/ --strict`
   - `SPREADSHEET_ID=dummy uv run pytest tests/ -v --ignore=tests/e2e/`

---

## Scope Confirmation

**Explicitly in scope:**
- `app/routers/api_households.py` — route path changes, removal of redundant `household_id` path params and ownership guards
- `tests/test_households.py` — URL path corrections
- `tests/test_role_enforcement.py` — URL path corrections
- Tech-debt TODO comment on the delete-household handler

**Explicitly out of scope:**
- `app/deps.py` — no changes needed; `current_household_membership` is already correct
- Data models, migrations, schemas — no changes
- Frontend — separate concern; frontend already uses session headers
- Any other router file

**No SpecKit cycle required.** The change is a URL-shape refactor enforcing an existing architectural pattern. The implementation details are fully specified by the requester and consistent with the v2 architecture docs.

---

## Risk Assessment

**Low risk.** The `membership.household_id != household_id` guards being removed are logically equivalent to using `membership.household_id` directly, since `current_household_membership` already enforces that the caller belongs to the resolved household. Removing the path param eliminates an entire class of potential 403 drift bugs.

**No push until operator confirms.** Per Inviolable Rule 10.
