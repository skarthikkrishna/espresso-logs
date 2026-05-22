# M5 Spec-034 Architectural Review — Maya  
Date: 2026-05-21

## Executive Summary
**Overall: RED**

M5 lands core auth primitives correctly in a few areas — **argon2id hashing**, **JWT `sub/exp` claims**, **SHA-256 refresh-token storage**, and **logout revocation** are present (`app/services/auth.py:25-31, 67-82, 105-123`; `app/routers/api_auth.py:266-282`; `app/auth.py:164-175`).

However, the implementation has **two critical isolation/security failures** and several major spec misses:
- **DB-level tenant isolation is effectively bypassed** by granting `BYPASSRLS` to the app runtime (`alembic/versions/0007_m5_schema_corrections.py:146-171`; `tests/test_integration.py:6-11`).
- **Any household admin can reset any user’s password** by username, with no shared-household check (`app/routers/api_auth.py:310-329`).

On top of that, major M5 product requirements are still missing or wrong: **onboarding**, **invite role/email support**, **decline/resend/revoke invite flows**, **profile page**, **household settings rename/delete**, **guest read-only flow**, and the entire **multi-household active-context/switcher model**.

---

## Functional Gap Analysis

| Spec requirement | Status | Evidence |
|---|---|---|
| Username/password registration | **Partial / Wrong** | Implemented at `POST /auth/register` (`app/routers/api_auth.py:130-175`), but validation drifts from spec: allows hyphens and 32 chars, not 3–30 underscores-only (`api_auth.py:38, 53-60`; `frontend/src/pages/Register.tsx:24-31`; spec `functional-spec-v2.md:130, 739-743`). |
| Login | **Partial** | Implemented (`api_auth.py:177-217`), but no invite continuation or redirect-back flow on frontend (`frontend/src/pages/Login.tsx:98-109, 234-241`; `frontend/src/api/client.ts:96-99`). |
| Logout | **Implemented** | Revokes stored refresh token and clears cookie (`api_auth.py:266-282`). |
| Refresh | **Partial** | Works functionally (`api_auth.py:220-263`) but refresh validation/rotation is not atomic as required by review criteria/arch intent. |
| Google OAuth callback issuing JWT + refresh pair | **Implemented** | `app/auth.py:164-175`. |
| First-sign-in onboarding `/welcome` | **Missing / Wrong** | Spec requires `/welcome` when user has zero memberships (`functional-spec-v2.md:602-645`), but backend auto-creates `"Home"` household on register/login/OAuth (`api_auth.py:118-123, 155, 208`; `app/auth.py:159-163`) and frontend has no `/welcome` route (`frontend/src/router.tsx:29-55`). |
| Household creation wizard / `/household/new` | **Missing** | Backend has `POST /households` (`api_households.py:116-129`), but no `/household/new` UI route/page (`router.tsx:29-55`; spec `functional-spec-v2.md:862-863`). |
| Household switcher / active household persistence | **Missing** | No switcher route/state/UI; backend always uses `memberships[0]` (`app/deps.py:137-145, 206-213`; `api_auth.py:294-297`; `frontend/src/types/entities.ts:82-90`; spec `functional-spec-v2.md:844-883`). |
| Profile page `/profile` | **Missing** | No route/page (`frontend/src/router.tsx:29-55`; spec `functional-spec-v2.md:794-840`). |
| Household settings `/household/settings` | **Missing** | No route/page (`router.tsx:29-55`; spec `functional-spec-v2.md:543, 828-839`). |
| Rename household | **Missing** | No API route in `app/routers/api_households.py:116-303`; spec requires household settings rename (`functional-spec-v2.md:73, 1180`). |
| Delete household | **Missing** | No API route in `app/routers/api_households.py:116-303`; spec requires delete flow (`functional-spec-v2.md:543, 1181`). |
| Invite member with optional email | **Missing / Wrong** | Endpoint exists (`api_households.py:180-202`) but takes no body, no email, and repo doesn’t persist `invited_email` (`app/repos/sql/household.py:154-173`) despite model field existing (`app/models/household.py:98-120`). |
| Invite member with role selector (`admin` / `member`) | **Missing / Wrong** | No role input anywhere; accepted users are always created as `"member"` (`api_households.py:228-244`); spec requires role selector (`functional-spec-v2.md:651-653, 682`). |
| Invitation expiry 72 hours | **Wrong** | Spec says 72h (`functional-spec-v2.md:171, 1038`; `engineering_architecture_v2.md:284`), repo creates 7-day invitations (`app/repos/sql/household.py:162-169`). |
| Accept-invite route `/invite/accept?token=` | **Missing / Partial** | Only JSON API `POST /households/accept-invite` exists (`api_households.py:205-244`); no frontend route (`router.tsx:29-55`). |
| Accept-invite confirmation screen | **Missing** | No route/page/UI. |
| Decline invitation | **Missing** | No route or endpoint in `api_households.py:205-244`; spec requires decline without consuming token (`functional-spec-v2.md:704-706, 726`). |
| Invalid / expired invite pages | **Missing** | No `/invite/invalid` or `/invite/expired` routes/pages (`router.tsx:29-55`; spec `functional-spec-v2.md:717-721`). |
| Revoke pending invitation | **Missing** | No endpoint/UI; spec matrix requires it (`functional-spec-v2.md:1170`). |
| Resend expired invitation | **Missing** | No endpoint/UI; spec matrix requires it (`functional-spec-v2.md:1171`). |
| Promote/demote household roles | **Partial** | PATCH exists (`api_households.py:263-280`), but invite-as-admin is missing and multi-household routing is broken by `memberships[0]`. |
| Admin password reset | **Wrong** | Endpoint exists (`api_auth.py:310-329`) but does not validate shared household membership, contrary to architecture (`engineering_architecture_v2.md:145-147, 532`). |
| Guest link generation | **Wrong** | `GET /households/{id}/guest-token` always revokes and reissues (`api_households.py:283-303`) instead of retrieve-or-generate; wrong URL format (`?guest=`) vs spec `/households/{id}/view?key=` (`functional-spec-v2.md:589, 769`; `engineering_architecture_v2.md:533`). |
| Revoke guest link | **Missing** | No revoke endpoint; spec requires explicit revoke (`functional-spec-v2.md:588, 1178`). |
| Guest read-only dashboard/catalog/brew-log | **Missing / Partial** | Only brew-log list accepts guest token (`api_brew_log.py:123-145`); dashboard and catalog still require membership (`api_dashboard.py:25-31`; `api_catalog.py:115-120`). |
| Admin-only delete endpoints for catalog/inventory/hardware/maintenance | **Missing** | No delete routes in `api_catalog.py:115-455`, `api_inventory.py:45-103`, `api_hardware.py:69-188`, `api_maintenance.py:42-110`, despite spec/arch permission matrices (`functional-spec-v2.md:1172-1181`; `engineering_architecture_v2.md:429-435`). |
| Bootstrap import admin-only | **Wrong** | Import wizard is guarded only by `current_household_membership`, not `require_admin` (`app/routers/import_wizard.py:30`; spec `functional-spec-v2.md:1050-1053`). |

---

## Security Findings

- **CRITICAL — Runtime DB role is granted `BYPASSRLS`, defeating DB-enforced isolation**  
  **Files:** `alembic/versions/0007_m5_schema_corrections.py:146-171`, `tests/test_integration.py:6-11`  
  The migration creates `app_admin BYPASSRLS` and grants it to `coffee_tracker_runtime`. That means the application’s normal DB connection can bypass every RLS policy. The integration test file explicitly acknowledges owner/bypass behaviour and only forces RLS for one test.  
  **Recommended fix:** Remove `GRANT app_admin TO coffee_tracker_runtime`; use a separate operational/admin connection for cross-tenant maintenance only, and enable/verify `FORCE ROW LEVEL SECURITY` where appropriate.

- **CRITICAL — Cross-household admin password reset vulnerability**  
  **File:** `app/routers/api_auth.py:310-329`  
  `require_admin` verifies only that the caller is *an* admin; the endpoint then resets any user found by username with no shared-household validation.  
  **Recommended fix:** After loading `target`, require `HouseholdRepo().get_member(db, caller_membership.household_id, target.id)` to succeed; return 404/403 otherwise.

- **HIGH — Refresh-token validation/rotation is not atomic**  
  **Files:** `app/routers/api_auth.py:234-259`, `app/repos/sql/refresh_tokens.py:36-60`  
  Refresh does `SELECT` → Python checks → revoke old → insert new in separate steps. Concurrent refreshes can race and both mint valid successors.  
  **Recommended fix:** Implement a single DB operation such as `UPDATE ... SET revoked = TRUE WHERE token_hash = :hash AND revoked = FALSE AND expires_at > NOW() RETURNING user_id`; only then insert the replacement token.

- **HIGH — Invitation expiry is 7 days, not the spec’s 72 hours**  
  **Files:** `app/repos/sql/household.py:162-169`; spec `functional-spec-v2.md:171, 1038`; `engineering_architecture_v2.md:284`  
  This is both a functional and security drift, because invite links remain valid longer than specified.  
  **Recommended fix:** Change invitation expiry to 72 hours end-to-end and add regression tests.

- **MEDIUM — Guest token URL/key contract does not match the spec**  
  **Files:** `app/routers/api_households.py:302-303`, `app/deps.py:180-193`; spec `functional-spec-v2.md:589, 769`  
  Implementation emits `?guest=<token>` and resolves `guest`, while the spec requires `/households/<id>/view?key=<token>`.  
  **Recommended fix:** Align on the spec contract, add a dedicated guest view route, and keep old param only as temporary compatibility shim if needed.

---

## Multi-Tenancy / RLS Findings

- **CRITICAL — Active household context is not implemented; app always picks `memberships[0]`**  
  **Files:** `app/deps.py:137-145, 206-213`, `app/routers/api_auth.py:294-297`, `frontend/src/types/entities.ts:82-90`  
  The spec requires a persistent active household/session model and switcher (`functional-spec-v2.md:844-883`), but backend membership resolution simply grabs the first membership with no ordering, no session key, and no switch endpoint.  
  **Recommended fix:** Introduce explicit active-household state (server session or explicit household-context mechanism), return all memberships from `/auth/me`, and add a switch endpoint/UI.

- **HIGH — Multi-household users can be falsely denied access to legitimate households**  
  **Files:** `app/deps.py:137-145`, `app/routers/api_households.py:156-157, 187-188, 255-256, 272-273, 291-292`  
  Because `require_admin/current_household_membership` resolve only `memberships[0]`, a user who belongs to household B but has household A first will get `403` on household-B detail/admin routes.  
  **Recommended fix:** Resolve membership from the active household context or from the requested household ID (validated against membership).

- **HIGH — RLS is enabled only on five legacy tenant tables, not on all household-scoped tables**  
  **Files:** `alembic/versions/0007_m5_schema_corrections.py:121-140`, `app/models/household.py:83-155`  
  `pending_invitations`, `guest_tokens`, and `household_members` are household-scoped but get no RLS policy in migration 0007.  
  **Recommended fix:** Either extend RLS to all household-scoped tables or document and enforce an alternative isolation boundary for those tables.

- **MEDIUM — Tenant ORM models still declare `household_id` nullable**  
  **Files:** `app/models/catalog.py:28`, `app/models/inventory.py:24`, `app/models/hardware.py:24`, `app/models/maintenance.py:24`, `app/models/brew_log.py:24`  
  The functional/engineering specs require household scope to be non-null for tenant data. The ORM still models these as nullable, which keeps “orphan” rows possible in code.  
  **Recommended fix:** Complete backfill and make the ORM/schema definitively non-null.

- **MEDIUM — RLS tests do not validate real runtime enforcement across the full surface**  
  **File:** `tests/test_integration.py:6-11, 192-271`  
  Only one integration test force-enables RLS on one table. That does not prove production isolation for all scoped tables.  
  **Recommended fix:** Add integration coverage that runs under the same non-bypass DB role used by the app, across all tenant tables.

---

## Code Quality Findings

- **HIGH — Migration 0007 is unsafe for existing guest/invitation rows**  
  **Files:** `alembic/versions/0007_m5_schema_corrections.py:34-42, 54-67`  
  The migration adds non-null `token_hash` columns with `server_default=""` and immediately creates unique constraints. If existing tables contain more than one row, the unique constraint can fail because every row initially gets the same empty string.  
  **Recommended fix:** Add nullable hash column, backfill real hashes from existing tokens, then enforce `NOT NULL` and uniqueness.

- **HIGH — Import wizard is no longer compatible with SessionMiddleware removal**  
  **Files:** `app/routers/import_wizard.py:69-107, 110-122`; `app/main.py:206-234`  
  M5 removed SessionMiddleware for auth, but import wizard still uses `request.session`. There is no SessionMiddleware in `main.py`, so these code paths are at risk of runtime failure.  
  **Recommended fix:** Move wizard state to the database (preferred) or reintroduce an intentional session layer for this flow only.

- **HIGH — Import wizard is not admin-gated**  
  **File:** `app/routers/import_wizard.py:30`  
  Spec says bootstrap import is admin-only; current route dependency allows any member.  
  **Recommended fix:** Change dependency to `Depends(require_admin)` and add explicit tests.

- **MEDIUM — Username validation drifts from spec on both backend and frontend**  
  **Files:** `app/routers/api_auth.py:38, 53-60`, `frontend/src/pages/Register.tsx:24-31`  
  Implementation allows `-` and length 32; spec says 3–30 and alphanumeric + underscores.  
  **Recommended fix:** Centralise username validation and align both layers with the spec.

- **MEDIUM — `last_seen_at` is not updated on ordinary authenticated requests**  
  **Files:** `app/repos/sql/user.py:83-87`; spec `functional-spec-v2.md:137`  
  The repo method exists but is unused. Only OAuth callback updates `last_seen_at` (`app/auth.py:146-154`).  
  **Recommended fix:** Update `last_seen_at` in the auth dependency or a dedicated auth middleware.

- **LOW — Household endpoints have avoidable N+1 query patterns**  
  **Files:** `app/routers/api_households.py:137-142, 158-161`  
  Listing households and household members loops over separate repo lookups per row.  
  **Recommended fix:** Add joined repo queries for memberships + households/users.

- **LOW — Legacy allowlist/Google-account messaging remains in production UX and config**  
  **Files:** `app/main.py:237-247`, `app/config.py:103-113, 176-189`  
  Error copy still references a Google allowlist model that M5 deprecates.  
  **Recommended fix:** Remove or rewrite stale allowlist-era messaging/config branches.

---

## Frontend Findings

- **CRITICAL — Most spec-required auth/household routes are absent**  
  **File:** `frontend/src/router.tsx:29-55`  
  Missing: `/welcome`, `/invite/accept`, `/invite/invalid`, `/invite/expired`, `/profile`, `/household/settings`, `/household/new`, and guest household view route.  
  **Recommended fix:** Add the route tree and corresponding pages before calling M5 complete.

- **CRITICAL — No multi-household model in frontend state**  
  **Files:** `frontend/src/types/entities.ts:82-90`, `frontend/src/contexts/AuthContext.tsx:58-137`  
  Frontend only stores single `household_id` and `role`. No memberships array, no active-household state, no switcher.  
  **Recommended fix:** Extend `/auth/me` + TS types to include `memberships[]` and `active_household_id`; add household context/provider.

- **HIGH — Guest read-only UX is largely unimplemented**  
  **Files:** `frontend/src/router.tsx:29-55`, `frontend/src/components/ProtectedRoute.tsx:15-29`  
  There is no public guest household route, no guest banner, and all app pages sit behind auth-only protection.  
  **Recommended fix:** Add guest view route/page(s) and read-only rendering for dashboard, brew log, and catalog.

- **HIGH — Role-based route protection is missing**  
  **File:** `frontend/src/components/ProtectedRoute.tsx:15-29`  
  ProtectedRoute only checks auth, not role. That is insufficient for `/household/settings` and other admin-only surfaces.  
  **Recommended fix:** Add an admin-aware route wrapper.

- **HIGH — Login/register do not preserve invite tokens or return-to location**  
  **Files:** `frontend/src/pages/Login.tsx:98-109, 234-241`, `frontend/src/pages/Register.tsx:134-140`, `frontend/src/api/client.ts:96-99`  
  This breaks the specified invitation flow (`/login?invite=...`, `/register?invite=...`) and loses the user’s intended destination after auth.  
  **Recommended fix:** Preserve `invite` and `from` across redirects and apply invite token automatically post-auth.

- **MEDIUM — Onboarding is bypassed by immediate dashboard navigation**  
  **Files:** `frontend/src/pages/Login.tsx:104-109`, `frontend/src/pages/Register.tsx:135-140`  
  The frontend always navigates to `/`, which matches the backend auto-home-household workaround, not the functional spec’s welcome/onboarding flow.  
  **Recommended fix:** Navigate to `/welcome` for zero-membership users once backend/session semantics are corrected.

- **LOW — Login page lacks basic required-field validation**  
  **File:** `frontend/src/pages/Login.tsx:98-129`  
  Empty submissions go straight to the server and surface as generic auth failures.  
  **Recommended fix:** Add minimal client-side required validation for username/password.

- **LOW — Register page writes the access token twice**  
  **File:** `frontend/src/pages/Register.tsx:135-137`  
  It calls both the module setter and the context setter.  
  **Recommended fix:** Funnel token updates through AuthContext only.

---

## Test Coverage Gaps

- **Cross-household admin reset is untested**  
  `tests/test_auth_wave4.py:664-708` covers success and non-admin rejection, but not “admin from household A attempts reset of user from household B”.

- **Refresh expiry path is untested**  
  `tests/test_auth_wave4.py` covers revoked/replay, but not expired non-revoked tokens.

- **Invitation revoke path is untested**  
  `tests/test_households.py` has expired/accepted/duplicate/not-found, but not revoked invites even though helper support exists (`tests/test_households.py:79-97, 273-331`).

- **Member→403 coverage is weak for admin-only endpoints**  
  Most tests override `require_admin` directly instead of exercising real JWT/member-role enforcement end-to-end.

- **No multi-household switching tests exist**  
  There is no backend or frontend coverage for active household selection, persistence, or correct data refresh when switching.

- **Guest flow coverage is incomplete**  
  Current tests cover brew-log guest access and catalog denial, but not the spec’s required guest dashboard/catalog read-only experience or revoke-invalidates-old-link flow.

- **Frontend auth infrastructure has no direct tests**  
  No tests for `AuthContext`, `ProtectedRoute`, or `client.ts` refresh/retry behaviour.

- **Frontend success-path coverage is thin**  
  `Login.test.tsx` and `Register.test.tsx` cover rendering/error states, but not full happy paths with token hydration, user fetch, redirects, or invite-token continuation.

- **Integration coverage does not prove real RLS for the full product surface**  
  Only brew_log gets a forced-RLS test; catalog, inventory, hardware, maintenance, invitations, guest tokens, and household membership boundaries are not equivalently proven.

---

## Gaps Requiring Agent Handoff

### Alex (Backend)
- **CRITICAL:** Remove runtime `BYPASSRLS` grant / restore real DB-enforced isolation (`0007_m5_schema_corrections.py:146-171`)
- **CRITICAL:** Add shared-household validation to admin password reset (`api_auth.py:310-329`)
- **HIGH:** Implement atomic refresh rotation (`api_auth.py:234-259`)
- **HIGH:** Fix invitation model/API: 72h expiry, optional email, invited role, decline/revoke/resend flows (`app/models/household.py:83-120`; `app/repos/sql/household.py:154-173`; `api_households.py:180-244`)
- **HIGH:** Implement household rename/delete and proper guest-token retrieve/revoke semantics (`api_households.py:116-303`)
- **HIGH:** Replace `memberships[0]` with real active-household resolution (`app/deps.py:137-145, 206-213`; `api_auth.py:294-297`)
- **HIGH:** Admin-gate and repair import wizard session/state handling (`import_wizard.py:30, 69-122`; `main.py:206-234`)

### Finn (Frontend)
- **CRITICAL:** Add `/welcome`, invite routes, `/profile`, `/household/settings`, `/household/new`, and guest household view (`frontend/src/router.tsx:29-55`)
- **CRITICAL:** Build household switcher + active-household context/state (`AuthContext.tsx`, `types/entities.ts`, router/app shell)
- **HIGH:** Implement guest read-only UX and admin-only route protection (`ProtectedRoute.tsx`, router, pages)
- **HIGH:** Preserve invite tokens and return-to paths through login/register/refresh (`Login.tsx`, `Register.tsx`, `client.ts`)
- **MEDIUM:** Align auth UI with onboarding/profile/settings requirements and role-based controls

### Quinn (QE)
- **CRITICAL:** Add regression coverage for cross-household password reset, real RLS enforcement, and multi-household context resolution
- **HIGH:** Add negative-path tests for expired refresh, revoked invite, member→403 on all admin-only endpoints, guest revoke flow
- **HIGH:** Add frontend tests for AuthContext, ProtectedRoute, client refresh/retry, login/register success paths, invite redirects, and guest routes
- **HIGH:** Add integration coverage across catalog/inventory/hardware/maintenance/households, not only brew_log

___BEGIN___COMMAND_DONE_MARKER___0
