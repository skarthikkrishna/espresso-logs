> **v2.0 — Multi-household multi-tenant (succeeds v6.0 / React SPA spec)**
>
> This document supersedes `functional-spec.md` (v6.0 / React SPA, post Phase 15) as the
> authoritative product functional specification. It preserves all v1 entity schemas, enumerations,
> AI inference contracts, display rules, and visual design system unchanged — extending each to a
> household-scoped, multi-tenant model. The driving change is enabling a small circle of households
> (e.g., friends and family) to share the same deployment while keeping their data, catalog,
> inventory, and hardware completely private to their household. Wherever this document is silent on
> a topic that v1 covered, v1's ruling holds. Where the two conflict, this document wins.
>
> **What changed in v2.0 vs v6.0:**
> - New entities: `Household`, `HouseholdMembership`, `User`, `Invitation`
> - All existing entities gain a `household_id` foreign key; no data is globally unscoped
> - Auth model: `ALLOWLIST_EMAILS` (deprecated) → household invitation system; dual-path login (username+password primary, optional Google OAuth)
> - Data store: Google Sheets → relational database with row-level household isolation
> - New UX surfaces: household switcher, invite management, onboarding wizard, profile page
> - New role model: two roles per household membership — `admin` and `member`
> - New §8: roles and permissions matrix

---

# Product Functional Specification v2.0
## AI-Powered Espresso Log & Inference Engine — Multi-Household Edition

---

## §0 Product Overview & Scope

### 0.1 Vision

Coffee Tracker is an AI-augmented espresso logging PWA for households. The primary user story has
always been: *as a home barista, I want to log each shot, track my bean inventory, and get AI
feedback so that I dial in faster and waste fewer beans.*

v2.0 preserves that core proposition and extends the deployment model: **a single deployment now
serves multiple independent households**. A friend or family group can be invited to use the same
running instance, with their catalog, inventory, hardware, and brew log data completely isolated
from every other household on the system.

### 0.2 What changed and why

v1 was a single-household app backed by a Google Sheet. Sharing the deployment meant sharing the
Sheet — which meant sharing all data. This limited the app to the deployer's own household.

The v2.0 change is driven by a concrete user need: krishna wants to share the app with friends so
each friend's household can run their own coffee logs through the same Cloud Run instance.

The four structural changes that make this possible:

1. **Data store:** Google Sheets → relational database with row-level household isolation.
2. **Auth model:** Email allowlist (`ALLOWLIST_EMAILS`, **deprecated in v2.0**) → household invitation system; dual-path login: username+password (primary) + optional Google OAuth.
3. **Data model:** Every entity gains a `household_id` foreign key; nothing is globally unscoped.
4. **New UX surfaces:** Onboarding wizard, household switcher, invite management, profile page.

All existing UX patterns — brew log, extraction compass, catalog, hardware, maintenance, AI
inference — are **unchanged in behaviour**. The transition is additive and non-destructive.

### 0.3 Scope for v2.0 MVP

**In scope:**
- Multi-household model with full data isolation
- Dual-path auth: username+password (primary) + optional Google OAuth
- Username+password registration and login (no email required)
- Optional "Sign in with Google" as a parallel path (not required)
- Household admin-assisted password reset (no SMTP, no self-serve reset link)
- Read-only guest household URL (shareable by admin; no write access without authentication)
- Multiple admins per household (co-owner model)
- Role promotion/demotion via `PATCH /households/members/{id}` (any existing admin may promote or demote)
- Three roles: `admin` (full control), `member` (can log shots and view all household data), `guest` (read-only via shared link)
- Invitation-based onboarding via token link (72-hour expiry); `invited_email` is nullable — link-only invites work without email; see NFR-D7
- Household switcher for users who belong to more than one household
- Profile page with household list and sign-out
- Household management page (rename, member list, remove members, delete household)
- All v1 features extended to household scope with no regression

> **TPM note — email delivery (2026-05-06):** The invitation system is implemented as token-based links. The application *attempts* to send the link via email if `SMTP_HOST` is configured; if not, the token is available server-side for out-of-band sharing. This ensures the MVP ships without requiring a transactional email service contract. Operators can configure SMTP at any time to enable email delivery. See NFR-D7 for the graceful degradation contract.

**Out of scope for v2.0:**
- Household ownership transfer
- Push notifications
- Native iOS/Android app (PWA remains the delivery target)
- Public household discovery

See Appendix A for the full deferred-features table.

### 0.4 Users and personas

| Persona | Description | Role |
|---------|-------------|------|
| **Household admin** | Sets up the household, manages members, owns the gear; multiple members may hold this role | `admin` |
| **Household member** | Logs shots and views data; added by invite | `member` |
| **Multi-household user** | Admin of their own household AND a member of a friend's | both |
| **Guest** | Read-only visitor via a shared household URL; no account required; cannot log shots | `guest` |

*For v2.0 MVP, the deployment operator is assumed to be an admin of the first household.*

---

## §1 Data Architecture & Entities

The system relies on a strict relational model. Every entity except `User` is scoped to a
`Household`. No API endpoint returns cross-household data. The repository layer enforces household
scope at query time; no caller is permitted to bypass this.

---

### 1.1 New entities (v2.0)

#### Household

The top-level organisational unit. All data (catalog, inventory, hardware, brew logs) belongs to
exactly one household.

| Attribute | Type | Required | Notes |
|-----------|------|----------|-------|
| `id` | UUID (PK) | ✅ | System-generated |
| `name` | String | ✅ | Human-readable household name (e.g. "The Krishnas' Setup") |
| `created_at` | Timestamp | ✅ | UTC ISO 8601 |
| `created_by_user_id` | UUID (FK → User) | ✅ | The user who created the household; always an admin |

#### User

A first-class entity representing an authenticated person. The v1 allowlist is replaced by
household memberships. Users may register via username+password or Google OAuth; both paths
are first-class.

| Attribute | Type | Required | Notes |
|-----------|------|----------|-------|
| `id` | UUID (PK) | ✅ | System-generated; stable across sessions |
| `username` | String | ✅ | 3–30 chars, alphanumeric + underscores, globally unique; set at registration; not editable post-creation |
| `password_hash` | String | ❌ | Argon2id hash; null for Google OAuth-only accounts |
| `google_sub` | String | ❌ | Google OAuth `sub` claim; null for username+password-only accounts; unique when present |
| `email` | String | ❌ | From Google profile; never required; not collected for username+password registrations; used for invitation matching only when present |
| `display_name` | String | ✅ | User-chosen or derived from Google profile; shown in UI |
| `picture_url` | String | ❌ | Google profile photo URL; may be absent; no upload supported |
| `created_at` | Timestamp | ✅ | First sign-in or registration time |
| `last_seen_at` | Timestamp | ✅ | Updated on every authenticated request |

#### HouseholdMembership

The join table between a user and a household. A user may have multiple memberships (one per
household). The role applies to that specific household only.

| Attribute | Type | Required | Notes |
|-----------|------|----------|-------|
| `id` | UUID (PK) | ✅ | System-generated |
| `household_id` | UUID (FK → Household) | ✅ | |
| `user_id` | UUID (FK → User) | ✅ | |
| `role` | Enum (`admin` \| `member`) | ✅ | See §2 |
| `invited_by_user_id` | UUID (FK → User) | ❌ | Null for the founding admin who created the household |
| `invited_at` | Timestamp | ❌ | Null for the founding admin |
| `accepted_at` | Timestamp | ❌ | Null until invitation is accepted; set on first sign-in after acceptance |

*Constraint:* A `(household_id, user_id)` pair must be unique — a user may hold only one role per
household.

#### Invitation

A time-limited, token-based invitation. Invitations are consumed on acceptance and are not
reusable. `invited_email` is optional — link-only invites work without an email address; any
authenticated user who presents a valid unexpired token is accepted.

| Attribute | Type | Required | Notes |
|-----------|------|----------|-------|
| `id` | UUID (PK) | ✅ | System-generated |
| `household_id` | UUID (FK → Household) | ✅ | |
| `invited_email` | String | ❌ | Email address the invitation was sent to; null for link-only invites |
| `token` | UUID | ✅ | Unique, unpredictable; included in the invitation link |
| `invited_by_user_id` | UUID (FK → User) | ✅ | Must be an admin of the household |
| `invited_at` | Timestamp | ✅ | UTC ISO 8601 |
| `expires_at` | Timestamp | ✅ | 72 hours after `invited_at` by default |
| `accepted_at` | Timestamp | ❌ | Set on acceptance; null while pending or expired |

*Constraint:* When `invited_email` is set, a pending, unexpired invitation may not be re-issued to
the same email for the same household until the existing invitation expires or is revoked.
Link-only invites (null email) have no such uniqueness constraint. The invite token is consumed on
acceptance regardless of whether `invited_email` was set.

#### GuestToken

A permanent, admin-generated read-only access token for a household. Guest tokens are separate from
invitation tokens and do not expire unless explicitly revoked by an admin.

| Attribute | Type | Required | Notes |
|-----------|------|----------|-------|
| `id` | UUID (PK) | ✅ | System-generated |
| `household_id` | UUID (FK → Household) | ✅ | |
| `token` | UUID | ✅ | Unique, opaque read-only access key |
| `created_by_user_id` | UUID (FK → User) | ✅ | Must be an admin of the household |
| `created_at` | Timestamp | ✅ | UTC ISO 8601 |
| `revoked_at` | Timestamp | ❌ | Set when admin revokes the token; null while active |

*A household may have at most one active guest token at a time. Generating a new token implicitly
revokes the previous one. Guest tokens grant no write access.*

---

### 1.2 Existing entities (household-scoped)

All five existing entities gain a `household_id` foreign key (NOT NULL). The descriptions below
carry forward all v1 attributes unchanged and note the new household scope requirement.

#### Catalog (Master Bean Data)

*Household-scoped.* Each household maintains its own bean reference library. A bean that appears
in two households is represented by two independent `Catalog` rows.

| Attribute | Notes |
|-----------|-------|
| `household_id` | FK → Household; NOT NULL |
| `Catalog_ID` | Format: `CAT{NNN}`; unique within a household |
| All other v1 attributes | Unchanged — see v1 §1 and `sheet-schema.md` §Catalog |

#### Inventory (Specific Bag Instance)

*Household-scoped.* Each bag belongs to exactly one household.

| Attribute | Notes |
|-----------|-------|
| `household_id` | FK → Household; NOT NULL |
| `Bag_ID` | Composite key format unchanged; unique within a household |
| All other v1 attributes | Unchanged — see v1 §1 and `sheet-schema.md` §Inventory |

#### Hardware (Modular Equipment)

*Household-scoped.* A household's physical equipment inventory is private to that household.

| Attribute | Notes |
|-----------|-------|
| `household_id` | FK → Household; NOT NULL |
| `Hardware_ID` | Categorical-prefix format unchanged; unique within a household |
| All other v1 attributes | Unchanged — see v1 §1 and `sheet-schema.md` §Hardware |

#### Maintenance (Hardware Temporal Logs)

*Household-scoped.* Maintenance events inherit household scope via their `Hardware_ID` parent.
`household_id` is stored directly for query efficiency.

| Attribute | Notes |
|-----------|-------|
| `household_id` | FK → Household; NOT NULL |
| `Maintenance_ID` | Format: `MNT{NNN}`; unique within a household |
| All other v1 attributes | Unchanged — see v1 §1 and `sheet-schema.md` §Maintenance |

#### Brew Log (Event Data)

*Household-scoped.* Each shot record belongs to one household. The `logged_by_user_id` attribute
is added to record which member of the household logged the shot.

| Attribute | Notes |
|-----------|-------|
| `household_id` | FK → Household; NOT NULL |
| `logged_by_user_id` | FK → User; NOT NULL. The household member who submitted the shot |
| `Shot_ID` | Format: `SH-{YYYYMMDD}-{NN}`; unique within a household (NN is household-daily sequence, not global) |
| All other v1 attributes | Unchanged — see v1 §1 and `sheet-schema.md` §Brew_Log |

---

### 1.3 ID format summary (v2.0)

| Entity | Format | Example | Notes |
|--------|--------|---------|-------|
| Household | UUID v4 | `3f2504e0-...` | System-generated |
| User | UUID v4 | `f7a3b2...` | System-generated; stable across sessions |
| HouseholdMembership | UUID v4 | `a1b2c3...` | System-generated |
| Invitation | UUID v4 | `d4e5f6...` | System-generated |
| GuestToken | UUID v4 | `e8f9a0...` | System-generated |
| Brew_Log `Shot_ID` | `SH-{YYYYMMDD}-{NN}` | `SH-20250429-01` | NN = household-daily sequence |
| Catalog `Catalog_ID` | `CAT{NNN}` | `CAT100` | Sequence within household |
| Hardware `Hardware_ID` | `M{NN}` / `G{NN}` / `B{NN}` | `M01` | Sequence within household |
| Inventory `Bag_ID` | `{RoasterCode}{YYYYMMDD}{RoastLevelCode}` | `Ve20250201M` | Unique within household |
| Maintenance `Maintenance_ID` | `MNT{NNN}` | `MNT001` | Sequence within household |

---

## §2 Enumerations & Standardised Values

All v1 enumerations carry forward unchanged. One new enumeration is added.

### 2.1 Existing enumerations (unchanged)

**Shot_Eligibility**

| Value | Meaning |
|-------|---------|
| `Reject` | Puck failure, channeling, or obviously undrinkable |
| `Passable` | Drinkable but below standard |
| `Good Espresso` | Solid, repeatable shot |
| `God Shot` | Exceptional — dialled in perfectly |

**Taste_Summary (Objective Flavor Matrix)**

| Value | Zone |
|-------|------|
| `Weak & Sour` | Under-extracted |
| `Acidic & Bright` | Under-extracted |
| `Salty / Channeled` | Under-extracted |
| `Sweet & Balanced` | Balanced |
| `Complex & Syrupy` | Balanced |
| `Harsh & Bitter` | Over-extracted |
| `Strong & Muddy` | Over-extracted |

**Storage_Method** (7 canonical values — see `sheet-schema.md` §Inventory for full table)

**Roast_Level:** `Light` · `Light / Medium` · `Medium` · `Medium / Dark` · `Dark`

**Hardware.Category:** `Machine` · `Grinder` · `Basket`

**Inventory.Status:** `Active` · `Finished`

**Maintenance.Action_Type** (scoped by hardware category — see `sheet-schema.md` §Maintenance)

---

### 2.2 New enumerations (v2.0)

**HouseholdMembership.Role**

| Value | Description |
|-------|-------------|
| `admin` | Full control: invite/remove members, promote/demote roles, manage all household data, delete household. Multiple members may hold this role simultaneously. The household creator is the first admin; additional admins are promoted by any existing admin. The last admin cannot demote themselves — the system enforces ≥1 admin per household at all times. |
| `member` | Can view all household data and log shots; cannot manage membership or household settings |

*There is no role hierarchy beyond `admin` and `member` for authenticated users.* Both roles can
log shots.

**Guest access** is a separate concept — not a `HouseholdMembership.Role`. Guests access the
household via a `GuestToken` (see §1.1), not a membership. They hold no `HouseholdMembership` row.
See §8 for the permissions matrix including guest access.

**Invitation.Status** (derived, not stored — computed from `accepted_at` and `expires_at`)

| Derived value | Condition |
|---------------|-----------|
| `pending` | `accepted_at IS NULL AND expires_at > now()` |
| `accepted` | `accepted_at IS NOT NULL` |
| `expired` | `accepted_at IS NULL AND expires_at <= now()` |

---

## §3 Data Ingestion & Bootstrapping

The v1 bootstrap import wizard is preserved. In v2.0, all import operations are **household-scoped**:
imported data is written to the active household's tables. The import wizard flow (Upload → Preview
→ Done) is unchanged.

**Household bootstrap contract:**
- A newly created household has no catalog, inventory, hardware, or brew log data.
- The bootstrap import wizard is the canonical path for migrating legacy data into a new household.
- The wizard always shows the target household name in the header to prevent accidental
  cross-household imports.
- Only admins may initiate a bootstrap import. The import wizard is hidden from the navigation for
  members (see §8 Roles & permissions matrix).

**Multi-step import scope:**
- Each uploaded CSV/XLSX file is imported into a single household per session.
- The wizard cannot import data into multiple households simultaneously.

**LLM mapping (unchanged from v1):**
- The LLM evaluates uploaded data against the entity schema and performs minimum-necessary
  transformations.
- Subjective divergence handling (e.g., "Too acidic" → `Acidic & Bright`) works identically.
- See v1 §3 for full import wizard specification.

---

## §4 UX & Navigation Flows

### §4.0 Visual design system

All v1 visual design rules carry forward unchanged. The additions below introduce household-aware
tokens; no existing token is modified.

*Carry forward unchanged:*
- `espresso-dark` DaisyUI theme; amber/dark palette; Playfair Display + Inter typography
- Frosted-glass `<main>` panel; full-bleed section background images
- Chip / badge design system (amber-variant and stone-variant)
- Floating action button (FAB) pattern
- Unified 120 ms `ease-out` page transition contract
- Back navigation `← Back` pattern and `?back=` query parameter contract
- `prefers-reduced-motion` suppression rule

**Household name display token.** The active household name is a persistent UI element. It is
rendered in sentence case, using the amber/primary accent colour (`text-amber-400`), at `text-sm`
weight, in all contexts where the household switcher appears (see §4.14). The household name must
be truncated at 24 characters with an ellipsis if longer, to prevent layout overflow in the
sidebar or bottom nav header.

**Household context chip.** When a user is a member of two or more households, a small chip
displaying the active household name appears adjacent to the top-level section heading on every
page. This chip uses the amber-variant chip tokens (`bg-amber-900/25 text-amber-300
border border-amber-600/30`). Single-household users do not see this chip — household context is
implicit and showing it adds visual noise.

**Avatar / member presence tokens.** On admin-only surfaces (member list, invited-members list),
each member row shows a small circular avatar image (32 × 32 px) from `User.picture_url` with a
fallback to a single-letter monogram on the same warm brown gradient used for catalog bean cards.
The same two-letter monogram system from the catalog section is not applicable here — member
avatars use a single initial (first character of `display_name`).

---

### §4.1 Navigation structure

**Desktop sidebar (updated):**
A fixed left sidebar (256 px wide) is always visible. The top of the sidebar shows the active
household name (see §4.14 household switcher). Below the household name, it contains icon + label
links to: Home, Brew log, Catalog, Hardware, Bootstrap import. The Bootstrap import link is shown
only to admins; members see the same five links except Bootstrap import is hidden. The active link
is highlighted with the amber/primary accent colour.

**Mobile bottom navigation bar (updated):**
The bottom navigation bar is topped by a thin household context strip — a single line showing the
active household name in `text-xs text-amber-400`, centred, above the five (or four) nav icons.
On mobile, Bootstrap import is accessible via the sidebar drawer (slide-in panel) rather than the
bottom nav, to preserve the five primary navigation slots for the most frequent actions.

**Household-aware nav links.** All five primary navigation targets (Home, Brew log, Catalog,
Hardware, Bootstrap import) always operate within the active household context. No navigation link
has a cross-household scope.

All other navigation rules from v1 §4.1 carry forward unchanged (transition timing, `prefers-reduced-motion`, active state highlight).

---

### §4.2 Per-section background images

Unchanged from v1 §4.2. Each main section uses a full-bleed background photograph. Background
gradient opacity ≤ 0.35 for the first stop. Background image assets are served from `/static/img/`.

---

### §4.3 UX pattern 1 — Active dashboard (household-scoped)

The dashboard displays all active `Inventory` bags **for the active household**. All v1 dashboard
behaviour carries forward unchanged (hero cards with bean name, roaster, roast level, days since
last shot, key metrics, "Add shot" CTA, empty-state CTA card).

**Household scope note:** When a user switches households (see §4.14), the dashboard immediately
refreshes to show the new household's active bags. The loading skeleton during the household switch
must display the new household name in the page header before bag data arrives, so the user has
immediate confirmation of which household they are viewing.

**Multi-member context.** The dashboard does not show per-member activity. All shots for the
household appear in the brew log regardless of which member logged them; the dashboard shows
aggregate household data only.

---

### §4.4 UX pattern 2 — Frictionless brew logging (household-scoped)

Unchanged from v1 §4.4 in all respects, with the following addition:

**Member attribution.** The "Add shot" form does not ask the user to select who is logging the
shot — it is automatically attributed to the currently signed-in user (`logged_by_user_id`). In
the brew log list view and detail view, the display name of the logging member is shown below the
shot date as a secondary label (`text-stone-400 text-sm`), providing household transparency
without being the primary focus.

**Smart defaults scope.** The smart defaults service (last-shot prefill, same-roaster fallback,
roast-profile fallback) operates within the active household only. A user who is a member of two
households will not see cross-household defaults.

---

### §4.5 UX pattern 3 — Interactive learning guidance (Extraction Compass)

Unchanged from v1 §4.5. The Extraction Compass is a household-scoped Chart.js scatter plot.
Historical dots plotted on the compass derive from the active household's brew log for the active
bag, not from any cross-household data.

---

### §4.6 UX pattern 4 — Hierarchical catalog (household-scoped)

Unchanged from v1 §4.6 in all respects. The catalog card grid and detail views operate on the
active household's catalog rows only.

**Admin-only note:** Adding a new catalog entry (via the FAB → "Add bean" flow, including the
AI-inferred catalog creation from a URL) is permitted for all members. Catalog management is not
admin-restricted because adding beans is part of the core logging workflow.

---

### §4.7 UX pattern 5 — Hardware management (household-scoped)

Unchanged from v1 §4.7. The hardware two-column layout, crossfade transitions, and maintenance
timeline all operate on the active household's hardware and maintenance records.

**Admin-only note:** Adding new hardware and logging maintenance events are permitted for all
members. Equipment setup is expected to be collaborative.

---

### §4.8 PWA & service worker

Unchanged from v1 §4.8. Caching strategies (stale-while-revalidate for GET, cache-first for
`/static/`, network-only for auth + mutations) are unchanged. The `INVALIDATE` postMessage
signal must also invalidate the household-scoped query keys when the active household changes.

---

### §4.9 Browser-side repository caching (TanStack Query)

Unchanged from v1 §4.9 (`staleTime` 60 s, `PersistQueryClientProvider`, localStorage). All
household-scoped query keys must include `household_id` as a component so that switching
households produces a cache miss and a fresh fetch, not stale data from the previous household.

*Query key convention:* `[entityName, householdId, ...otherFilters]`

---

### §4.10 UX pattern 6 — Import wizard (household-scoped)

Unchanged from v1 §4.10 (three-step flow: Upload → Preview → Done; centred layout;
`max-w-2xl mx-auto`; "No file selected" sentence-case placeholder). The following additions apply:

**Household header.** The wizard panel header must show the active household name and a brief
instruction: *"Importing into: [Household name]"*. This is displayed at `text-sm text-amber-300`
above the step indicator.

**Admin gate.** The `/import` route redirects non-admin users to the dashboard with a DaisyUI
`alert-warning` banner: *"Only household admins can run the import wizard."*

---

### §4.11 Household management (NEW)

> This section defines the admin-only surfaces for managing a household's membership, settings,
> and lifecycle.

**Route:** `/household/settings`

**Access:** Admin only. Members attempting to access this route are redirected to the dashboard
with a DaisyUI `alert-warning` banner: *"Only admins can access household settings."*

**Layout:** A full-width settings page with three tabs/sections:

#### 4.11.1 Household details

- Editable `name` field (text input, max 64 characters) with a save button.
- Household creation date (read-only, formatted as "Created [Month DD, YYYY]").
- Danger zone: a "Delete household" button (destructive, `btn-error btn-outline`). Deleting a
  household is irreversible and permanently removes all associated data (catalog, inventory,
  hardware, brew logs, maintenance, memberships). A confirmation modal must appear before the
  action is executed. The confirmation modal must require the admin to type the household name
  exactly before the final delete button becomes enabled.

#### 4.11.2 Members

A list of current household members. Each row shows:
- Member avatar (32 × 32 px; see §4.0 avatar token)
- Member `display_name`
- Member `email` (shown only if present; omitted for username+password accounts without a linked Google account)
- Role chip (`admin` or `member`) using the amber-variant chip tokens
- For members (not admins): a *"Promote to admin"* button and a *"Remove"* button (`btn-ghost btn-sm text-error`); clicking "Remove" shows a confirmation prompt before executing.
- For other admins: a *"Demote to member"* button; disabled with a tooltip if demoting would leave the household with zero admins.
- An admin cannot remove themselves; the self-row's "Remove" button is hidden. The self-row's "Demote to member" button is disabled if the user is the last admin in the household.

**Role promotion/demotion:** `PATCH /households/members/{id}` with `{"role": "admin"}` or
`{"role": "member"}`. Any existing admin may promote or demote any other member. The system
enforces ≥1 admin per household — a demotion that would leave zero admins returns HTTP 409.

**Member count limit (MVP):** A household may have at most 10 members (including admins). The
invite button is disabled and shows a tooltip: *"Member limit reached (10/10)"* when this limit is
reached.

#### 4.11.3 Pending invitations

A list of invitations that are in `pending` or `expired` status (accepted invitations are not
shown here — the member appears in the Members list). Each row shows:
- Invited email address (or *"Link-only invite"* if `invited_email` is null)
- Status chip (`pending` → amber-variant chip; `expired` → stone-variant chip)
- Expiry date/time formatted as relative time ("Expires in 2 days" / "Expired 3 hours ago")
- A "Revoke" button for pending invitations
- A "Resend" button for expired invitations (creates a new invitation, invalidating the old token)

**Invite button.** A primary `btn btn-primary` button at the top of the Pending invitations section
opens the invite modal (see §4.12.2 invite flow).

#### 4.11.4 Guest access

A dedicated sub-section in household settings for generating and revoking the household's read-only
guest link.

- If no active guest token exists: a single *"Generate guest link"* primary button (`btn btn-primary`).
- If an active guest token exists: a read-only URL display showing the full guest link, plus a
  *"Revoke guest link"* button (`btn btn-ghost text-error`).
- The displayed URL format: `https://<app>/households/<id>/view?key=<token>` — the token is opaque.
- Revoking the guest link immediately invalidates the token; any visitor using the old URL sees:
  *"This guest link is no longer valid. Ask the household admin to share a new one."*
- Generating a new link while one is already active implicitly revokes the old one (single active
  token per household).

---

### §4.12 Invitation & onboarding flow (NEW)

> This section defines how users are invited into households, how they accept invitations, and the
> first-run experience for brand-new users.

#### 4.12.1 First sign-in onboarding (new user, no household)

When a user registers or signs in for the first time and has no household memberships (i.e.,
no `HouseholdMembership` row for their `User.id`), they land on an onboarding welcome screen
instead of the dashboard. This applies to both username+password registrations and first-time
Google OAuth sign-ins.

**Route:** `/welcome`

**Onboarding wizard — two steps:**

**Step 1: Welcome screen**
- Heading: *"Welcome to Coffee Tracker"*
- Body: *"Coffee Tracker is a household app. You'll need to either create a new household or
  accept an invitation from a friend."*
- Two CTA buttons:
  - Primary: *"Create my household"* → navigates to Step 2a
  - Secondary: *"I have an invitation"* → navigates to Step 2b

**Step 2a: Create household**
- A single text input: *"What should we call your household?"* (placeholder: "e.g. The Krishnas'
  Setup", max 64 chars)
- Submit button: *"Create household"*
- On success: household is created, user is set as `admin`, and the user is redirected to the
  dashboard for the new household.
- Skip option: none. A user must create or join a household before using the app.

**Step 2b: Accept invitation**
- Instruction text: *"Ask a household admin to share an invitation link with you, then click
  that link to be added to their household."*
- Body copy: *"The admin can generate an invitation link from their household settings — no
  email address required."*
- A single back link: *"← Create a new household instead"* → returns to Step 2a.
- No manual token entry — invitations are always accepted via the link shared by the admin.

**Re-entry guard:** Once a user has at least one household membership, `/welcome` redirects to the
dashboard. The welcome wizard is shown only to users with zero memberships.

**Acceptance criteria — first sign-in onboarding:**
- AC-ONB-01: As a new user who has never used the app, after registering or signing in (by any auth method), I am taken to `/welcome` and not the dashboard.
- AC-ONB-02: As a new user, I can type a household name and click "Create household" to land on the dashboard with my new household as the active context.
- AC-ONB-03: As a new user, I can click "I have an invitation" and receive clear instructions explaining that the admin will share an invitation link with me (no email required).
- AC-ONB-04: As a returning user with at least one household, visiting `/welcome` redirects me to the dashboard without showing the wizard.

#### 4.12.2 Invite member flow (admin only)

Triggered from the household settings page (§4.11.3 "Invite" button).

**Invite modal:**
- Email input field with placeholder *"friend@example.com"* (optional — leave blank for a link-only invite)
- Role selector: two radio options (`Admin` / `Member`), default `Member`
- Submit button: *"Send invitation"*
- Validation: if email is provided, it must be a valid email format. If a pending invitation already
  exists for that email + household, show an inline error: *"An invitation to this address is already
  pending."* If the email belongs to an existing household member, show: *"This person is already a
  member."*
- If no email is provided, the invitation is created as a link-only invite; the full token URL is
  shown in the UI for manual sharing (see NFR-D7 UI warning pattern).

**Invitation email (transactional):**
- Subject: *"[Admin name] invited you to [Household name] on Coffee Tracker"*
- Body: brief personalised message, household name, and a single CTA button linking to
  `/invite/accept?token={token}`.
- The invitation link must include only the token — no email address or household name in the
  URL (to prevent trivial enumeration of household names from URL inspection).
- The email is sent by the application backend via a transactional email provider (e.g., Google
  Workspace SMTP relay, SendGrid, or equivalent configured via `SMTP_*` environment variables).
- **If `SMTP_HOST` is not configured:** the email is silently skipped; the invitation record is
  still created; the token is available via the server logs or Cloud SQL Studio so the admin can
  share the link out-of-band (see NFR-D7). The UI shows a warning banner: *"Email delivery is not
  configured. Copy and share this invitation link manually:"* followed by the full
  `/invite/accept?token={token}` URL.

**Success state:** The modal closes; the pending invitations list updates to show the new entry
with status `pending`. A toast notification confirms: *"Invitation sent to [email]"* (or *"Invitation
link ready — share it manually"* for link-only invites).

**Acceptance criteria — invite flow:**
- AC-INV-01: As a household admin, I can open the invite modal from household settings and optionally enter an email address to send an invitation; leaving the email blank creates a link-only invite.
- AC-INV-02: As an admin, if I try to invite an email that already has a pending invitation, I see the inline error "An invitation to this address is already pending."
- AC-INV-03: As an admin, I can choose to invite someone as a member (default) or as an admin.
- AC-INV-04: As a member (non-admin), the "Invite" button and the `/household/settings` route are not accessible to me.

#### 4.12.3 Invitation acceptance flow

The acceptance flow begins when the invitee clicks the link in their invitation email.

**Route:** `/invite/accept?token={token}`

**Step 1 — Token validation (server-side, before rendering):**
- If the token does not exist → redirect to `/invite/invalid` (see below).
- If the token is expired (`expires_at <= now()`) → redirect to `/invite/expired`.
- If the token is already accepted → redirect to the dashboard (idempotent accept is safe).

**Step 2 — Authentication check:**
- If the user is not signed in: redirect to `/login?invite={token}`. After sign-in or registration,
  the invite token is automatically applied and the user is added to the household (see Flow D in
  §4.12.4).

**Step 3 — Acceptance confirmation screen:**
- Heading: *"You've been invited"*
- Body: *"[Admin display name] has invited you to join [Household name] as a [role]."*
- Two buttons: *"Accept invitation"* (primary) and *"Decline"* (ghost/secondary).
- Decline does not delete the invitation token — the user may re-visit the link and accept later
  (until the token expires).

**Step 4 — On acceptance:**
- The `HouseholdMembership` row is created with `accepted_at = now()`.
- The `Invitation.accepted_at` is set.
- If the accepted user has other household memberships, the newly accepted household is set as the
  active household for this session.
- If this was their first membership, they bypass the `/welcome` wizard and land directly on the
  dashboard for the new household.
- A toast notification: *"Welcome to [Household name]!"*

**Error screens:**
- `/invite/invalid`: *"This invitation link is not valid. Ask the household admin to send you a
  new invitation."*
- `/invite/expired`: *"This invitation has expired. Ask the household admin to resend your
  invitation."*

**Acceptance criteria — invitation acceptance:**
- AC-ACC-01: As an invitee who clicks an invitation link while not signed in, I am redirected to `/login?invite={token}` and, after signing in or registering, automatically added to the household.
- AC-ACC-02: As an invitee on the acceptance screen, I can see the inviting admin's name, the household name, and the role I'm being invited as before I confirm.
- AC-ACC-03: As an invitee who clicks "Decline", the invitation token is not consumed; I can revisit the link later (until it expires) and still accept.
- AC-ACC-04: As an invitee who clicks "Accept invitation", I am added to the household and redirected to the household dashboard with a welcome toast.
- AC-ACC-05: As an invitee clicking an expired invitation link, I see a clear error page with instructions to ask the admin to resend.
- AC-ACC-06: As a user who is already a member of one household and accepts an invitation to a second, my active household context switches to the newly joined household.

#### 4.12.4 Auth flows

> All four flows are v2.0 in scope. No auth flow is deferred.

**Flow A: Username+password registration**

- **Trigger:** `/register` (directly, or redirected with `?invite=<token>` preserved)
- **Fields:** `username`, `password` — no email field anywhere on this form
- **Username rules:** 3–30 chars, alphanumeric + underscores, globally unique. Taken → inline
  *"Username already taken"*. Invalid characters → inline *"Username may only contain letters,
  numbers, and underscores"*.
- **Password rules:** minimum 12 characters. Too short → inline *"Password must be at least 12
  characters"*.
- **On success with no invite token:** account created → JWT issued → household creation wizard
  (`/welcome`).
- **On success with invite token (`?invite=<token>`):** account created → JWT issued → auto-added
  to invited household → token consumed → redirect to household dashboard.
- No email collected at any point in this flow.

**Flow B: Username+password login**

- **Trigger:** `/login`
- **Fields:** `username` input (label: *"Username"*), `password` input (type=password, label:
  *"Password"*), *"Sign in"* primary button.
- **Same page:** horizontal *"or"* divider + *"Sign in with Google"* secondary/outline button.
- **Footer:** *"Create an account"* link → `/register`.
- **Static copy (plain text, NOT a link, NOT a button):** *"Forgotten your password? Contact your
  household admin."*
- **No "Forgot password?" self-serve link anywhere in the UI.**
- **On success:** JWT + refresh token issued → household dashboard (or invite acceptance if
  `?invite=<token>` was present in the URL).
- **On failure:** generic *"Invalid username or password"* — does not indicate which field was wrong
  (prevents username enumeration).

**Flow C: Guest read-only access**

- Admin generates a guest link from household settings (§4.11.4) — single button: *"Generate guest
  link"*.
- **Link format:** `https://<app>/households/<id>/view?key=<token>` — opaque read-only token,
  separate from invite tokens.
- Visitor lands on the household dashboard in read-only mode: brew log, compass, and catalog are
  visible.
- No write actions are available: no *"Add shot"*, no *"Add bean"*, no hardware management, etc.
- **Persistent banner:** *"You're viewing [Household Name] as a guest. Sign in or create an account
  to log shots."*
  - Banner CTA *"Sign in"* → `/login`; *"Create an account"* → `/register`.
- Guest token does not expire automatically; admin can revoke from household settings (§4.11.4).

**Flow D: Invite acceptance (updated)**

- User clicks `/invite/accept?token=<token>` (or arrives at `/login?invite=<token>` /
  `/register?invite=<token>`).
- **If signed in:** validate token → add to household → redirect to household dashboard (token
  consumed).
- **If not signed in:** redirect to `/login?invite=<token>`. After login, invite is automatically
  applied.
- **If no account:** redirect to `/register?invite=<token>`. After registration, user is auto-added
  to the household → token consumed → redirect to household dashboard.
- `invited_email` is nullable — link-only invites have no email; any authenticated user who presents
  a valid unexpired token is accepted.

---

> The profile page is a first-class navigation destination for every signed-in user.

**Route:** `/profile`

**Navigation placement:**
- Desktop: a small avatar icon + the user's display name at the very bottom of the fixed sidebar,
  above the sign-out link. Clicking it navigates to `/profile`.
- Mobile: a "Profile" item in the slide-in navigation drawer (accessible from a hamburger icon in
  the bottom nav header area, next to the household name strip).

**Profile page sections:**

#### 4.13.1 Account details

- Username (read-only; set at registration; globally unique).
- Display name (read-only; sourced from Google profile for OAuth users, or same as username for
  username+password users).
- Email address (read-only; sourced from Google profile for OAuth users; not shown for
  username+password accounts without a linked Google account).
- Profile photo (read-only; sourced from Google for OAuth users; no upload supported).
- Auth method chip: *"Username + password"* or *"Google"* indicating how the account was created.
- For Google OAuth accounts: a note: *"To update your name or photo, visit your Google Account
  settings."*
- Password reset is not self-serve in v2.0. A static note: *"To reset your password, contact your
  household admin."*

#### 4.13.2 My households

A list of every household the user is a member of. Each row shows:
- Household name
- The user's role in that household (`admin` or `member`) as a chip
- Number of members
- An *"Open"* button that switches the active household to this one (equivalent to the household
  switcher action in §4.14).
- For admin-owned households: an *"Manage"* link that navigates to `/household/settings`.

#### 4.13.3 Sign out

A *"Sign out"* button (`btn-ghost text-error`) at the bottom of the profile page. Signing out
clears the session and redirects to the sign-in landing page.

**Acceptance criteria — profile page:**
- AC-PRF-01: As any signed-in user, I can view my display name, email address, and profile photo on the profile page.
- AC-PRF-02: As a user who belongs to two households, both households are listed on the profile page with my role in each.
- AC-PRF-03: As a user, clicking "Open" next to a household in my list switches the active context to that household and navigates me to its dashboard.
- AC-PRF-04: As an admin, clicking "Manage" next to a household I own takes me to `/household/settings`.
- AC-PRF-05: As a user, clicking "Sign out" clears my session and returns me to the sign-in page.

---

### §4.14 Household switcher (NEW)

> The household switcher is visible only to users who are members of two or more households. Users
> in a single household never see the switcher — their household context is implicit.

**Desktop placement:** At the top of the fixed sidebar, above the navigation links. The switcher
renders as a dropdown button showing the active household name (truncated at 24 chars) with a
downward chevron icon. Clicking it opens a popover list of the user's households.

**Mobile placement:** The household name strip at the top of the bottom navigation bar (see §4.1)
is tappable and opens a bottom sheet listing the user's households.

**Switcher popover/bottom-sheet:**
- Each household listed by name with the user's role as a small chip.
- The active household is marked with an amber checkmark.
- Tapping a household: sets the active household in the server session, updates all cached query
  keys (TanStack Query), closes the popover/bottom-sheet, and performs an in-place dashboard
  refresh. No full page reload.
- A *"+ Create new household"* item at the bottom of the list navigates to
  `/household/new` (a single-screen equivalent of the onboarding Step 2a form).

**Session persistence:** The active household is stored in the server-side session and restored on
next sign-in. If the stored household is no longer accessible (membership removed or household
deleted), fall back to the first household in the user's membership list, alphabetically by
`Household.name`. If the user now has **zero** household memberships (their only household was
deleted, or they were the sole admin who deleted it), the session is cleared of any active
household reference and the user is redirected to `/welcome` to create or join a new household.
This ensures the app never renders with an implicit household that no longer exists.

**API context:** The active household is resolved server-side from the session. All household-scoped
API endpoints infer `household_id` from the session; no client is expected to pass `household_id`
as a request parameter. This prevents client-side household-spoofing.

**Acceptance criteria — household switcher:**
- AC-SWT-01: As a user who belongs to only one household, I do not see the household switcher — my household context is implicit.
- AC-SWT-02: As a user who belongs to two or more households, I see the switcher showing the active household name in the sidebar (desktop) and bottom nav strip (mobile).
- AC-SWT-03: As a multi-household user, clicking the switcher shows a list of all my households with my role in each; the active household is marked with a checkmark.
- AC-SWT-04: As a multi-household user, selecting a different household from the switcher immediately updates all visible data to reflect the new household without a full page reload.
- AC-SWT-05: As a multi-household user, my active household selection persists across sign-outs and sign-ins.
- AC-SWT-06: As a user who was the sole admin and deleted their only household, I am redirected to `/welcome` to create or join a new household.

---

### §4.15 Mobile-native future (informational)

The app is currently a React PWA. This section documents functional divergence that would apply
if the delivery target becomes an iOS or Android native app (not in MVP scope).

| Functional area | PWA behaviour (current) | Native app divergence |
|-----------------|------------------------|-----------------------|
| Invitation acceptance | Email link opens browser → OAuth → accept screen | Deep link (`coffeetracker://invite/accept?token=…`) bypasses browser; OS handles OAuth natively |
| Push notifications | Not available in PWA on all platforms | Push notification on invitation received and on AI feedback ready; requires device token management |
| Offline write queue | Not in MVP | Native would support queuing shot submissions for offline-then-sync |
| Biometric auth | Not available | Face ID / fingerprint lock on app open |
| Home screen integration | PWA "Add to Home Screen" | Native app store distribution; different icon asset pipeline |

No functional requirements change for the PWA target. The PWA continues to be the primary
delivery mechanism for MVP.

---

### §4.16 Login and register page UI spec

#### 4.16.1 `/login` page

| Element | Spec |
|---------|------|
| **Username** | Text input; label *"Username"* |
| **Password** | `type=password` input; label *"Password"* |
| **Sign in** | Primary button (`btn btn-primary`) |
| Divider | Horizontal rule with centred text *"or"* |
| **Sign in with Google** | Secondary/outline button (`btn btn-outline`) |
| Footer | *"Create an account"* link → `/register` |
| Password reset | Static plain text: *"Forgotten your password? Contact your household admin."* — NOT a link, NOT a button |

- On failed authentication: show `alert alert-error` with text *"Invalid username or password"* —
  do not specify which field was wrong (prevents username enumeration).
- The *"Sign in with Google"* button initiates the standard Google OAuth flow. On success, Google
  users land on the household dashboard (or `/welcome` if this is their first sign-in).
- No email field on this page.
- If a `?invite=<token>` query parameter is present, it must be preserved through the sign-in flow
  and applied automatically on success.

#### 4.16.2 `/register` page

| Element | Spec |
|---------|------|
| **Username** | Text input; label *"Username"*; hint: *"3–30 characters, letters, numbers, and underscores only"* |
| **Password** | `type=password` input; label *"Password"*; hint: *"Minimum 12 characters"* |
| **Create account** | Primary button (`btn btn-primary`) |
| Footer | *"Already have an account?"* link → `/login` |

- Inline validation on submit (not on blur): username taken → *"Username already taken"*; invalid
  chars → *"Username may only contain letters, numbers, and underscores"*; password too short →
  *"Password must be at least 12 characters"*.
- No email field anywhere on this page.
- If a `?invite=<token>` query parameter is present, it is preserved through the registration flow
  and applied automatically on success (token consumed, user added to household, redirected to
  household dashboard).

---

## §5 AI Inference Architecture

Unchanged from v1 §5 in all respects. For completeness, the contract is restated with the
household-scope note.

- **Single inference provider per deployment** (Gemini Flash default; Anthropic Claude Haiku adapter).
  User-supplied API key stored in Secret Manager.
- **Prompt payload** (contextual & temporal):
  1. Full `BrewLog` row for the current shot (all fields, including `Storage_Method` and
     `logged_by_user_id`).
  2. Historical non-reject shots for that specific `Bag_ID` **within the same household**.
  3. Temporal hardware awareness: chronological `Maintenance` events for the household's hardware
     preceding the shot timestamp.
- **Household scope:** The inference layer operates entirely within the active household's data.
  No cross-household data is included in prompt context under any circumstances.
- **Expected output:** 1–2 sentence specific recommendation focused on yield or grind adjustment,
  written to `BrewLog.AI_Feedback`.
- **Non-blocking UX:** The shot row is written first; the React component polls
  `/api/brew-log/{id}/feedback` until `AI_Feedback` is populated. The UX never blocks on the LLM.
  Graceful failure message is shown if the inference call fails.
- **AI catalog inference** (`POST /api/catalog/infer`): Scoped to the active household (the
  inferred catalog entry is created in that household's catalog). Behaviour otherwise unchanged
  from v1 §4.6.

---

## §6 Non-Functional Requirements

All v1 NFRs carry forward unchanged. The following new and updated NFRs apply in v2.0.

### §6.1 Perceived Performance (unchanged from v1)

NFR-P1 through NFR-P6 carry forward without modification. See v1 §6.1.

---

### §6.2 Deployability (updated)

NFR-D1 through NFR-D5 carry forward without modification. The following new deployability
requirements apply.

**NFR-D6 — Database migration from Google Sheets:** v2.0 replaces Google Sheets with a relational
database. The `DEPLOY.md` must document the database setup procedure (schema creation, initial
migration). The application must not crash when migrating an existing v1 Sheets-based deployment —
a one-time data migration path from the Sheets export to the new database schema must be documented
and scripted. New deployments (greenfield) proceed directly to the database; no Sheets step is
required.

**NFR-D7 — Email provider configuration:** The application must not crash on startup when no SMTP
configuration is present. When `SMTP_HOST` is unset, invitation emails are silently skipped and a
server-side warning is logged. The invitation record is still created; only the delivery step is
skipped. An operator may manually retrieve the invitation token from the database to share it
out-of-band during development/testing.

**NFR-D8 — Household bootstrap guard:** On first startup of a fresh deployment with no `User` rows,
the application must present an onboarding prompt to the first authenticated user, guiding them to
create the first household. This ensures the app is usable without manual database seeding.

---

### §6.3 Multi-tenant data isolation (NEW)

**NFR-MT1 — Row-level household isolation:** Every database query that touches a household-scoped
entity (`Catalog`, `Inventory`, `Hardware`, `Maintenance`, `BrewLog`) must include a `household_id`
predicate. The repository layer must make it architecturally impossible to issue an unscoped query
to any household-scoped table. No entity-list endpoint may return rows from multiple households in
a single response.

**NFR-MT2 — Session-resolved household context:** The active `household_id` is resolved from the
server-side session on every request. API routes must not accept `household_id` as a client-supplied
URL parameter, request body field, or query string value. Clients that attempt to include a
`household_id` in a request body must have it silently ignored in favour of the session-resolved
value.

**NFR-MT3 — Cross-household reference prevention:** Foreign key relationships are enforced such
that a `BrewLog` row may only reference `Inventory`, `Hardware` rows that belong to the same
household. Attempting to create a `BrewLog` with a `Bag_ID` or `Hardware_ID` from a different
household must return HTTP 422 (Unprocessable Entity).

**NFR-MT4 — Member removal cleanup:** When a `HouseholdMembership` is removed (member removed by
admin), the member's `logged_by_user_id` attributions on `BrewLog` rows are preserved as
historical records. Rows are not deleted. The removed member simply loses access to the household;
their historical shot data remains part of the household's log.

---

### §6.4 Invitation security (NEW)

**NFR-IS1 — Token entropy:** Invitation tokens must be UUID v4 (122 bits of entropy). Tokens must
be generated using a cryptographically secure random number generator. Sequential or predictable
tokens are not permitted.

**NFR-IS2 — Token expiry:** Invitation tokens expire 72 hours after creation. Expired tokens must
be rejected server-side with HTTP 410 (Gone). The expiry check must occur on the server at the
time of acceptance, not only at token generation time.

**NFR-IS3 — Token single-use:** An accepted invitation token may not be re-used to create a second
membership. The server must check `accepted_at IS NOT NULL` and return HTTP 409 (Conflict) if
the token has already been consumed.

**NFR-IS4 — No email address in invitation URL:** The invitation URL must contain only the token.
It must not encode the invited email address, household name, or any other personally identifiable
information in the URL path or query string.

**NFR-IS5 — Role enforcement is server-side:** Admin-only mutations (invite member, remove member,
update household name, delete household, run bootstrap import) must be enforced by the server by
checking the `HouseholdMembership.role` for the session user. The client may hide admin-only UI
for UX convenience, but a member who constructs a raw HTTP request to an admin endpoint must
receive HTTP 403. The server never trusts a role claim from the client.

**NFR-IS6 — Invitation rate limiting:** A single admin may not issue more than 10 invitations in a
rolling 24-hour window to any given household. This prevents invitation spam. Exceeding the limit
returns HTTP 429 with the error message *"Invitation limit reached. Try again tomorrow."*

---

## §7 Display and Formatting Rules

All v1 display rules carry forward without modification.

### §7.1 ID fields are internal only (unchanged)

The following identifiers must never be rendered anywhere in the UI:

| Internal ID | Example value | Required UI representation |
|-------------|---------------|----------------------------|
| `Shot_ID` | `SH-20250429-01` | Shot date + bean name |
| `Bag_ID` | `Ve20250201M` | "Roaster — Bean name" |
| `Catalog_ID` | `CAT100` | Roaster + " — " + Bean name |
| `Hardware_ID` | `M01`, `G01`, `B01` | `Hardware.Name` |
| `Maintenance_ID` | `MNT001` | Not shown; identified by date + action type |
| `Household.id` | UUID | `Household.name` |
| `User.id` | UUID | `User.display_name` |
| `Invitation.token` | UUID | Never shown in UI; appears only in the invitation email link |
| `HouseholdMembership.id` | UUID | Not shown; memberships are identified by member name + role |

These IDs may appear as path parameters in URLs for routing only (e.g., `/household/{id}/settings`),
but must never be copied into visible page content.

### §7.2 Sentence case everywhere (unchanged)

All text rendered in the UI — headings, labels, button text, badges, navigation items, placeholders,
error messages, toast notifications, and all dynamically generated content — must use sentence case.
Only the first word of a phrase and proper nouns (brand names, roaster names) are capitalised.

**Correct:** "Invite member", "Household settings", "Pending invitations", "Remove member"
**Incorrect:** "Invite Member", "Household Settings", "Pending Invitations", "Remove Member"

This rule extends to all new v2.0 surfaces: household management, invitation flow, onboarding
wizard, profile page, and household switcher.

### §7.3 Consistent enum display (unchanged)

`Shot_Eligibility` and `Taste_Summary` values are always rendered exactly as defined in §2, in
sentence case. The application must not paraphrase, abbreviate, or reformat these values.

### §7.4 Household name display (NEW)

Household names are displayed exactly as entered by the admin (preserving original capitalisation
including mixed-case names like "The Krishnas' Setup"). The sentence-case rule (§7.2) does not
override household names — they are treated as proper nouns. However, system-generated UI copy
around them uses sentence case: *"Viewing data for The Krishnas' Setup"*, not *"Viewing data for
The krishnas' setup"*.

Household names must be truncated at 24 characters with an ellipsis in navigation contexts
(sidebar, bottom nav strip, switcher chip) to prevent overflow. Full names are shown in household
settings and the profile page.

### §7.5 Member attribution display (NEW)

The `logged_by_user_id` attribution in the brew log list and detail views must show
`User.display_name`, never the `User.id` UUID. If the `User` record is no longer accessible (e.g.,
the member was removed), display the fallback string *"Former member"* in `text-stone-400/70`.

---

## §8 Roles & Permissions Matrix

**Auth gate:** Access to all household-scoped data and write actions is gated by a valid JWT (any
registered user) + household membership check. A user with a valid JWT but no household membership
may only access the household creation wizard (`/welcome`) or accept a pending invite. An
unauthenticated visitor may only access the household in read-only guest mode if a valid `GuestToken`
key is present in the URL.

> **`ALLOWLIST_EMAILS` — deprecated in v2.0.** The email allowlist has been replaced by the
> household invitation system. Remove this env var from new deployments.

The following table is the authoritative reference for what each role may do within a household.
Server-side enforcement applies to all rows marked with ✅ in the "Enforced server-side" column.
UI visibility rules follow from the server-side rules but are not a substitute for them. The `Guest`
column applies to unauthenticated visitors accessing the household via a valid `GuestToken` URL; they
hold no `HouseholdMembership` row.

| Action | Admin | Member | Guest | Enforced server-side | Notes |
|--------|-------|--------|-------|----------------------|-------|
| **Household data — read** | | | | | |
| View dashboard (active bags) | ✅ | ✅ | ✅ | — | Guests see read-only dashboard |
| View brew log list + detail | ✅ | ✅ | ✅ | — | |
| View catalog | ✅ | ✅ | ✅ | — | |
| View hardware + maintenance | ✅ | ✅ | ✅ | — | |
| **Brew log — write** | | | | | |
| Log a new shot | ✅ | ✅ | ❌ | — | Both roles can log shots |
| Edit own shot (within 24 h) | ✅ | ✅ | ❌ | ✅ | Member may only edit shots they logged |
| Edit any shot | ✅ | ❌ | ❌ | ✅ | Admin may edit any shot in the household |
| Delete own shot (within 24 h) | ✅ | ✅ | ❌ | ✅ | |
| Delete any shot | ✅ | ❌ | ❌ | ✅ | |
| **Catalog — write** | | | | | |
| Add catalog entry (manual or AI-inferred) | ✅ | ✅ | ❌ | — | Catalog management is not restricted |
| Edit catalog entry | ✅ | ✅ | ❌ | — | |
| Delete catalog entry | ✅ | ❌ | ❌ | ✅ | Members cannot delete catalog entries |
| **Inventory — write** | | | | | |
| Add bag | ✅ | ✅ | ❌ | — | |
| Mark bag as finished | ✅ | ✅ | ❌ | — | |
| Delete bag | ✅ | ❌ | ❌ | ✅ | |
| **Hardware — write** | | | | | |
| Add hardware item | ✅ | ✅ | ❌ | — | |
| Edit hardware name | ✅ | ✅ | ❌ | — | |
| Delete hardware item | ✅ | ❌ | ❌ | ✅ | |
| Log maintenance event | ✅ | ✅ | ❌ | — | |
| Delete maintenance event | ✅ | ❌ | ❌ | ✅ | |
| **Bootstrap import wizard** | | | | | |
| Run bootstrap import | ✅ | ❌ | ❌ | ✅ | Members cannot see the import route |
| **Household membership — management** | | | | | |
| Invite a new member | ✅ | ❌ | ❌ | ✅ | |
| Revoke a pending invitation | ✅ | ❌ | ❌ | ✅ | |
| Resend an expired invitation | ✅ | ❌ | ❌ | ✅ | |
| Remove a member | ✅ | ❌ | ❌ | ✅ | Admin cannot remove themselves |
| Promote member to admin | ✅ | ❌ | ❌ | ✅ | Any existing admin may promote |
| Demote admin to member | ✅ | ❌ | ❌ | ✅ | Cannot demote self if last admin; system enforces ≥1 admin |
| View member list | ✅ | ✅ | ❌ | — | Both roles can see who is in the household |
| **Guest access** | | | | | |
| Generate guest link | ✅ | ❌ | ❌ | ✅ | |
| Revoke guest link | ✅ | ❌ | ❌ | ✅ | |
| **Household settings** | | | | | |
| Update household name | ✅ | ❌ | ❌ | ✅ | |
| Delete household | ✅ | ❌ | ❌ | ✅ | Requires confirmation modal + name re-entry |
| **User / session** | | | | | |
| View own profile | ✅ | ✅ | ❌ | — | |
| Switch active household | ✅ | ✅ | ❌ | — | Any user with multiple memberships |
| Create a new household | ✅ | ✅ | ❌ | — | Any authenticated user may create a household; they become its admin |
| Sign out | ✅ | ✅ | ❌ | — | |

---

## §9 Preserved UX Patterns (What Does Not Change)

v2.0 is intentionally additive. Every UX pattern from v1 (§4 of `functional-spec.md` v6.0) is
preserved without modification. This section exists so a new engineer can quickly understand the
boundary between what is new and what is inherited.

### 9.1 Visual design system (preserved)

- **DaisyUI theme:** `espresso-dark`; amber/dark palette; Playfair Display + Inter typography.
- **Frosted-glass main panel:** `#main-content` with `backdrop-filter`; full-bleed section background photographs.
- **Chip/badge tokens:** amber-variant (`bg-amber-900/25 text-amber-300 border border-amber-600/30`) and stone-variant (`bg-stone-900/30 text-stone-400 border border-stone-600/30`) — no new variants introduced.
- **FAB pattern:** circular `btn-circle btn-lg`, `fixed bottom-20 right-4 md:bottom-6 md:right-6`, amber fill — no change to which views require a FAB.
- **Page transition contract:** 120 ms `ease-out` fade-in on `.page-content`; suppressed when `prefers-reduced-motion` is set.
- **Back navigation:** always `← Back` text label; never an SVG-only chevron; `?back=` contract unchanged.

### 9.2 Brew log (preserved)

- Smart defaults: last-shot prefill → same-roaster fallback → roast-profile fallback.
- Four required fields on the add-shot form: `Yield_Out_g`, `Time_Sec`, `Shot_Eligibility`, `Taste_Summary`.
- `Shot_Eligibility` is always user-selected (never auto-inherited).
- List view: frosted-glass cards; date, bean name, roast level, dose/yield/time, eligibility badge, taste summary.
- Detail view: shot date as title; "Roaster — Bean name" subtitle; AI feedback block below parameters; internal IDs never shown.

### 9.3 Extraction Compass (preserved)

- Chart.js scatter plot with yield (x-axis) and extraction time (y-axis).
- Four quadrants labelled with `Taste_Summary` enum values in sentence case.
- Clicking a quadrant sets `Taste_Summary` on the add-shot form.
- Calibration image at `/static/img/compass-guide.png` always shown alongside.
- Chart.js lazy-loaded in the compass component only — not at app root.

### 9.4 Catalog (preserved)

- Responsive card grid: 4 columns desktop / 2 columns mobile.
- Two-letter monogram (roaster initial + bean name initial) when no image is present.
- Master-detail split on desktop; full-page on mobile.
- AI-inferred catalog entry from product URL (`POST /api/catalog/infer`).
- `Catalog_ID` is never shown in the UI.

### 9.5 Hardware & maintenance (preserved)

- Two-column layout: fixed left panel (hardware list by category) + right panel (detail).
- Crossfade transition on hardware card selection — no full navigation.
- Maintenance timeline as chronological list; `Hardware_ID` values never shown.
- Maintenance log entry minimum spacing: `py-3`.

### 9.6 Import wizard (preserved)

- Three-step flow: Upload → Preview → Done.
- Centred layout: `max-w-2xl mx-auto`.
- File input placeholder: "No file selected" (sentence case).
- LLM mapping for subjective divergence; human review step for enum mismatches.

### 9.7 Non-functional requirements (preserved)

- NFR-P1 through NFR-P6: performance budget, navigation SLA, transition fps, cold start, self-hosted assets.
- NFR-D1 through NFR-D5: deployability, Terraform example, `DEPLOY.md`, graceful missing `SPREADSHEET_ID` (now `DATABASE_URL`).
- All display rules: no internal IDs in UI, sentence case everywhere, consistent enum rendering.

### 9.8 AI inference (preserved)

- Single LLM provider per deployment (Gemini Flash default; Anthropic adapter).
- Prompt payload unchanged: current shot row + historical non-reject shots for `Bag_ID` + temporal hardware maintenance events.
- Fire-and-forget: shot row written first; UI polls for `AI_Feedback`.
- `Zone_Taste` field persisted to `BrewLog`; `machine_name`, `basket_name`, `roast_level` passed as `extra_context`.

---

## Appendix A — MVP Scope vs. Future Phases

This section documents which features are in scope for v2.0 MVP and which are deferred.

### In scope (v2.0 MVP)

- Multi-household data model with full household isolation
- Dual-path auth: username+password registration and login (no email required)
- Optional "Sign in with Google" as a parallel auth path (not required)
- Household admin-assisted password reset (no SMTP, no self-serve reset link)
- Read-only guest household URL (admin-generated; no write access without authentication)
- Multiple admins per household (co-owner model)
- Role promotion/demotion (`PATCH /households/members/{id}`)
- Household creation (first-run wizard + `/household/new`)
- Invitation flow: token-based, 72 h expiry; `invited_email` nullable (link-only invites supported)
- Invitation acceptance flow
- Household switcher (for multi-household users)
- Admin, member, and guest roles with server-side enforcement
- Household settings (name edit, member list, remove member, promote/demote, pending invitations, guest link, delete household)
- Profile page (view-only account details, household list, sign out)
- Bootstrap import wizard scoped to active household
- All v1 UX patterns (dashboard, brew log, catalog, hardware, extraction compass) extended to
  household scope
- AI inference scoped to household data

### Deferred (not in v2.0 MVP)

| Feature | Rationale |
|---------|-----------|
| Household ownership transfer | Edge case; deferred until a concrete need arises |
| Per-member read-only mode | Both roles can log shots in MVP; read-only member variant adds UI complexity for marginal value |
| Push notifications (invitation received, AI feedback ready) | Requires native app or PWA push service setup; deferred to native app phase |
| Household analytics (cross-member statistics) | Deferred; single-household analytics are already handled by the AI inference layer |
| Public household discovery | Out of scope permanently; this is a private household app, not a social platform |
| Two-factor authentication | Google OAuth provides it natively for OAuth users; deferred for username+password accounts |

---

## Appendix B — Data Migration Notes (v1 Sheets → v2 Database)

For operators upgrading an existing v1 (Sheets-based) deployment to v2.0:

1. **Export** all five Sheets tabs to CSV using the provided `scripts/export_sheets.py` migration
   helper.
2. **Provision** the v2.0 relational database (see `DEPLOY.md` §v2-migration).
3. **Create** the founding household record. The `SPREADSHEET_ID`-configured user becomes the
   founding admin.
4. **Import** all exported CSV data using `scripts/migrate_v1_to_v2.py`, which assigns all rows
   to the founding household and maps the `Shot_ID` sequence to household scope.
5. **Verify** row counts match the Sheets export before decommissioning Sheets access.
6. The v1 Sheet is not deleted automatically. Operators are advised to retain it as a read-only
   archive for at least 30 days.

The v1 allowlist (`ALLOWLIST_EMAILS`, **deprecated in v2.0**) is not migrated. The founding admin
must invite v1 users via the new invitation flow. Their historical shot attributions
(`logged_by_user_id`) are set to the founding admin's `User.id` during migration (since v1 had no
per-user attribution); this is documented in the migration output log.
