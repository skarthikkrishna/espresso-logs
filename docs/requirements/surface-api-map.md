# Espresso-Logs — UI Surface → FE/BE/External Resource Map

**Version:** v2 (consolidated, independently verified)  
**Generated:** 2026-06-15  
**Source revision:** `espresso-logs` repo at HEAD  
**Scope:** Every working UI surface + action, traced to FE component → typed API client → BE endpoint → service/repo → external resource.  
**Verification:** Independently verified by Tariq (completeness), Quinn (behavioral/QA), and Maya (architecture) after v1 was drafted. See §5 for verification summary and §6 for a changelog vs v1.

---

## Table of Contents

1. [Surface Index (Validation Checklist)](#1-surface-index)
2. [Per-Surface Map](#2-per-surface-map)
   - [2.1 Auth — Login / Register / OAuth](#21-auth--login--register--oauth)
   - [2.2 Welcome Page (Onboarding Wizard)](#22-welcome-page-onboarding-wizard)
   - [2.3 Dashboard](#23-dashboard)
   - [2.4 Brew Log List](#24-brew-log-list)
   - [2.5 Brew Log — Add Shot](#25-brew-log--add-shot)
   - [2.6 Brew Log — Detail / Correction / Delete / AI Feedback](#26-brew-log--detail)
   - [2.7 Catalog List](#27-catalog-list)
   - [2.8 Catalog Detail](#28-catalog-detail)
   - [2.9 Hardware Page](#29-hardware-page)
   - [2.10 Profile Page](#210-profile-page)
   - [2.11 Household Settings (Admin)](#211-household-settings-admin)
   - [2.12 Household — Create New](#212-household--create-new)
   - [2.13 Import Wizard (Admin)](#213-import-wizard-admin)
   - [2.14 Invite Accept Flow](#214-invite-accept-flow)
   - [2.15 Invite Invalid / Expired Screens](#215-invite-invalid--expired-screens)
   - [2.16 Guest View](#216-guest-view)
   - [2.17 NotFound — 404 Catch-All](#217-notfound--404-catch-all)
3. [Resource Catalogs](#3-resource-catalogs)
   - [3a. BE Endpoints (all 62)](#3a-be-endpoints)
   - [3b. Repos and Datastores](#3b-repos-and-datastores)
   - [3c. External Resources](#3c-external-resources)
4. [Candidate Gaps](#4-candidate-gaps)
5. [Verification Summary](#5-verification-summary)
6. [Changelog vs v1](#6-changelog-vs-v1)

---

## 1. Surface Index

Use this as a checklist when validating whether a cross-cutting feature is implemented end-to-end. Every checkbox here corresponds to one or more rows in §2; the action IDs are used cross-referentially throughout.

> **v2 fix:** A-08 in v1 was a numbering collision — `GET /auth/me` was labelled A-08 in §2 but omitted from §1, and admin reset-password was labelled A-08 in §1 but A-09 in §2. Fixed: `GET /auth/me` is now A-08 in both §1 and §2; admin reset-password is A-09 in both.

### Auth
- [ ] A-01 Login — username/password form
- [ ] A-02 Login — Google OAuth button (redirect to /auth/google)
- [ ] A-03 Login — OAuth success callback (?oauth_success=1)
- [ ] A-04 Register — new account form
- [ ] A-05 Token auto-refresh on page load / 401 (AuthContext)
- [ ] A-06 Logout (Profile page button)
- [ ] A-07 Switch active household (Profile page / AuthContext)
- [ ] A-08 Get current user — `GET /auth/me` (most-called endpoint; used by AuthContext, HouseholdNew, InviteAccept, HouseholdSettings)
- [ ] A-09 Admin reset password (BE endpoint only — **no FE form wired** — Gap #1)

### Welcome / Onboarding
- [ ] W-01 Welcome — shown to authenticated users with zero household memberships
- [ ] W-02 Welcome — "Create a household" step → `POST /households` + `GET /auth/me`
- [ ] W-03 Welcome — "Join via invite" step → static instructions (no API)
- [ ] W-04 Welcome — unauthenticated user → redirect to `/login`
- [ ] W-05 Welcome — user with existing household → redirect to `/`

### Dashboard
- [ ] D-01 Dashboard — load active bags + recent shots
- [ ] D-02 Dashboard — "Log a shot" FAB → /brew-log/add
- [ ] D-03 Dashboard — Active bag card → /brew-log/add?bag_id=...
- [ ] D-04 Dashboard — "Manage catalog" CTA → /catalog
- [ ] D-05 Dashboard — "Import CSV" CTA (empty state) → /import
- [ ] D-06 Dashboard — Recent shot row → /brew-log/:id

### Brew Log
- [ ] BL-01 Brew Log List — paginated shot list
- [ ] BL-02 Brew Log List — click shot row → /brew-log/:id
- [ ] BL-03 Brew Log List — "Log a shot" FAB → /brew-log/add
- [ ] BL-04 Brew Log Add — load active inventory bags
- [ ] BL-05 Brew Log Add — load hardware (machines, grinders, baskets, storage)
- [ ] BL-06 Brew Log Add — load defaults for selected bag+basket
- [ ] BL-07 Brew Log Add — submit new shot (with idempotency key)
- [ ] BL-08 Brew Log Detail — load shot detail
- [ ] BL-09 Brew Log Detail — load AI feedback (separate query)
- [ ] BL-10 Brew Log Detail — generate AI feedback (on-demand)
- [ ] BL-11 Brew Log Detail — submit correction (patch taste/notes/grind/eligibility)
- [ ] BL-12 Brew Log Detail — delete shot (admin only)

### Catalog
- [ ] C-01 Catalog List — load all catalog items (with search/filter client-side)
- [ ] C-02 Catalog List — "Add bean" modal → opens AddBeanModal
- [ ] C-03 Catalog Add — infer catalog fields from product URL (LLM)
- [ ] C-04 Catalog Add — create catalog item (with optional image upload)
- [ ] C-05 Catalog Detail — load catalog item + linked bags + recent shots
- [ ] C-06 Catalog Detail — edit catalog item (roaster, bean name, roast level, URL)
- [ ] C-07 Catalog Detail — upload/replace catalog image
- [ ] C-08 Catalog Detail — add new bag to catalog
- [ ] C-09 Catalog Detail — mark bag finished / reactivate (inventory status patch)

### Hardware
- [ ] HW-01 Hardware Page — load hardware list
- [ ] HW-02 Hardware Page — select hardware item → load detail (maintenance history)
- [ ] HW-03 Hardware Page — add hardware (AddHardwareModal)
- [ ] HW-04 Hardware Page — edit hardware name/category (EditHardwareModal)
- [ ] HW-05 Hardware Page — upload hardware image
- [ ] HW-06 Hardware Page — log maintenance event (LogMaintenanceModal)
- [ ] HW-07 Hardware Page — load action types per category (**loaded in LogMaintenanceModal, not at page load** — see §2.9)

### Profile
- [ ] P-01 Profile — load current user + memberships (from AuthContext / `GET /auth/me`)
- [ ] P-02 Profile — switch active household
- [ ] P-03 Profile — "Manage" link → /household/settings (admin only)
- [ ] P-04 Profile — "Create household" CTA → /household/new
- [ ] P-05 Profile — Sign out button

### Household Management
- [ ] HH-01 Household New — create household form
- [ ] HH-02 Household Settings — load household detail (members, invitations, guest access)
- [ ] HH-03 Household Settings — rename household
- [ ] HH-04 Household Settings — update member role (promote/demote)
- [ ] HH-05 Household Settings — remove member
- [ ] HH-06 Household Settings — create invitation (with optional email + role)
- [ ] HH-07 Household Settings — copy invite URL (clipboard)
- [ ] HH-08 Household Settings — revoke invitation
- [ ] HH-09 Household Settings — resend invitation
- [ ] HH-10 Household Settings — generate guest access link
- [ ] HH-11 Household Settings — copy guest URL (clipboard)
- [ ] HH-12 Household Settings — revoke guest access link
- [ ] HH-13 Household Settings — delete household (with name confirmation)

### Invitations
- [ ] INV-01 Invite Accept — preview invitation (household + inviter + role + expiry)
- [ ] INV-02 Invite Accept — accept invitation
- [ ] INV-03 Invite Accept — decline invitation (**intentional no-op — no DB state change; see Gap #3**)
- [ ] INV-04 Invite Accept — redirect unauthenticated user to login with token preserved
- [ ] INV-05 Invite Invalid — static error screen (/invite/invalid)
- [ ] INV-06 Invite Expired — static error screen (/invite/expired)

### Guest View
- [ ] GV-01 Guest View — load entire household snapshot (dashboard + brew log + catalog)

### Import Wizard
- [ ] IMP-01 Import Wizard — upload CSV file (client-side parse + preview)
- [ ] IMP-02 Import Wizard — validate rows + show errors
- [ ] IMP-03 Import Wizard — commit catalog rows (POST /api/catalog per row)
- [ ] IMP-04 Import Wizard — commit brew-log rows (POST /api/brew-log per row)
- [ ] IMP-05 Import Wizard — `GET /import` BE session init (**Gap #2 — never called from FE**)

### Not Found
- [ ] NF-01 NotFound — 404 catch-all (path: `*` within AppShell); no API calls

---

## 2. Per-Surface Map

> **Convention:** "Datastore" notes what the BE endpoint reads/writes in production (`USE_POSTGRES=true`, M5). Sheets is archive/read-fallback only — with **one exception**: `HardwareRepo.next_id()` still reads Google Sheets (see Gap #6 and §3b).

---

### 2.1 Auth — Login / Register / OAuth

**Routes:** `/login`, `/register`  
**Page components:** `frontend/src/pages/Login.tsx`, `frontend/src/pages/Register.tsx`

#### A-01: Username/password login

| Layer | Detail |
|---|---|
| **FE Component** | `Login.tsx` |
| **FE API Client** | `auth.ts → login(username, password)` |
| **HTTP** | `POST /auth/login` |
| **BE Router** | `app/routers/api_auth.py :: login()` |
| **BE Service** | `app/services/auth.py :: verify_password()`, `create_access_token()`, `generate_refresh_token()`, `set_refresh_cookie()` |
| **BE Repo** | `UserRepo` (SQL), `RefreshTokenRepo` (SQL) |
| **Postgres tables** | `users` (read), `refresh_tokens` (insert) |
| **Auth** | Public. Rate-limited 10/min. |

#### A-02/A-03: Google OAuth (login and callback)

| Layer | Detail |
|---|---|
| **FE Surface** | Login page "Sign in with Google" button → browser redirect |
| **FE API Client** | Direct browser navigation to `/auth/google` (`frontend/src/pages/Login.tsx:76-79`) |
| **HTTP** | `GET /auth/google` → 302 to Google; `GET /auth/callback` (alias); `GET /auth/google/callback` |
| **BE Router** | `app/auth.py :: google_login()`, `app/auth.py :: google_callback()` |
| **BE Service** | `app/services/auth.py :: create_access_token()`, `generate_refresh_token()`, `set_refresh_cookie()` |
| **BE Repo** | `UserRepo` (upsert by google_sub), `RefreshTokenRepo` (insert) |
| **External** | Google OAuth2 PKCE flow; `accounts.google.com`, `oauth2.googleapis.com`, `openidconnect.googleapis.com` |
| **Postgres tables** | `oauth_states` (insert/read/delete — PKCE verifier state), `users` (upsert), `refresh_tokens` (insert) |
| **Auth** | Public. No email allowlist check (removed in M5 — `ALLOWLIST_EMAILS` deprecated). |

#### A-04: Register

| Layer | Detail |
|---|---|
| **FE Component** | `Register.tsx` |
| **FE API Client** | `auth.ts → register(username, password, displayName)` |
| **HTTP** | `POST /auth/register` |
| **BE Router** | `app/routers/api_auth.py :: register()` |
| **BE Repo** | `UserRepo`, `RefreshTokenRepo` |
| **Postgres tables** | `users` (insert), `refresh_tokens` (insert) |
| **Auth** | Public. Whitelisted by `setup_guard_middleware` even when `setup_required=true`. Rate-limited 5/min. |

#### A-05: Token refresh (AuthContext)

| Layer | Detail |
|---|---|
| **FE Component** | `AuthContext.tsx :: runRefresh()` — fires on every page load and on 401 intercept |
| **FE API Client** | `auth.ts → refresh()` → `client.ts :: refreshAccessToken()` |
| **HTTP** | `POST /auth/refresh` (no body; relies on `rt` HttpOnly cookie) |
| **BE Router** | `app/routers/api_auth.py :: refresh_token()` |
| **BE Service** | `app/services/auth.py :: rotate()`, `set_refresh_cookie()` |
| **BE Repo** | `RefreshTokenRepo` (rotate old, insert new) |
| **Postgres tables** | `refresh_tokens` (update + insert) |
| **Auth** | Public (cookie-based). Rate-limited 20/min. Token rotation with replay detection (`frontend/src/contexts/AuthContext.test.tsx:338-472`). |

#### A-06: Logout

| Layer | Detail |
|---|---|
| **FE Component** | `Profile.tsx` → `AuthContext.logout()` |
| **FE API Client** | `auth.ts → logout()` |
| **HTTP** | `POST /auth/logout` |
| **BE Router** | `app/routers/api_auth.py :: logout()` (`api_auth.py:287`) |
| **BE Repo** | `RefreshTokenRepo` (revoke current token, best-effort) |
| **Postgres tables** | `refresh_tokens` (update revoked=true) |
| **Auth** | Cookie-based. No JWT validation required. |

#### A-07: Switch active household

| Layer | Detail |
|---|---|
| **FE Component** | `Profile.tsx → AuthContext.switchHousehold()` |
| **FE API Client** | `auth.ts → switchHousehold(householdId)` |
| **HTTP** | `POST /auth/switch-household` |
| **BE Router** | `app/routers/api_auth.py :: switch_household()` (`api_auth.py:366`) |
| **BE Repo** | `HouseholdRepo` (get_member, get_by_id), `UserRepo` (set_active_household) |
| **Postgres tables** | `household_members` (read), `households` (read), `users` (update active_household_id) |
| **Auth** | JWT required. Must be a member of the target household. |
| **Note** | `AuthContext.switchHousehold()` invalidates TQ cache keys for dashboard, brew-log list, catalog, hardware on success (`frontend/src/contexts/AuthContext.tsx:303-334`). |

#### A-08: Get current user (`GET /auth/me`) ← **v2 added to §1**

| Layer | Detail |
|---|---|
| **FE Component** | `AuthContext.tsx :: runRefresh()` (every page load), `HouseholdNew.tsx` (post-create), `InviteAccept.tsx` (post-accept), `HouseholdSettings.tsx` |
| **FE API Client** | `auth.ts → getMe()` |
| **HTTP** | `GET /auth/me` |
| **BE Router** | `app/routers/api_auth.py :: get_me()` (`api_auth.py:306`) |
| **BE Repo** | `HouseholdRepo.get_memberships_with_households_for_user()`, `UserRepo.clear_active_household()` / `set_active_household()` |
| **Postgres tables** | `users`, `household_members`, `households` |
| **Auth** | JWT required. Most-called endpoint in the application. |
| **Note** | Auth state (user identity + memberships) is loaded **exclusively** via this endpoint. `GET /households/me` exists in the BE and FE client (`households.ts:175-176`) but is dead code — no FE page imports `listHouseholds()`. See Gap #9. |

#### A-09: Admin password reset (BE-only surface)

| Layer | Detail |
|---|---|
| **FE Component** | **None** — `Profile.tsx` shows informational copy only (`frontend/src/pages/Profile.tsx:152-154`); no form, no API call |
| **FE API Client** | Not called |
| **HTTP** | `POST /auth/admin/reset-password` |
| **BE Router** | `app/routers/api_auth.py :: admin_reset_password()` (`api_auth.py:387`) |
| **BE Repo** | `UserRepo` (get_by_username, update_password_hash), `HouseholdRepo` (get_member) |
| **Postgres tables** | `users`, `household_members` |
| **Auth** | JWT + admin role in active household. |
| **Gap** | See Gap #1. |

---

### 2.2 Welcome Page (Onboarding Wizard)

> **v2 correction (major — Quinn finding):** v1 described Welcome as "static/informational with CTAs to /register and /login." This was **materially inaccurate**. Welcome is an **onboarding wizard for authenticated users with zero household memberships**. It performs real API calls.

**Route:** `/welcome` (public; no ProtectedRoute wrapper)  
**Page component:** `frontend/src/pages/Welcome.tsx`  
**Renders when:** User is authenticated but `memberships.length === 0`. Unauthenticated users are redirected to `/login` (`Welcome.tsx:78-79`). Users with at least one membership are redirected to `/` (`Welcome.tsx:82-84`).

**Wizard steps (client-side state machine, `WizardStep` type):**

| Step | FE action | API calls |
|---|---|---|
| `'choose'` | Two CTAs: "Create a household" → `setStep('create')`, "Join via invite" → `setStep('invite-instructions')` | None |
| `'create'` | Household name form → on submit: `createHousehold(name)` then `getMe()` → `setUser(userData)` → navigate `/` | `POST /households`, then `GET /auth/me` |
| `'invite-instructions'` | Static copy explaining how to request an invite; "Back" button | None |

**HTTP calls (when `'create'` step is submitted):**

| Layer | Detail |
|---|---|
| **FE API Clients** | `households.ts → createHousehold(name)` (`Welcome.tsx:43`), then `auth.ts → getMe()` (`Welcome.tsx:44`) |
| **HTTP** | `POST /households` → `GET /auth/me` |
| **BE Router** | `api_households.py :: create_household()`, `api_auth.py :: get_me()` |
| **BE Repos** | `HouseholdRepo.create_household()`, `UserRepo.set_active_household()`, then `HouseholdRepo.get_memberships_with_households_for_user()` |
| **Postgres tables** | `households` (insert), `household_members` (insert admin row), `users` (update active_household_id) |
| **Auth** | JWT required. Welcome route is accessible without ProtectedRoute wrapper — auth check is done inline via `useAuth()`. |

---

### 2.3 Dashboard

**Route:** `/` (index, inside AppShell, ProtectedRoute)  
**Page component:** `frontend/src/pages/Dashboard.tsx`

#### D-01/D-02: Load active bags + recent shots

| Layer | Detail |
|---|---|
| **FE Component** | `Dashboard.tsx` |
| **FE API Clients** | `dashboard.ts → getDashboard()`, `brewLog.ts → listBrewLog(1, 5)` (`Dashboard.tsx:26-35`) |
| **TQ Keys** | `dashboardQueryKey(householdId)`, `brewLogListQueryKey(householdId, 1, 5)` |
| **HTTP** | `GET /api/dashboard`, `GET /api/brew-log?page=1&per_page=5` |
| **BE Routers** | `api_dashboard.py :: api_dashboard()` (`api_dashboard.py:25`), `api_brew_log.py :: api_brew_log_list()` (`api_brew_log.py:129`) |
| **BE Repos** | `_DualWriteInventoryRepo`, `_DualWriteBrewLogRepo`, `_DualWriteCatalogRepo`, `_DualWriteHardwareRepo` |
| **Postgres tables** | `inventory_bags`, `brew_log`, `catalog`, `hardware` (all RLS-scoped by `app.current_household_id`) |
| **Auth** | JWT + `current_household_membership` dep. Household-scoped via RLS. |

---

### 2.4 Brew Log List

**Route:** `/brew-log`  
**Page component:** `frontend/src/pages/BrewLogList.tsx`

#### BL-01: Paginated shot list

| Layer | Detail |
|---|---|
| **FE Component** | `BrewLogList.tsx` |
| **FE API Client** | `brewLog.ts → listBrewLog(page, 100)` |
| **TQ Key** | `brewLogListQueryKey(householdId, page, 100)` |
| **HTTP** | `GET /api/brew-log?page=N&per_page=100` |
| **BE Router** | `api_brew_log.py :: api_brew_log_list()` (`api_brew_log.py:129`) |
| **BE Repos** | `_DualWriteBrewLogRepo.list_paginated()`, `_DualWriteInventoryRepo`, `_DualWriteCatalogRepo`, `_DualWriteHardwareRepo` |
| **Postgres tables** | `brew_log`, `inventory_bags`, `catalog`, `hardware` (RLS-scoped) |
| **Auth** | JWT + household membership OR guest token (`resolve_guest_or_member` dep). |

---

### 2.5 Brew Log — Add Shot

**Route:** `/brew-log/add` (query: `?bag_id=...`)  
**Page component:** `frontend/src/pages/BrewLogAdd.tsx`

#### BL-04: Load active inventory

| Layer | Detail |
|---|---|
| **FE API Client** | `inventory.ts → listInventory('Active')` |
| **TQ Key** | `inventoryQueryKey(householdId)` |
| **HTTP** | `GET /api/inventory?status=Active` |
| **BE Router** | `api_inventory.py :: api_inventory_list()` (`api_inventory.py:45`) |
| **BE Repos** | `_DualWriteInventoryRepo`, `_DualWriteCatalogRepo` |
| **Postgres tables** | `inventory_bags`, `catalog` |

#### BL-05: Load hardware

| Layer | Detail |
|---|---|
| **FE API Client** | `hardware.ts → listHardware()` (also prefetched in AuthContext on login) |
| **TQ Key** | `householdKeys.hardware(householdId)` |
| **HTTP** | `GET /api/hardware` |
| **BE Router** | `api_hardware.py :: api_hardware_list()` (`api_hardware.py:101`) |
| **BE Repos** | `_DualWriteHardwareRepo` |
| **Postgres tables** | `hardware` |

#### BL-06: Load defaults for bag+basket

| Layer | Detail |
|---|---|
| **FE API Client** | `defaults.ts → getDefaults(bagId, basketId?)` |
| **TQ Key** | `defaultsQueryKey(bagId, basketId, householdId)` |
| **HTTP** | `GET /api/defaults/{bag_id}[?basket_id=...]` |
| **BE Router** | `api_defaults.py :: api_get_defaults()` (`api_defaults.py:23`) |
| **BE Service** | `app/services/defaults.py :: get_defaults()` |
| **BE Repos** | `_DualWriteBrewLogRepo`, `_DualWriteInventoryRepo`, `_DualWriteCatalogRepo` |
| **Postgres tables** | `brew_log`, `inventory_bags`, `catalog` |
| **Note** | A second `GET /api/defaults` endpoint exists in `app/routers/defaults.py` taking `bag_id` as a query param (legacy). FE uses only the path-param version (`api_defaults.py`). See Gap #10. |

#### BL-07: Submit new shot

| Layer | Detail |
|---|---|
| **FE API Client** | `brewLog.ts → submitShot(payload)` (`BrewLogAdd.tsx:186-217`) |
| **HTTP** | `POST /api/brew-log` |
| **BE Router** | `api_brew_log.py :: api_brew_log_create()` (`api_brew_log.py:381`) |
| **BE Service** | `app/services/inference.py :: get_ai_feedback()` (async, non-fatal, 35 s timeout), `app/services/ids.py :: make_shot_id()`, `app/services/idempotency_store.py :: check_and_set_sentinel()` |
| **BE Repos** | `_DualWriteBrewLogRepo.add()`, `_DualWriteInventoryRepo`, `_DualWriteCatalogRepo`, `_DualWriteHardwareRepo`, `_DualWriteMaintenanceRepo` (AI context) |
| **External** | Gemini 2.5 Flash / Claude Haiku (AI feedback, non-blocking) |
| **Postgres tables** | `brew_log` (insert, RLS-scoped) |
| **Auth** | JWT + `current_household_membership`. Idempotency key (UUID v4 from client). |

---

### 2.6 Brew Log — Detail

**Route:** `/brew-log/:id`  
**Page component:** `frontend/src/pages/BrewLogDetail.tsx`

#### BL-08/BL-09: Load shot + feedback

| Layer | Detail |
|---|---|
| **FE API Clients** | `brewLog.ts → getBrewLogDetail(id)`, `brewLog.ts → getBrewLogFeedback(id)` (`BrewLogDetail.tsx:106-170`) |
| **TQ Keys** | `brewLogDetailQueryKey(id, householdId)`, `brewLogFeedbackQueryKey(id, householdId)` |
| **HTTP** | `GET /api/brew-log/{shot_id}`, `GET /api/brew-log/{shot_id}/feedback` |
| **BE Routers** | `api_brew_log.py :: api_brew_log_detail()` (`api_brew_log.py:166`), `api_brew_log.py :: api_brew_log_feedback()` (`api_brew_log.py:154`) |
| **BE Repos** | `_DualWriteBrewLogRepo.get()`, all lookup repos |
| **Postgres tables** | `brew_log`, `inventory_bags`, `catalog`, `hardware` |

#### BL-10: Generate AI feedback (on-demand)

| Layer | Detail |
|---|---|
| **FE API Client** | `brewLog.ts → generateBrewLogFeedback(id)` |
| **HTTP** | `POST /api/brew-log/{shot_id}/feedback` |
| **BE Router** | `api_brew_log.py :: api_brew_log_feedback_generate()` (`api_brew_log.py:303`) |
| **BE Service** | `app/services/inference.py :: get_ai_feedback()` (forced, 35 s timeout, raises on error) |
| **External** | Gemini 2.5 Flash / Claude Haiku LLM |
| **BE Repos** | `_DualWriteBrewLogRepo`, inventory, catalog, hardware, maintenance repos |
| **Postgres tables** | `brew_log` (read + update `ai_feedback`), `maintenance_log` (AI context) |

#### BL-11: Submit correction

| Layer | Detail |
|---|---|
| **FE API Client** | `brewLog.ts → updateBrewLogEntry(id, payload)` |
| **HTTP** | `PATCH /api/brew-log/{shot_id}` |
| **BE Router** | `api_brew_log.py :: api_brew_log_patch()` (`api_brew_log.py:286`) |
| **BE Repo** | `_DualWriteBrewLogRepo.update_correction()` |
| **Postgres tables** | `brew_log` (update `taste_summary`, `user_notes`, `grind_setting`, `shot_eligibility`) |

#### BL-12: Delete shot (admin only)

| Layer | Detail |
|---|---|
| **FE API Client** | `brewLog.ts → deleteBrewLogEntry(id)` |
| **HTTP** | `DELETE /api/brew-log/{shot_id}` |
| **BE Router** | `api_brew_log.py :: api_brew_log_delete()` (`api_brew_log.py:504`) |
| **BE Repo** | `_DualWriteBrewLogRepo.delete_by_shot_id()` |
| **Postgres tables** | `brew_log` (hard delete by `shot_id`, RLS-scoped) |
| **Auth** | JWT + **admin** role (`require_admin` dep). |

---

### 2.7 Catalog List

**Route:** `/catalog`  
**Page component:** `frontend/src/pages/CatalogList.tsx`

#### C-01: Load catalog list

| Layer | Detail |
|---|---|
| **FE API Client** | `catalog.ts → listCatalog()` (`CatalogList.tsx:64-67`) |
| **TQ Key** | `catalogListQueryKey(householdId)` |
| **HTTP** | `GET /api/catalog` |
| **BE Router** | `api_catalog.py :: api_catalog_list()` (`api_catalog.py:135`) |
| **BE Repo** | `_DualWriteCatalogRepo.list()` |
| **Postgres tables** | `catalog` (RLS-scoped) |

#### C-02/C-03/C-04: Add bean (AddBeanModal)

| Layer | Detail |
|---|---|
| **FE Component** | `AddBeanModal` (opened from `CatalogList.tsx`) (`AddBeanModal.tsx:4,42-47,83-95`) |
| **FE API Clients** | `catalog.ts → inferCatalogItem(url)` (optional), `catalog.ts → createCatalogItem(data)` |
| **HTTP (infer)** | `POST /api/catalog/infer` |
| **HTTP (create)** | `POST /api/catalog` |
| **BE Routers** | `api_catalog.py :: api_catalog_infer()` (`api_catalog.py:349`), `api_catalog.py :: api_catalog_create()` (`api_catalog.py:223`) |
| **BE Service** | `app/services/inference.py :: LLMClient.complete()`, `app/services/image_sourcer.py :: source_bean_image()`, `app/services/image_store.py :: upload_image()` |
| **External** | Gemini/Claude LLM (URL scrape + inference), Google Cloud Storage (`bean-images/{catalog_id}-*.{ext}`) |
| **BE Repo** | `_DualWriteCatalogRepo.upsert()` |
| **Postgres tables** | `catalog` (insert, RLS-scoped) |

---

### 2.8 Catalog Detail

**Route:** `/catalog/:id`  
**Page component:** `frontend/src/pages/CatalogDetail.tsx`

#### C-05: Load catalog detail

| Layer | Detail |
|---|---|
| **FE API Client** | `catalog.ts → getCatalogDetail(id)` (`CatalogDetail.tsx:69-103`) |
| **TQ Key** | `catalogDetailQueryKey(id, householdId)` |
| **HTTP** | `GET /api/catalog/{catalog_id}` |
| **BE Router** | `api_catalog.py :: api_catalog_detail()` (`api_catalog.py:143`) |
| **BE Repos** | `_DualWriteCatalogRepo.get()`, `_DualWriteInventoryRepo.list(status=None)`, `_DualWriteBrewLogRepo.list_for_bag()`, `_DualWriteHardwareRepo.get()` |
| **Postgres tables** | `catalog`, `inventory_bags`, `brew_log`, `hardware` |

#### C-06: Edit catalog item

| Layer | Detail |
|---|---|
| **FE API Client** | `catalog.ts → updateCatalogItem(catalogId, data)` |
| **HTTP** | `PUT /api/catalog/{catalog_id}` |
| **BE Router** | `api_catalog.py :: api_catalog_update()` (`api_catalog.py:298`) |
| **BE Repo** | `_DualWriteCatalogRepo.upsert()` |
| **Postgres tables** | `catalog` (update roaster, bean_name, roast_level, product_url — preserves image) |

#### C-07: Upload/replace catalog image

| Layer | Detail |
|---|---|
| **FE API Client** | `catalog.ts → uploadCatalogImage(catalogId, file)` |
| **HTTP** | `POST /api/catalog/{catalog_id}/image` (multipart/form-data) |
| **BE Router** | `api_catalog.py :: api_catalog_upload_image()` (`api_catalog.py:488`) |
| **BE Service** | `app/services/image_store.py :: upload_image()` |
| **External** | Google Cloud Storage (`bean-images/{catalog_id}-*.{ext}`) |
| **BE Repo** | `_DualWriteCatalogRepo.upsert()` |
| **Postgres tables** | `catalog` (update `local_image_path`) |
| **Constraints** | Max 2 MB; JPEG/PNG/WebP only; magic-byte validation. |

#### C-08: Add new bag to catalog

| Layer | Detail |
|---|---|
| **FE API Client** | `catalog.ts → createInventoryBag(catalogId, data)` |
| **HTTP** | `POST /api/catalog/{catalog_id}/inventory` |
| **BE Router** | `api_catalog.py :: api_catalog_add_bag()` (`api_catalog.py:436`) |
| **BE Service** | `app/services/ids.py :: make_inventory_id()` |
| **BE Repos** | `_DualWriteCatalogRepo.get()`, `_DualWriteInventoryRepo.upsert()` |
| **Postgres tables** | `inventory_bags` (insert, RLS-scoped) |

#### C-09: Mark bag finished / reactivate

| Layer | Detail |
|---|---|
| **FE API Client** | `inventory.ts → updateInventoryBagStatus(id, status)` |
| **HTTP** | `PATCH /api/inventory/{bag_id}` |
| **BE Router** | `api_inventory.py :: api_inventory_patch()` (`api_inventory.py:85`) |
| **BE Repo** | `_DualWriteInventoryRepo.upsert()` |
| **Postgres tables** | `inventory_bags` (update status: `Active`\|`Finished`) |

---

### 2.9 Hardware Page

**Route:** `/hardware`  
**Page component:** `frontend/src/pages/HardwarePage.tsx`

#### HW-01: Load hardware list

| Layer | Detail |
|---|---|
| **FE API Client** | `hardware.ts → listHardware()` |
| **TQ Key** | `householdKeys.hardware(householdId)` |
| **HTTP** | `GET /api/hardware` |
| **BE Router** | `api_hardware.py :: api_hardware_list()` (`api_hardware.py:101`) |
| **BE Repos** | `_DualWriteHardwareRepo` |
| **Postgres tables** | `hardware` |

#### HW-07: Load action types (per category) — timing correction

> **v2 correction (Quinn — minor):** v1 framed HW-01/HW-07 as both loading on page load. Actual: action types are fetched inside `LogMaintenanceModal` when that modal path is used, not at page load.

| Layer | Detail |
|---|---|
| **FE Component** | `LogMaintenanceModal.tsx` (opened from HardwarePage) (`LogMaintenanceModal.tsx:33-40`) |
| **FE API Client** | `hardware.ts → getActionTypes()` |
| **TQ Key** | `householdKeys.actionTypes(householdId)` |
| **HTTP** | `GET /api/hardware/action-types` |
| **BE Router** | `api_hardware.py :: api_hardware_action_types()` (`api_hardware.py:94`) |

#### HW-02: Load hardware detail (with maintenance history)

| Layer | Detail |
|---|---|
| **FE API Client** | `hardware.ts → getHardwareDetail(id)` (`HardwarePage.tsx:172-176`) |
| **TQ Key** | `householdKeys.hardwareDetail(householdId, hardwareId)` |
| **HTTP** | `GET /api/hardware/{hardware_id}` |
| **BE Router** | `api_hardware.py :: api_hardware_detail()` (`api_hardware.py:109`) |
| **BE Repos** | `_DualWriteHardwareRepo.get()`, `_DualWriteMaintenanceRepo.list(hardware_id=...)` |
| **Postgres tables** | `hardware`, `maintenance_log` |

#### HW-03: Add hardware (AddHardwareModal)

| Layer | Detail |
|---|---|
| **FE API Client** | `hardware.ts → createHardware(data)` (`AddHardwareModal.tsx:27-33`) |
| **HTTP** | `POST /api/hardware` |
| **BE Router** | `api_hardware.py :: api_hardware_create()` (`api_hardware.py:136`) |
| **BE Service** | `image_sourcer.py`, `image_store.py` (optional auto-image on `product_url`) |
| **External** | Google Cloud Storage (`hardware-images/{hardware_id}-*.{ext}`) — if `product_url` provided |
| **BE Repos** | `_DualWriteHardwareRepo.upsert()` |
| **Postgres tables** | `hardware` (insert) |
| **⚠️ Architecture note** | `next_id()` delegates to the Sheets hardware repo: `app/deps.py:623-624` — `return self._sheets.next_id(category)`. This is a live read dependency on Google Sheets in the hardware-create write path. See Gap #6. |

#### HW-04: Edit hardware (EditHardwareModal)

| Layer | Detail |
|---|---|
| **FE API Client** | `hardware.ts → updateHardware(id, data)` (`EditHardwareModal.tsx:23-26`) |
| **HTTP** | `PUT /api/hardware/{hardware_id}` |
| **BE Router** | `api_hardware.py :: api_hardware_update()` (`api_hardware.py:195`) |
| **BE Repo** | `_DualWriteHardwareRepo.upsert()` |
| **Postgres tables** | `hardware` (update name, optionally category) |

#### HW-05: Upload hardware image

| Layer | Detail |
|---|---|
| **FE API Client** | `hardware.ts → uploadHardwareImage(id, file)` |
| **HTTP** | `POST /api/hardware/{hardware_id}/image` (multipart/form-data) |
| **BE Router** | `api_hardware.py :: api_hardware_upload_image()` (`api_hardware.py:216`) |
| **BE Service** | `app/services/image_store.py :: upload_image()` |
| **External** | Google Cloud Storage (`hardware-images/{hardware_id}-*.{ext}`) |
| **Postgres tables** | `hardware` (update `local_image_path`) |
| **Constraints** | Max 2 MB; JPEG/PNG/WebP only. |

#### HW-06: Log maintenance event (LogMaintenanceModal)

| Layer | Detail |
|---|---|
| **FE API Client** | `maintenance.ts → createMaintenance(data)` (`LogMaintenanceModal.tsx:41-48`) |
| **HTTP** | `POST /api/maintenance` |
| **BE Router** | `api_maintenance.py :: api_maintenance_create()` (`api_maintenance.py:73`) |
| **BE Service** | `app/services/ids.py :: make_maintenance_id()` |
| **BE Repos** | `_DualWriteHardwareRepo.get()`, `_DualWriteMaintenanceRepo.add()` |
| **Postgres tables** | `hardware` (validate + read), `maintenance_log` (insert, RLS-scoped) |
| **Note** | Action type validated per category: Machine=[Backflush, Descale, Steam Wand Clean]; Grinder=[Re-zero]; Basket/Storage=none allowed. |

---

### 2.10 Profile Page

**Route:** `/profile`  
**Page component:** `frontend/src/pages/Profile.tsx`

#### P-01: Load user + memberships

Uses `AuthContext` state (populated from `GET /auth/me` on app load). No additional API call on Profile mount. Auth state loaded exclusively via A-08.

#### P-02: Switch active household

| Layer | Detail |
|---|---|
| **FE Component** | `Profile.tsx → AuthContext.switchHousehold()` (`Profile.tsx:95-103`) |
| **FE API Client** | `auth.ts → switchHousehold(householdId)` |
| **HTTP** | `POST /auth/switch-household` |
| **BE Router** | `api_auth.py :: switch_household()` |
| **Postgres tables** | `household_members`, `households`, `users` |

#### P-03/P-04: Navigation CTAs

- "Manage" → `/household/settings` (Link, visible to admin only via `can_manage` flag)
- "Create household" → `/household/new` (Link)

#### P-05: Sign out

| Layer | Detail |
|---|---|
| **FE Component** | `Profile.tsx → logout button → AuthContext.logout()` (`Profile.tsx:184-186`) |
| **FE API Client** | `auth.ts → logout()` |
| **HTTP** | `POST /auth/logout` |
| **BE Router** | `api_auth.py :: logout()` (`api_auth.py:287`) |
| **Postgres tables** | `refresh_tokens` (revoke) |

---

### 2.11 Household Settings (Admin)

**Route:** `/household/settings` (ProtectedRoute `requiredRole="admin"`, `router.tsx:61-65`)  
**Page component:** `frontend/src/pages/HouseholdSettings.tsx`

#### HH-02: Load household detail

| Layer | Detail |
|---|---|
| **FE API Client** | `households.ts → getHousehold(householdId)` (`HouseholdSettings.tsx:87`) |
| **TQ Key** | `householdKeys.settings(householdId)` |
| **HTTP** | `GET /households/{household_id}` |
| **BE Router** | `api_households.py :: get_household()` (`api_households.py:581`) |
| **BE Repos** | `HouseholdRepo` (get_by_id, get_members, count_members, get_active_guest_token, get_invitations_for_household), `UserRepo` (get_by_id per member) |
| **Postgres tables** | `households`, `household_members`, `users`, `guest_tokens`, `pending_invitations` |
| **Auth** | JWT + member. Admin sees full detail (invitations, guest_access); members see truncated view. |

#### HH-03: Rename household

| Layer | Detail |
|---|---|
| **FE API Client** | `households.ts → renameHousehold(householdId, name)` |
| **HTTP** | `PATCH /households/{household_id}` |
| **BE Router** | `api_households.py :: rename_household()` (`api_households.py:689`) |
| **BE Repo** | `HouseholdRepo.rename()` |
| **Postgres tables** | `households` (update name) |
| **Auth** | Admin required. |

#### HH-04: Update member role

| Layer | Detail |
|---|---|
| **FE API Client** | `households.ts → updateMemberRole(userId, role)` |
| **HTTP** | `PATCH /households/members/{user_id}` |
| **BE Router** | `api_households.py :: update_member_role()` (`api_households.py:525`) |
| **BE Repo** | `HouseholdRepo.update_member_role()` |
| **Postgres tables** | `household_members` (update role) |
| **Auth** | Admin required. Cannot demote self if last admin. |

#### HH-05: Remove member

| Layer | Detail |
|---|---|
| **FE API Client** | `households.ts → removeMember(userId)` |
| **HTTP** | `DELETE /households/members/{user_id}` |
| **BE Router** | `api_households.py :: remove_member()` (`api_households.py:508`) |
| **BE Repo** | `HouseholdRepo.remove_member()`, `HouseholdRepo.repair_active_households_for_users()` |
| **Postgres tables** | `household_members` (delete), `users` (repair `active_household_id`) |
| **Auth** | Admin required. Cannot remove self. |

#### HH-06: Create invitation

| Layer | Detail |
|---|---|
| **FE API Client** | `households.ts → createInvitation(payload)` |
| **HTTP** | `POST /households/invitations` |
| **BE Router** | `api_households.py :: create_invite()` (`api_households.py:342`) |
| **BE Service** | `app/core/link_tokens.py :: encrypt_display_token()` |
| **BE Repo** | `HouseholdRepo.create_invitation()` |
| **Postgres tables** | `pending_invitations` (insert) |
| **Auth** | Admin required. Invite URL uses HMAC-encrypted display token. |

#### HH-07/HH-08/HH-09: Copy / Revoke / Resend invitation

| Layer | Detail |
|---|---|
| **FE API Clients** | Navigator `clipboard` API (copy), `households.ts → revokeInvitation(id)`, `households.ts → resendInvitation(id)` |
| **HTTP** | `DELETE /households/invitations/{invitation_id}` (revoke), `POST /households/invitations/{invitation_id}/resend` |
| **BE Routers** | `api_households.py :: revoke_invitation()` (`api_households.py:463`), `api_households.py :: resend_invitation()` (`api_households.py:478`) |
| **BE Repos** | `HouseholdRepo.revoke_invitation()`, `HouseholdRepo.resend_invitation()` |
| **Postgres tables** | `pending_invitations` (update status / rotate token) |
| **Auth** | Admin required. |

#### HH-10/HH-11/HH-12: Guest access — generate / copy / revoke

| Layer | Detail |
|---|---|
| **FE API Clients** | `households.ts → generateGuestToken(householdId)`, Navigator clipboard (copy), `households.ts → revokeGuestToken(householdId)` |
| **HTTP** | `POST /households/{household_id}/guest-token`, `DELETE /households/{household_id}/guest-token` |
| **BE Routers** | `api_households.py :: generate_guest_token()` (`api_households.py:541`), `api_households.py :: revoke_guest_token()` (`api_households.py:568`) |
| **BE Repo** | `HouseholdRepo.revoke_previous_guest_tokens()`, `.create_guest_token()`, `.revoke_guest_tokens()` |
| **Postgres tables** | `guest_tokens` (insert / update `revoked_at`) |
| **Auth** | Admin required. Guest URL: `/households/{id}/view?key={raw_token}`. |

#### HH-13: Delete household

| Layer | Detail |
|---|---|
| **FE API Client** | `households.ts → deleteHousehold(householdId, confirmName)` |
| **HTTP** | `DELETE /households/{household_id}` (body: `{confirm_name}`) |
| **BE Router** | `api_households.py :: delete_household()` (`api_households.py:708`) |
| **BE Repo** | `HouseholdRepo.hard_delete()` |
| **Postgres tables** | `households` + cascade (`household_members`, `pending_invitations`, `guest_tokens`, RLS-scoped domain tables) |
| **Auth** | Admin required. Name confirmation required. |

---

### 2.12 Household — Create New

**Route:** `/household/new` (ProtectedRoute, no role constraint)  
**Page component:** `frontend/src/pages/HouseholdNew.tsx`

| Layer | Detail |
|---|---|
| **FE API Clients** | `households.ts → createHousehold(name)`, then `auth.ts → getMe()` to refresh memberships |
| **HTTP** | `POST /households`, then `GET /auth/me` |
| **BE Router** | `api_households.py :: create_household()` (`api_households.py:318`) |
| **BE Repos** | `HouseholdRepo.create_household()`, `UserRepo.set_active_household()` |
| **Postgres tables** | `households` (insert), `household_members` (insert admin row), `users` (update `active_household_id`) |
| **Auth** | JWT required. New household creator is automatically `admin`. |

---

### 2.13 Import Wizard (Admin)

**Route:** `/import` (ProtectedRoute `requiredRole="admin"`, `router.tsx:61-65`)  
**Page component:** `frontend/src/pages/ImportWizard.tsx`

The FE wizard is a 3-step purely client-side flow (Upload CSV → Preview → Commit):

| Step | FE Action | HTTP | Detail |
|---|---|---|---|
| **Step 1** | Parse CSV client-side; validate rows; render preview | None | All parsing in browser |
| **Step 2** | Preview with error highlighting | None | Client-side |
| **Step 3 — catalog rows** | `catalog.ts → createCatalogItem(data)` per row (`ImportWizard.tsx:181-196`) | `POST /api/catalog` | Same as normal catalog creation |
| **Step 3 — brew-log rows** | `brewLog.ts → submitShot(data)` per row | `POST /api/brew-log` | Same as normal shot creation |

**Auth:** Admin required — enforced both FE (`router.tsx:61-64`: `<ProtectedRoute requiredRole="admin">`) and BE (`import_wizard.py:33`: `APIRouter(dependencies=[Depends(require_admin)])`). Consistent. Gap #7 in v1 was **refuted** — no inconsistency.

> **Gap #2 still open:** `app/routers/import_wizard.py` implements a DB-backed import session (`GET /import`, `ImportSession` table, state helpers `_load_state()` / `_save_state()`). This infrastructure is **never invoked from FE**. The `CANONICAL_ENUM_VALUES` normalization pipeline in `app/services/importer.py` is unreachable from the FE. See Gap #2.

---

### 2.14 Invite Accept Flow

**Route:** `/invite/accept?token=...`  
**Page component:** `frontend/src/pages/InviteAccept.tsx`

| Action | FE API Client | HTTP | BE Router | BE Repo | Postgres |
|---|---|---|---|---|---|
| Load preview | `invitations.ts → getInvitationPreview(token)` (`InviteAccept.tsx:44-67`) | `GET /households/invitations/{token}` | `api_households.py :: preview_invitation()` (`api_households.py:372`) | `HouseholdRepo.get_invitation_by_token_hash()` | `pending_invitations`, `households`, `users` |
| Accept | `invitations.ts → acceptInvitation(token)` (`InviteAccept.tsx:69-113`) | `POST /households/invitations/{token}/accept` | `api_households.py :: accept_invite()` (`api_households.py:397`) | `HouseholdRepo.add_member()`, `.accept_invitation()` | `household_members` (insert), `pending_invitations` (update status), `users` (update `active_household_id`) |
| Decline | `invitations.ts → declineInvitation(token)` | `POST /households/invitations/{token}/decline` | `api_households.py :: decline_invitation()` (`api_households.py:449-460`) | `HouseholdRepo.get_invitation_by_token_hash()` (read only) | `pending_invitations` (read; **no DB write**) |

**Auth flow:** Unauthenticated users are redirected to `/login?invite={token}&from=/invite/accept`. After login, user returns to `/invite/accept` with token intact.

> **Gap #3 — Decline behavior (see §4):** The decline endpoint returns `204` without mutating DB state. `HouseholdRepo.decline_invitation()` in `app/repos/sql/household.py:456-457` is an explicit no-op: *"No-op retained for compatibility; v2 decline does not consume invitations."* This is **intentional by design** (confirmed by tests `tests/test_households.py:1030-1052`). However, it carries a product/security side effect: a declined invitation remains `status="pending"` and can still be accepted by any holder of the link. This is a **product decision to confirm**, not a code defect.

---

### 2.15 Invite Invalid / Expired Screens

**Routes:** `/invite/invalid`, `/invite/expired`  
**Page components:** `frontend/src/pages/InviteInvalid.tsx`, `frontend/src/pages/InviteExpired.tsx`  
**API calls:** None — static informational screens. Navigation only.  
**Test coverage:** No dedicated page test files found for either screen (see §4.1).

---

### 2.16 Guest View

**Route:** `/households/:householdId/view?key=...`  
**Page component:** `frontend/src/pages/HouseholdGuestView.tsx`

| Layer | Detail |
|---|---|
| **FE API Client** | `guest.ts → getGuestHouseholdView(householdId, key)` (`HouseholdGuestView.tsx:4,51-55`) |
| **HTTP** | `GET /api/guest/households/{household_id}/view?key={raw_token}` |
| **BE Router** | `api_guest.py :: guest_household_view()` (`api_guest.py:146`) |
| **BE Repos** | `HouseholdRepo.get_guest_token_by_hash_include_expired()`, then `_DualWriteInventoryRepo`, `_DualWriteCatalogRepo`, `_DualWriteHardwareRepo`, `_DualWriteBrewLogRepo` |
| **Postgres tables** | `guest_tokens`, `households`, `inventory_bags`, `catalog`, `hardware`, `brew_log` (all RLS-scoped via `set_config`) |
| **Auth** | No JWT required. Guest raw token in `?key=` query param; validated via hash lookup. Returns `capabilities.can_write=false`. |
| **Response** | Single aggregated payload: `{household, banner, dashboard: {active_bags, recent_shots, stats}, brew_log: {entries[25]}, catalog: {beans}, capabilities}` |
| **Note** | `GET /api/brew-log` is also accessible to guests via `resolve_guest_or_member` dep (`api_brew_log.py:129-132`), but the guest FE does not use it — it uses this aggregate endpoint instead. See Gap #8. |

---

### 2.17 NotFound — 404 Catch-All ← **v2 added**

**Route:** `*` (catch-all inside AppShell, `router.tsx:67`)  
**Page component:** `frontend/src/pages/NotFound.tsx`  
**API calls:** None — static 404 screen.  
**Auth:** ProtectedRoute (inside AppShell) — authenticated users only.  
**Note:** No dedicated test file found.

---

## 3. Resource Catalogs

### 3a. BE Endpoints

Organized by router. `*` = behind a household-scoped auth dep. **Total: 62 registered endpoints** (excluding E2E and SPA catch-all). v1 stated 52; this was understated by 10.

> **v2 addition:** Three previously undocumented endpoints added: `GET /auth/logout` (legacy redirect), `GET /auth/login` (legacy redirect), `GET /api/defaults` (query-param legacy variant). All three are server-registered but not called from FE.

| Method | Path | Router File | Auth Dep | Notes |
|---|---|---|---|---|
| **Health / Infra** | | | | |
| GET | `/livez` | `health.py` | None | Liveness probe |
| GET | `/readyz` | `health.py` | None | Readiness probe |
| GET | `/health` | `health.py` | None | Cloud Run startup probe |
| GET | `/manifest.webmanifest` | `main.py` | None | PWA manifest |
| GET | `/sw.js` | `main.py` | None | Service worker |
| **Auth (Google OAuth)** | | | | |
| GET | `/auth/google` | `app/auth.py:65` | None | Initiate PKCE OAuth flow |
| GET | `/auth/callback` | `app/auth.py:99` | None | OAuth callback alias |
| GET | `/auth/google/callback` | `app/auth.py:100` | None | OAuth callback (canonical) |
| **Auth (legacy redirects — not called from FE)** | | | | |
| GET | `/auth/logout` | `app/auth.py:212` | None | 302 → `/auth/login` (session-less; legacy) |
| GET | `/auth/login` | `app/auth.py:223` | None | 302 → `/auth/google` (legacy bookmark redirect) |
| **Auth (JSON API)** | | | | |
| POST | `/auth/register` | `api_auth.py:145` | None (rate-limited 5/min) | Create account |
| POST | `/auth/login` | `api_auth.py:192` | None (rate-limited 10/min) | Username/password login |
| POST | `/auth/refresh` | `api_auth.py:234` | HttpOnly cookie (rate-limited 20/min) | Rotate refresh token |
| POST | `/auth/logout` | `api_auth.py:287` | Cookie (best-effort) | Revoke RT + clear cookie |
| GET | `/auth/me` | `api_auth.py:306` | JWT | Current user + memberships |
| POST | `/auth/switch-household` | `api_auth.py:366` | JWT + household member | Switch active household |
| POST | `/auth/admin/reset-password` | `api_auth.py:387` | JWT + admin | Admin resets member password |
| **Households** | | | | |
| POST | `/households` | `api_households.py:318` | JWT | Create household |
| GET | `/households/me` | `api_households.py:334` | JWT | List user's memberships (**dead FE code** — see Gap #9) |
| POST | `/households/invitations` | `api_households.py:342` | JWT + admin | Create invite |
| GET | `/households/invitations/{token}` | `api_households.py:372` | None | Preview invite (token-based) |
| POST | `/households/invitations/{token}/accept` | `api_households.py:397` | JWT | Accept invite |
| POST | `/households/invitations/{token}/decline` | `api_households.py:449` | None | Decline invite (no-op BE — by design) |
| DELETE | `/households/invitations/{invitation_id}` | `api_households.py:463` | JWT + admin | Revoke invite |
| POST | `/households/invitations/{invitation_id}/resend` | `api_households.py:478` | JWT + admin | Resend invite |
| DELETE | `/households/members/{user_id}` | `api_households.py:508` | JWT + admin | Remove member |
| PATCH | `/households/members/{user_id}` | `api_households.py:525` | JWT + admin | Update member role |
| POST | `/households/{household_id}/guest-token` | `api_households.py:541` | JWT + admin | Generate guest link |
| DELETE | `/households/{household_id}/guest-token` | `api_households.py:568` | JWT + admin | Revoke guest link |
| GET | `/households/{household_id}` | `api_households.py:581` | JWT + member | Household detail |
| PATCH | `/households/{household_id}` | `api_households.py:689` | JWT + admin | Rename household |
| DELETE | `/households/{household_id}` | `api_households.py:708` | JWT + admin | Delete household |
| **Guest** | | | | |
| GET | `/api/guest/households/{household_id}/view` | `api_guest.py:146` | Guest token (`?key=`) | Public guest read-only aggregate view |
| **Dashboard** | | | | |
| GET | `/api/dashboard` | `api_dashboard.py:25` | JWT + member\* | Active bags summary |
| **Catalog** | | | | |
| GET | `/api/catalog` | `api_catalog.py:135` | JWT + member\* | List catalog items |
| GET | `/api/catalog/{catalog_id}` | `api_catalog.py:143` | JWT + member\* | Catalog detail + bags + shots |
| POST | `/api/catalog` | `api_catalog.py:223` | JWT + member\* | Create catalog item |
| PUT | `/api/catalog/{catalog_id}` | `api_catalog.py:298` | JWT + member\* | Update catalog item |
| POST | `/api/catalog/infer` | `api_catalog.py:349` | JWT + member\* | LLM infer from product URL |
| POST | `/api/catalog/{catalog_id}/inventory` | `api_catalog.py:436` | JWT + member\* | Add bag to catalog |
| POST | `/api/catalog/{catalog_id}/image` | `api_catalog.py:488` | JWT + member\* | Upload catalog image |
| **Hardware** | | | | |
| GET | `/api/hardware/action-types` | `api_hardware.py:94` | JWT + member\* | Action types by category |
| GET | `/api/hardware` | `api_hardware.py:101` | JWT + member\* | List hardware |
| GET | `/api/hardware/{hardware_id}` | `api_hardware.py:109` | JWT + member\* | Hardware detail + maintenance |
| POST | `/api/hardware` | `api_hardware.py:136` | JWT + member\* | Create hardware item |
| PUT | `/api/hardware/{hardware_id}` | `api_hardware.py:195` | JWT + member\* | Update hardware |
| POST | `/api/hardware/{hardware_id}/image` | `api_hardware.py:216` | JWT + member\* | Upload hardware image |
| **Brew Log** | | | | |
| GET | `/api/brew-log` | `api_brew_log.py:129` | JWT+member or guest token\* | Paginated list |
| GET | `/api/brew-log/{shot_id}/feedback` | `api_brew_log.py:154` | JWT + member\* | Get stored AI feedback |
| GET | `/api/brew-log/{shot_id}` | `api_brew_log.py:166` | JWT + member\* | Shot detail |
| PATCH | `/api/brew-log/{shot_id}` | `api_brew_log.py:286` | JWT + member\* | Correct shot fields |
| POST | `/api/brew-log/{shot_id}/feedback` | `api_brew_log.py:303` | JWT + member\* | Regenerate AI feedback |
| POST | `/api/brew-log` | `api_brew_log.py:381` | JWT + member\* | Create shot (+ async AI feedback) |
| DELETE | `/api/brew-log/{shot_id}` | `api_brew_log.py:504` | JWT + **admin**\* | Delete shot |
| **Inventory** | | | | |
| GET | `/api/inventory` | `api_inventory.py:45` | JWT + member\* | List bags (status filter) |
| GET | `/api/inventory/{bag_id}` | `api_inventory.py:65` | JWT + member\* | Bag detail (**FE client exists, no page consumer** — see Gap #4) |
| PATCH | `/api/inventory/{bag_id}` | `api_inventory.py:85` | JWT + member\* | Update bag status |
| **Maintenance** | | | | |
| GET | `/api/maintenance` | `api_maintenance.py:42` | JWT + member\* | List maintenance events (**global list, no FE page consumer** — see Gap #5) |
| POST | `/api/maintenance` | `api_maintenance.py:73` | JWT + member\* | Log maintenance event |
| **Defaults** | | | | |
| GET | `/api/defaults/{bag_id}` | `api_defaults.py:23` | JWT + member\* | Smart pre-fill defaults (path-param; used by FE) |
| GET | `/api/defaults` | `defaults.py:24` | JWT + member\* | Smart pre-fill defaults (query-param **legacy**; dead from FE — see Gap #10) |
| **Import** | | | | |
| GET | `/import` | `import_wizard.py:190` | JWT + **admin** | Start import wizard session (**BE infra unused by FE** — see Gap #2) |
| **E2E (test-only, never production)** | | | | |
| `*` various | `/api/e2e/*` | `api_e2e.py` | E2E bypass only | Seed/cleanup; mounted only when `E2E_AUTH_BYPASS=1` |
| GET | `/{full_path:path}` | `main.py:340` | None | SPA catch-all; serves `static/spa/index.html` |

---

### 3b. Repos and Datastores

**Datastore-of-record (verified by Maya):** Postgres is authoritative for all writes when `USE_POSTGRES=true` (M5 production). Google Sheets is archive/read-fallback only — with **one exception** noted below.

| Repo Class | Sheets Impl | SQL Impl | Datastore (M5 production) | Notes |
|---|---|---|---|---|
| `CatalogRepo` | `app/repos/catalog.py` | `app/repos/sql/catalog.py :: SqlCatalogRepo` | **Postgres** (`catalog`, RLS) | Sheets = archive/fallback only |
| `InventoryRepo` | `app/repos/inventory.py` | `app/repos/sql/inventory.py :: SqlInventoryRepo` | **Postgres** (`inventory_bags`, RLS) | Sheets = archive/fallback only |
| `BrewLogRepo` | `app/repos/brew_log.py` | `app/repos/sql/brew_log.py :: SqlBrewLogRepo` | **Postgres** (`brew_log`, RLS) | Sheets = archive/fallback only. `list_existing_ids()` queries Postgres `brew_log.sheets_id` column for ID generation — no Sheets read. |
| `HardwareRepo` | `app/repos/hardware.py` | `app/repos/sql/hardware.py :: SqlHardwareRepo` | **Postgres** (`hardware`, RLS) | **⚠️ EXCEPTION: `next_id()` still reads Sheets** (`app/deps.py:623-624` — `return self._sheets.next_id(category)`). Every `POST /api/hardware` is a live Sheets read regardless of `use_postgres` flag. See Gap #6. |
| `MaintenanceRepo` | `app/repos/maintenance.py` | `app/repos/sql/maintenance.py :: SqlMaintenanceRepo` | **Postgres** (`maintenance_log`, RLS) | Sheets = archive/fallback only |
| `HouseholdRepo` | — | `app/repos/sql/household.py :: HouseholdRepo` | **Postgres only** | No Sheets counterpart |
| `UserRepo` | — | `app/repos/sql/user.py :: UserRepo` | **Postgres only** | No Sheets counterpart |
| `RefreshTokenRepo` | — | `app/repos/sql/refresh_tokens.py :: RefreshTokenRepo` | **Postgres only** | No Sheets counterpart |
| `TenantRepo` | — | `app/repos/sql/tenant.py` | **Postgres only** | Tenant/RLS helper |

**Dual-write wrapper classes** in `app/deps.py`:
- `_DualWriteCatalogRepo`, `_DualWriteBrewLogRepo`, `_DualWriteInventoryRepo`, `_DualWriteHardwareRepo`, `_DualWriteMaintenanceRepo`
- In M5: `use_postgres=True` → SQL is authoritative; Sheets is archive-only write. `use_postgres=False` → falls back to Sheets reads (write path disabled).

---

### 3c. External Resources

| External Resource | What uses it | Direction | Notes |
|---|---|---|---|
| **Postgres (Cloud SQL)** | All domain repos and auth repos | R/W | RLS via `app.current_household_id` session config. Tables: `brew_log`, `catalog`, `inventory_bags`, `hardware`, `maintenance_log`, `users`, `households`, `household_members`, `pending_invitations`, `guest_tokens`, `refresh_tokens`, `oauth_states`, `import_sessions`. Asyncpg driver. |
| **Google Sheets (gspread)** | `BrewLogRepo`, `CatalogRepo`, `InventoryRepo`, `HardwareRepo`, `MaintenanceRepo` (via `RealSheetsClient`) | **Read-only in M5** (archive fallback) — except `HardwareRepo.next_id()` which is a **live read on every hardware create** (`app/deps.py:623-624`) | Tabs: Brew_Log, Catalog, Hardware, Inventory, Maintenance_Log |
| **Google Cloud Storage** | `app/services/image_store.py :: upload_image()` | Write (public-read bucket) | Catalog: `bean-images/{id}-*.{ext}`; Hardware: `hardware-images/{id}-*.{ext}` |
| **Google OAuth 2.0** | `app/auth.py` (PKCE flow) | Outbound | Scopes: openid email profile. Endpoints: `accounts.google.com`, `oauth2.googleapis.com`, `openidconnect.googleapis.com`. Email allowlist (`ALLOWLIST_EMAILS`) deprecated in M5. |
| **Gemini 2.5 Flash (default LLM)** | `app/services/inference.py :: LLMClient` | Outbound | Used by: brew-log create (auto feedback), brew-log detail (on-demand feedback), catalog infer, hardware image sourcing (`image_sourcer.py`) |
| **Anthropic Claude Haiku (alt LLM)** | `app/services/inference.py` (adapter) | Outbound | Alternate to Gemini; same interface |
| **IdempotencyStore** | `app/services/idempotency_store.py` | R/W | Used by: `POST /api/brew-log`. When `use_postgres=True`: idempotency key+hash stored in `brew_log` table. When `use_postgres=False`: in-memory sentinel store (or Sheets-backed path). |

---

## 4. Candidate Gaps

> **v2 reclassifications:** Gap #7 from v1 is **refuted** (not a gap). Gap #3 is **reclassified** from "unconfirmed code defect" to "intentional behavior with product/security side-effect to confirm." All other gaps confirmed by at least two independent reviewers.

---

### Gap #1 — `POST /auth/admin/reset-password` has no FE surface ✅ CONFIRMED

**Status:** Confirmed (all 3 verifiers)  
**Severity:** Medium

`Profile.tsx` renders a "Password reset" section with static copy (`COPY.profile.passwordResetTitle/Body`) at `frontend/src/pages/Profile.tsx:152-154`. No form element, no auth.ts import, no API call. The backend `POST /auth/admin/reset-password` (`api_auth.py:387`) is fully implemented, enforces `require_admin`, and is covered by tests (`tests/test_auth_wave4.py:809-870`). Admins have no UI path to reset member passwords.

**Impact:** Admins cannot reset member passwords via the UI even though the backend supports it.

---

### Gap #2 — `GET /import` BE session infrastructure unused by FE ✅ CONFIRMED

**Status:** Confirmed (all 3 verifiers)  
**Severity:** High

`frontend/src/pages/ImportWizard.tsx` imports only `createCatalogItem` (from `catalog.ts`) and `submitShot` (from `brewLog.ts`) (`ImportWizard.tsx:181-196`). It does **not** call `GET /import`, does not manage an `import_session_id` cookie, and never invokes `_load_state()` / `_save_state()`. The `CANONICAL_ENUM_VALUES` normalization pipeline in `app/services/importer.py` and the `import_sessions` Postgres table are never reached from the FE. The BE unit tests that cover this path (`tests/test_import_wizard.py:30-53`) exercise only the BE in isolation.

**Impact:** The import wizard's multi-step BE state management and richer column-mapping normalization are never invoked. The FE import does basic CSV parse + direct POST, bypassing BE normalization.

---

### Gap #3 — `POST /households/invitations/{token}/decline` does not persist state ⚠️ RECLASSIFIED: Intentional by design

**Status:** Intentional behavior — product/security decision to confirm  
**Severity:** Info (code); Medium (product/security risk)

**Evidence:** `api_households.py:449-460` — the handler retrieves and validates the invitation, then returns `Response(status_code=204)` with no DB write. `HouseholdRepo.decline_invitation()` in `app/repos/sql/household.py:456-457` is an explicit no-op: *"No-op retained for compatibility; v2 decline does not consume invitations."* Tests in `tests/test_households.py:1030-1052` and `tests/test_spec040_household_contracts.py:222-247` explicitly assert this non-consuming behavior.

**v2 reclassification:** This is **not a code defect**. It is a deliberate design decision. The FE sets client-local declined state (`InviteAccept.tsx:96-103`) without expecting a DB change.

**Side-effect to confirm:** A declined invitation remains `status="pending"` in the `pending_invitations` table. It is still valid and can be accepted by the same user or any holder of the link. The schema supports a `"declined"` status (referenced at `api_households.py:446`) but it is never written. **This is a product and security decision** that should be explicitly confirmed or resolved: is invite-link reusability after user decline intentional?

---

### Gap #4 — `GET /api/inventory/{bag_id}` detail endpoint has no FE page consumer ✅ CONFIRMED

**Status:** Confirmed (all 3 verifiers)  
**Severity:** Low (dead FE code; BE endpoint correct and tested)

`frontend/src/api/inventory.ts:9` exports `getInventoryBag(id)`. No FE page component imports or calls `getInventoryBag`. Bag detail is always loaded as part of catalog detail or the inventory list. The BE endpoint is implemented and tested (`tests/test_api.py:503-513`).

**Impact:** Dead code in the FE API client. Cleanup candidate.

---

### Gap #5 — `GET /api/maintenance` (global list) has no FE page consumer ✅ CONFIRMED

**Status:** Confirmed (all 3 verifiers)  
**Severity:** Low (dead FE code)

`frontend/src/api/maintenance.ts:4` exports `listMaintenance(hardwareId?)`. No FE page imports it (`listMaintenance(` search returns 0 matches in `frontend/src/`). Maintenance data reaches the FE bundled inside the hardware detail response (`GET /api/hardware/{hardware_id}` → `HardwareDetailOut`). The BE endpoint is tested (`tests/test_api.py:555-563`).

**Impact:** The unfiltered maintenance list endpoint is documented and functional but has no FE consumer. Cleanup candidate.

---

### Gap #6 — `HardwareRepo.next_id()` still reads Google Sheets for ID generation in M5 ✅ CONFIRMED

**Status:** Confirmed (all 3 verifiers)  
**Severity:** High (live external coupling on hardware write path)

`app/deps.py:623-624` — `_DualWriteHardwareRepo.next_id()` delegates unconditionally to `self._sheets.next_id(category)`. Every `POST /api/hardware` call (`api_hardware.py:152-153`) reads the Sheets hardware tab to derive the next ID, regardless of `use_postgres` flag. Other repos (`BrewLogRepo`, `InventoryRepo`, `MaintenanceRepo`) generate IDs from existing Postgres ID lists and do not have this dependency.

**Impact:** Hardware creation will fail or produce ID collisions if the Google Sheets tab is unavailable or desynchronized from Postgres. This is the only remaining live Sheets read dependency in the M5 write path.

---

### Gap #7 — Import Wizard admin guard: **REFUTED — NOT A GAP** ~~(v1 unconfirmed)~~

**Status:** ✅ Refuted by Quinn and Maya. Consistent, no gap.

**Evidence:**
- FE: `frontend/src/router.tsx:61-64` — `/import` is inside `<ProtectedRoute requiredRole="admin">`.
- BE: `app/routers/import_wizard.py:33` — `router = APIRouter(dependencies=[Depends(require_admin)])`.

Both layers enforce admin-only access. No inconsistency exists.

---

### Gap #8 — `GET /api/brew-log` is guest-accessible but not used by the FE guest surface ✅ CONFIRMED

**Status:** Confirmed (all 3 verifiers)  
**Severity:** Info (by design; no user-visible impact)

`api_brew_log.py:129-132` uses the `resolve_guest_or_member` dep, meaning guests with a valid token can call `GET /api/brew-log` directly. However, `HouseholdGuestView.tsx` uses `getGuestHouseholdView()` → `GET /api/guest/households/{id}/view` instead. The direct brew-log list path is accessible to guests but no FE guest surface uses it.

**Impact:** No behavioral gap. The guest FE prefers the aggregate endpoint which provides a richer response. The direct brew-log endpoint being guest-accessible is tested (`tests/test_households.py:786-885`) and intentional for future flexibility.

---

### Gap #9 — `GET /households/me` and `listHouseholds()` are dead FE client code ← **v2 added (Tariq)**

**Status:** Confirmed  
**Severity:** Medium (understanding this matters for any household-picker feature)

`frontend/src/api/households.ts:175-176` — `listHouseholds()` calls `GET /households/me`. No FE page imports `listHouseholds` (0 matches in `frontend/src/`). All membership data is loaded exclusively via `GET /auth/me` (A-08). The BE endpoint is functional and tested.

**Impact:** Any future feature requiring a standalone household list (e.g., a household picker, multi-household overview) will need to wire up `listHouseholds()` or equivalent — the FE client wrapper exists but is currently unused.

---

### Gap #10 — `GET /api/defaults` (query-param variant) is a dead legacy route ← **v2 added (Tariq)**

**Status:** Confirmed  
**Severity:** Low (dead from FE; potential confusion)

`app/routers/defaults.py:24` — `@router.get("/api/defaults")` takes `bag_id` as a query parameter. Registered in `app/main.py:328` via `app.include_router(defaults_router.router)`. The FE (`frontend/src/api/defaults.ts:5-8`) uses only the path-param version (`GET /api/defaults/{bag_id}` from `api_defaults.py`). Both routes resolve to paths starting with `/api/defaults`.

**Impact:** Two routes registered at `/api/defaults*` with different parameter styles. The query-param version is dead from FE and is a cleanup candidate. A future change to the legacy route could silently interfere with the path-param route.

---

## 4.1 Test Coverage Signal

Noted by Quinn during behavioral verification. These mapped surfaces or paths have **weak or no meaningful test coverage**:

1. **INV-05** `/invite/invalid` — no dedicated page test file found (`InviteInvalid.tsx` covered by route wiring only)
2. **INV-06** `/invite/expired` — no dedicated page test file found
3. **HH-01** `/household/new` page logic — route guard tested, but page form behavior not directly tested
4. **IMP-05** `GET /import` session bootstrap — only BE unit tests (`tests/test_import_wizard.py:30-53`); FE never exercises this path
5. **BL-guest direct list** — `GET /api/brew-log?guest=...` has BE tests but no FE consumer path exercised in FE tests
6. **Inventory detail FE path** — `getInventoryBag` unexercised in FE tests (no consumer)
7. **Maintenance global list FE path** — `listMaintenance()` (no `hardware_id`) unexercised in FE tests (no consumer)

**Well-covered paths** (for contrast): Auth refresh/logout/switch-household (`AuthContext.test.tsx:171-472`), invite accept/decline UI (`InviteAccept.test.tsx:5-56`), import FE commit behavior (`ImportWizard.test.tsx:76-100`), household RLS and guest access (`tests/test_households.py:786-885`), admin reset password (`tests/test_auth_wave4.py:809-870`).

---

## 5. Verification Summary

This document was independently verified by three reviewers after the v1 draft was produced. No verifier had access to another verifier's report before completing their own.

| Reviewer | Domain | Methodology | Confidence on documented surfaces | Confidence on completeness |
|---|---|---|---|---|
| **Tariq** (completeness) | Routes, endpoint catalogue, FE API client dead-code, cross-cutting flows | Re-enumerated all `@router.<method>` decorators per file; inspected all 18 FE pages and 13 FE API clients; independently re-ran all 8 gap hypotheses | **HIGH** | **MEDIUM** (enumerated 7 specific missing items; all now corrected in v2) |
| **Quinn** (behavioral/QA) | FE↔BE wiring correctness, gap confirmation, test coverage | Retraced wiring from code (pages → api clients → routes → deps → repos) independently; sampled all 10 domains; checked all 8 gap hypotheses with code + test evidence | **MEDIUM-HIGH** | **MEDIUM-HIGH** (found 2 wiring discrepancies: Welcome flow and HW-07 timing) |
| **Maya** (architecture) | Datastore-of-record claims, RLS multi-tenancy, DI wiring, security | Analyzed `deps.py`, all routers, all repo implementations; verified dual-write wrapper behavior; validated role guard attributions | **HIGH** | **HIGH** (confirmed all resource catalogs; identified Sheets exception for `next_id()`) |

**Overall confidence on v2:** **HIGH** that documented surface mappings are correct and complete.

**Outstanding decisions requiring product confirmation:**
1. Gap #3 — is invite link reusability after user decline intentional? (`pending_invitations.status` field supports `"declined"` but is never written)
2. Gap #6 — is the `HardwareRepo.next_id()` Sheets dependency a known technical debt item? What is the migration timeline?

---

## 6. Changelog vs v1

| Change | Type | Source |
|---|---|---|
| Added `GET /auth/me` (A-08) to §1 Surface Index; renumbered admin reset-password to A-09 | Fix (numbering collision) | Tariq |
| Added `NotFound` 404 catch-all as §2.17 and `NF-01` in §1 | Missing surface | Tariq |
| Added `GET /auth/logout` legacy redirect to §3a | Missing endpoint | Tariq |
| Added `GET /auth/login` legacy redirect to §3a | Missing endpoint | Tariq |
| Added `GET /api/defaults` query-param legacy variant to §3a as Gap #10 | Missing endpoint | Tariq |
| Fixed endpoint count: 52 → 62 (10 undercounted; 7 documented + 3 uncharted in v1) | Count correction | Tariq |
| Flagged `GET /households/me` / `listHouseholds()` as dead FE client code (Gap #9) | New gap | Tariq |
| **Corrected §2.2 Welcome page** — NOT static; is an onboarding wizard calling `POST /households` + `GET /auth/me` for authenticated zero-membership users | **Material correction** | Quinn |
| Corrected §2.9 HW-07 action-types timing — loaded in `LogMaintenanceModal`, not at page load | Minor correction | Quinn |
| **Gap #7 REFUTED** — import admin guard is consistent FE + BE; removed from gap list | Reclassification | Quinn + Maya |
| **Gap #3 reclassified** — decline invite is intentional no-op by design; product/security side-effect flagged | Reclassification | Quinn (confirmed by Tariq) |
| Added §4.1 Test Coverage Signal — 7 surfaces/paths with weak or no coverage | New section | Quinn |
| Confirmed Postgres as datastore-of-record for all repos except `HardwareRepo.next_id()` (Gap #6, live Sheets read) | Architecture confirmation | Maya |
| Added line-number citations to all §3a endpoint entries | Citation completeness | v2 |
| Added Verification Summary (§5) | New section | v2 |
| Added Changelog vs v1 (§6) | New section | v2 |

---

*End of map. v2 counts: 17 UI surfaces (including NotFound), 62 BE registered endpoints, 10 candidate gaps (Gap #7 refuted; Gap #3 reclassified; Gaps #9 and #10 added), 9 repos, 3 datastores (Postgres primary + Sheets archive/HW-exception + GCS), 3 LLM/OAuth external services.*
