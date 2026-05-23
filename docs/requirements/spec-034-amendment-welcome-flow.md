# Spec-034 Amendment — Welcome Onboarding Flow
**Status:** draft
**Date:** 2026-05-23
**Author:** Priya
**Supersedes:** auto-seed behaviour in `api_auth.py` (`seed_default_household_if_needed`)

---

## Problem

The current implementation of `api_auth.py` includes a helper
`seed_default_household_if_needed` (lines 136–140) that automatically creates a
default "Home" household for every newly registered or logged-in user who has no
existing membership. This silently grants every new user a household without their
explicit consent, bypassing the onboarding wizard described in the functional spec.

The functional spec (v2.0, §4.12.1) mandates that a user who signs in for the first
time and has **no** `HouseholdMembership` row must be redirected to `/welcome` — an
explicit two-step onboarding wizard — instead of being silently assigned to a
household. The auto-seed behaviour contradicts this requirement in three ways:

1. It prevents the `/welcome` wizard from ever being reached by a fresh user.
2. It skips the user-choice between "create household" and "accept an invitation".
3. It creates a household named "Home" rather than one named by the user.

Additionally, NFR-D8 (§6.2, line 1000) requires the _application_ to present the
onboarding prompt on first startup with no `User` rows — not the auth layer to
silently seed data.

This amendment defines the authoritative product behaviour for the `/welcome` page,
first sign-in redirect logic, zero-membership state, household creation from
onboarding, and invite-token acceptance during registration.

---

## User Stories

All stories are sourced from §4.12 (lines 597–791) of `functional-spec-v2.md`.

### US-WF-01 — New user, no invite (username+password registration)
> As a newly registered user (via `/register`, no `?invite=` token present), after
> my account is created and a JWT is issued, I am redirected to `/welcome` and
> presented with the onboarding wizard. I must choose to either create a household
> or receive instructions for joining one via an invite link, before I can access
> any household-scoped page in the app.
>
> *Source: §4.12.1 lines 602–627; §4.12.4 Flow A lines 735–748.*

### US-WF-02 — New user, no invite (first-time Google OAuth sign-in)
> As a user who signs in with Google for the very first time (no existing `User`
> record, no existing membership), I am redirected to `/welcome` after my account
> is created. The wizard experience is identical to US-WF-01.
>
> *Source: §4.12.1 lines 603–607 ("This applies to both username+password
> registrations and first-time Google OAuth sign-ins.").*

### US-WF-03 — New user with invite token in registration URL
> As a newly registered user who arrived at `/register?invite=<token>`, after my
> account is created and the token is validated server-side, I am automatically
> added to the invited household (membership created, token consumed) and redirected
> directly to the household dashboard — I do **not** see the `/welcome` wizard.
>
> *Source: §4.12.1 lines 712–714 ("If this was their first membership, they bypass
> the `/welcome` wizard and land directly on the dashboard for the new household.");
> §4.12.4 Flow A lines 744–747; Flow D lines 786–788.*

### US-WF-04 — New user with invite token in login URL
> As an existing user who clicks `/invite/accept?token=<token>` while not signed in,
> I am redirected to `/login?invite=<token>`. After I log in, the invite is
> automatically applied and I am redirected to the invited household's dashboard —
> the `/welcome` wizard is not shown.
>
> *Source: §4.12.3 Step 2 lines 697–699; Flow D lines 784–786.*

### US-WF-05 — Returning user with memberships visiting `/welcome`
> As a returning user who already belongs to at least one household, if I navigate
> to `/welcome` directly (e.g., by typing the URL), I am immediately redirected to
> the dashboard without being shown the wizard.
>
> *Source: §4.12.1 lines 637–639 ("Re-entry guard"); AC-ONB-04 line 644.*

### US-WF-06 — User who lost all memberships (zero-membership state)
> As an authenticated user whose only household was deleted (or who was removed
> from every household they belonged to), the app detects the zero-membership state
> and redirects me to `/welcome` to create or join a new household. My session is
> cleared of any stored active-household reference before the redirect.
>
> *Source: §4.14 lines 866–871 ("If the user now has zero household memberships …
> the session is cleared of any active household reference and the user is redirected
> to `/welcome` to create or join a new household.").*

### US-WF-07 — New user creates a household via the onboarding wizard
> As a new user on the `/welcome` wizard Step 2a, I can type a name for my
> household (max 64 chars) and submit it. On success the household is created, I am
> set as its `admin`, and I am redirected to the dashboard for the new household.
>
> *Source: §4.12.1 Step 2a lines 621–627.*

### US-WF-08 — New user selects "I have an invitation"
> As a new user on `/welcome` Step 1 who clicks "I have an invitation", I am
> taken to Step 2b, which shows me instructions to ask a household admin to share
> an invitation link with me. No manual token entry field is shown; invitations are
> always accepted via the link. I can navigate back to Step 2a from Step 2b.
>
> *Source: §4.12.1 Step 2b lines 629–635.*

---

## Acceptance Criteria

All acceptance criteria must be independently testable. Criteria are drawn from
§4.12.1 (lines 640–644), §4.12.3 (lines 723–729), and §4.14 (lines 877–883) of
`functional-spec-v2.md`, supplemented with the upstream §4.12.4 auth flow
requirements (lines 735–791) and §8 role/access matrix (lines 1122–1186).

---

### Group A — `/welcome` page routing

**AC-WF-A01** *(≡ AC-ONB-01, line 641)*
Given a user who has just registered or signed in for the first time (by any auth
method) and has zero `HouseholdMembership` rows,
when the auth endpoint issues a JWT,
then the API response must include `redirect: "/welcome"` (or equivalent redirect
signal), and the frontend must navigate the user to `/welcome`, not to the
dashboard.

**AC-WF-A02** *(≡ AC-ONB-04, line 644)*
Given a user who already has at least one `HouseholdMembership` row,
when that user navigates to `/welcome`,
then the frontend must immediately redirect them to the household dashboard
without rendering any part of the onboarding wizard.

**AC-WF-A03** *(derived from §4.14 lines 866–871)*
Given an authenticated user whose last household membership has just been removed
(or the household has been deleted),
when the user makes any subsequent request that would normally resolve an active
household from their session,
then the server must clear the active-household reference from the session and
return a redirect to `/welcome`.

---

### Group B — Step 1: Welcome screen

**AC-WF-B01**
Given a new user on the `/welcome` page (zero memberships),
when the page loads,
then the heading "Welcome to Coffee Tracker" and the body copy described in §4.12.1
(line 613–619) must be visible.

**AC-WF-B02**
Given a new user on Step 1 of `/welcome`,
when the user clicks "Create my household",
then the wizard navigates to Step 2a (the household-creation form) within the same
page route, without a full navigation.

**AC-WF-B03** *(≡ AC-ONB-03, line 643)*
Given a new user on Step 1 of `/welcome`,
when the user clicks "I have an invitation",
then the wizard navigates to Step 2b (invite instructions), which must display:
- the instruction text from §4.12.1 line 631,
- the body copy from §4.12.1 line 633,
- a back link labelled "← Create a new household instead" that returns the user to
  Step 2a.

---

### Group C — Step 2a: Create household

**AC-WF-C01** *(≡ AC-ONB-02, line 642)*
Given a new user on Step 2a of `/welcome`,
when the user types a household name (1–64 chars) and clicks "Create household",
then:
- a `POST /api/households` (or equivalent endpoint — see API Contract §) request is
  made with the entered name,
- the response creates a `Household` row and a `HouseholdMembership` row with
  `role = "admin"` for the current user,
- the user is redirected to the household dashboard for the newly created household.

**AC-WF-C02**
Given a new user on Step 2a,
when the user submits the form with an empty household name,
then the form must show an inline validation error and must not submit.

**AC-WF-C03**
Given a new user on Step 2a,
when the user submits the form with a household name exceeding 64 characters,
then the form must show an inline validation error and must not submit.

**AC-WF-C04** *(from §4.12.1 line 626–627)*
The Step 2a form has no "Skip" option. The user must create or join a household
before being permitted to access any household-scoped route.

---

### Group D — Step 2b: Accept invitation (instructions only)

**AC-WF-D01**
Given a new user on Step 2b,
when the page renders,
then no token-entry field must be visible. The page shows instructions only
(see §4.12.1 Step 2b, lines 630–635).

**AC-WF-D02**
Given a new user on Step 2b,
when the user clicks "← Create a new household instead",
then the wizard returns to Step 2a without a page reload.

---

### Group E — Invite-token acceptance during registration / login

**AC-WF-E01** *(≡ AC-ACC-01, line 724; §4.12.4 Flow D lines 786–788)*
Given a user who opens `/register?invite=<valid_token>`,
when the user completes registration,
then:
- the server validates the token (not expired, not already accepted),
- creates the `User`,
- creates a `HouseholdMembership` for the invited household,
- sets `Invitation.accepted_at = now()` (token consumed),
- issues a JWT,
- returns a redirect to the household dashboard — NOT to `/welcome`.

**AC-WF-E02** *(§4.12.4 Flow D lines 784–786)*
Given an unauthenticated user who opens `/invite/accept?token=<valid_token>`,
when the token is valid,
then the server redirects to `/login?invite=<token>`. After successful login the
invite is applied automatically and the user is redirected to the household
dashboard.

**AC-WF-E03** *(§4.12.3 Step 1, lines 692–694)*
Given any user who opens `/invite/accept?token=<invalid_token>` (token does not
exist in the database),
then the server must redirect to `/invite/invalid`.

**AC-WF-E04** *(§4.12.3 Step 1 lines 692–694; NFR-IS2, line 1038–1040)*
Given any user who opens `/invite/accept?token=<expired_token>` (`expires_at <=
now()`),
then the server must redirect to `/invite/expired`. The expiry check must be
evaluated on the server at the time of acceptance, not only at token generation
time.

**AC-WF-E05** *(NFR-IS3, lines 1042–1044)*
Given any user who opens `/invite/accept?token=<already_accepted_token>`,
then the server must return HTTP 409 (Conflict) or redirect to the dashboard
(idempotent accept — see §4.12.3 Step 1 line 694).

**AC-WF-E06** *(§4.12.3 Step 4 lines 712–714)*
Given an invitee who accepts a valid invite and already had at least one other
membership,
when acceptance completes,
then their active household context is switched to the newly joined household.

**AC-WF-E07** *(NFR-IS4, line 1046–1048)*
The invitation URL passed to the client must contain only the token. It must not
encode the invited email, household name, or any other PII in the URL path or
query string.

---

### Group F — Zero-membership guard on protected routes

**AC-WF-F01** *(§8, lines 1124–1127)*
Given an authenticated user with a valid JWT but zero `HouseholdMembership` rows,
when that user requests any household-scoped endpoint (e.g., `GET /api/brew-log`,
`GET /api/catalog`),
then the server must return HTTP 403 or equivalent, and the frontend must redirect
the user to `/welcome`.

**AC-WF-F02**
Given the same zero-membership user,
they must be permitted to:
- `POST /api/households` (create a household), and
- `GET /invite/accept?token=<valid>` (accept a pending invite).
These two paths must not be blocked by the membership guard.

---

### Group G — Display / UX rules

**AC-WF-G01** *(§7.2 sentence case rule, lines 1085–1095)*
All text on `/welcome`, Steps 2a and 2b must use sentence case. No heading,
label, button text, or copy on these screens may use title case unless the
word is a proper noun.

**AC-WF-G02** *(§7.1 internal IDs, line 1068 ff.)*
No internal identifier (`User.id`, `Household.id`, token value) must be rendered
in visible page content on any onboarding screen.

---

## API Contract

All endpoints listed are new or changed relative to the current `api_auth.py`
implementation. No application code is changed by this spec — this section
describes the **target** contract.

### Backend changes (api_auth.py, deps.py)

#### REMOVE: auto-seed on register and login

The helper `seed_default_household_if_needed` (api_auth.py lines 136–140) and
its call sites (lines 173 and 226) must be removed.

After removal:
- `POST /auth/register` (no invite token): creates `User`, issues JWT, and the
  response body must include a field (or HTTP redirect header) signalling the
  client to navigate to `/welcome`.
- `POST /auth/login` (no invite token, zero memberships): issues JWT; same
  `/welcome` signal.

[NEEDS_CLARIFICATION]: The spec does not specify whether the "redirect to /welcome"
signal is communicated via a field in the JSON response body (e.g.,
`"onboarding_required": true`), an HTTP 302 redirect from the backend, or purely
frontend logic based on the memberships array returned by `GET /auth/me`. The
current `MeOut` schema already includes `memberships: list[MembershipSchema]`
(lines 116–118 of api_auth.py); the frontend could infer zero-membership state
from an empty list and navigate accordingly. The spec is silent on which mechanism
is canonical.

#### CHANGE: POST /auth/register — with invite token

```
POST /auth/register?invite=<token>

Request body:
{
  "username": "<string>",
  "password": "<string>",
  "display_name": "<string | null>"
}

On success (201 Created):
{
  "access_token": "<jwt>",
  "token_type": "bearer",
  "user": { "id": ..., "username": ..., "display_name": ..., "email": null, "picture_url": null },
  "redirect": "/dashboard"   // [NEEDS_CLARIFICATION] — field name/mechanism TBD
}
```

Error codes:
- `409 Conflict` — username already taken (existing behaviour, unchanged)
- `410 Gone` — invite token expired (NFR-IS2)
- `409 Conflict` — invite token already accepted (NFR-IS3)
- `404 Not Found` — invite token does not exist → redirect to `/invite/invalid`
  (§4.12.3 line 692)

#### NEW: POST /api/households — create household from onboarding

[NEEDS_CLARIFICATION]: The spec (§4.12.1 Step 2a, lines 621–627) mandates that
submitting Step 2a "creates" the household and sets the user as admin, but does
not define a new dedicated endpoint for this action. The existing
`app/routers/api_households.py` may already expose `POST /api/households` for
household creation. This amendment defers the endpoint signature to the
households router spec; it only requires that:

- The endpoint is accessible to an authenticated user with zero memberships (i.e.,
  the membership guard must not block it — see AC-WF-F02).
- On success the endpoint returns `household_id`, `name`, and `role = "admin"` in
  the response so the frontend can immediately set the active household context.
- HTTP 422 must be returned if the household name is empty or exceeds 64 chars
  (§4.11.1 line 545: "Editable `name` field, max 64 characters").

#### CHANGE: GET /auth/me — zero-membership signal

The existing `MeOut.memberships` list (api_auth.py lines 116–118) already conveys
membership state. The frontend must treat `memberships == []` as the signal to
redirect to `/welcome`. No schema change is strictly required.

[NEEDS_CLARIFICATION]: The spec does not state whether `GET /auth/me` should return
a dedicated boolean field such as `"onboarding_required": true` in addition to
(or instead of) the empty memberships list, to make the frontend branch condition
more explicit.

#### CHANGE: deps.py — active-household resolution fallback

The active-household resolver in `deps.py` (invoked on every household-scoped
request) must handle the case where the session-stored `household_id` references a
membership that no longer exists (membership removed or household deleted):

- Clear the stale `household_id` from the server-side session.
- If the user has other memberships, fall back to the first alphabetically by
  `Household.name` (§4.14 lines 865–868).
- If the user has **zero** memberships after the fallback attempt, return HTTP 403
  (or equivalent signal) and clear the session's active-household reference.
  The frontend must interpret this as a redirect to `/welcome` (AC-WF-A03,
  AC-WF-F01).

*Source: §4.14 lines 862–871.*

---

### Frontend: /welcome page behaviour and redirect rules

#### Route: `/welcome`

**Render guard (client-side):**
- If `GET /auth/me` returns a non-empty `memberships` list, immediately redirect
  to the household dashboard. Do not render the wizard. *(AC-WF-A02)*
- If the user is not authenticated, redirect to `/login`. *(§8 lines 1122–1127)*

**Step 1 — Welcome screen:**
- Heading: "Welcome to Coffee Tracker" *(§4.12.1 line 614)*
- Body: "Coffee Tracker is a household app. You'll need to either create a new
  household or accept an invitation from a friend." *(§4.12.1 lines 615–617)*
- Primary CTA: "Create my household" → advances to Step 2a.
- Secondary CTA: "I have an invitation" → advances to Step 2b.
- Both CTAs are always visible; there is no "Skip" option. *(§4.12.1 line 626–627)*

**Step 2a — Create household:**
- Single text input labelled "What should we call your household?" with placeholder
  "e.g. The Krishnas' Setup" and `maxlength=64`. *(§4.12.1 lines 622–623)*
- Submit button: "Create household". *(§4.12.1 line 624)*
- On success: navigate to the dashboard for the new household. *(§4.12.1 line 625–627)*
- Inline validation: required field; max 64 chars. *(AC-WF-C02, AC-WF-C03)*

**Step 2b — Accept invitation instructions:**
- Instruction text: "Ask a household admin to share an invitation link with you,
  then click that link to be added to their household." *(§4.12.1 line 631)*
- Body copy: "The admin can generate an invitation link from their household
  settings — no email address required." *(§4.12.1 lines 632–634)*
- Back link: "← Create a new household instead" → returns to Step 2a. *(§4.12.1 line 634)*
- No token entry field. *(§4.12.1 line 635)*

**Redirect rules summary:**

| Condition | Destination |
|-----------|-------------|
| New user, no invite, just registered or signed in | `/welcome` |
| New user, `?invite=<valid_token>` present at register | household dashboard (bypass `/welcome`) |
| Authenticated user visits `/welcome` with ≥1 membership | household dashboard |
| Zero-membership user requests any household-scoped page | `/welcome` |
| User's last household deleted / membership removed | session cleared → `/welcome` |
| First-time Google OAuth sign-in, no membership | `/welcome` |

*Sources: §4.12.1 lines 603–639; §4.12.4 lines 735–748; §4.14 lines 866–871.*

---

## Data Changes

No new database columns or migrations are introduced by this amendment. All
required tables and columns (`Household`, `HouseholdMembership`, `User`,
`Invitation`) are defined in §1.1 (lines 108–177) of `functional-spec-v2.md` and
are assumed to exist as part of the M5 milestone database schema.

The only data-layer change is **behavioural**:
- Remove the call to `HouseholdRepo().seed_default_household()` that is currently
  invoked at registration and login time.
- The `seed_default_household` method in `HouseholdRepo` may remain in the
  repository for use by NFR-D8's first-startup bootstrap path (§6.2, line 1000–1003),
  but it must not be called unconditionally on every registration or login.

[NEEDS_CLARIFICATION]: NFR-D8 (§6.2, line 1000–1003) states: "On first startup of
a fresh deployment with no `User` rows, the application must present an onboarding
prompt to the first authenticated user, guiding them to create the first household."
The spec does not specify how "first startup with no User rows" is detected (startup
hook, middleware check, or via the `/welcome` flow itself for the first user). It
is unclear whether this is distinct from the standard zero-membership `/welcome`
flow or requires a separate mechanism. If the `/welcome` flow already handles every
zero-membership user (including the very first user on a fresh deployment), NFR-D8
may be fully satisfied by this amendment with no additional implementation.

---

## Out of Scope

The following items are **explicitly not included** in this amendment:

1. **Invite member flow (admin-initiated)** — fully specified in §4.12.2 (lines
   646–683). This amendment covers the invitee/recipient side only.

2. **Invitation acceptance screen (`/invite/accept` route)** — the confirmation UI
   (Step 3 of §4.12.3, lines 701–715) is a separate feature from the `/welcome`
   onboarding wizard. This amendment defines the redirect rules into and out of
   that screen but does not re-specify its UI.

3. **Google OAuth sign-in implementation** — the OAuth callback handler and token
   exchange are not defined here. This amendment only states that the first-time
   Google OAuth sign-in must result in a redirect to `/welcome` if the user has
   zero memberships (US-WF-02).

4. **`/household/new` route** — the post-onboarding household-creation screen
   accessible from the household switcher (§4.14, line 863) is a separate route
   with identical form behaviour to Step 2a. It is not part of the `/welcome` flow.

5. **Guest access flow (Flow C, §4.12.4)** — unauthenticated read-only guest
   access via `GuestToken` is entirely separate from the onboarding wizard and is
   not addressed here.

6. **Profile page (`/profile`)** — household list display and sign-out (§4.13) are
   not part of the onboarding flow.

7. **Household switcher (`/4.14`)** — the switcher's fallback and redirect behaviour
   overlaps with AC-WF-A03 but the switcher UI itself is out of scope.

8. **Email delivery / SMTP configuration (NFR-D7)** — the transactional email
   pathway for invite delivery is out of scope for this amendment.

9. **Application code changes** — this document is a product/spec artifact only.
   No `app/` source files are modified.

---

## Unresolved `[NEEDS_CLARIFICATION]` items (summary)

1. **Redirect signal mechanism** (API Contract §, "CHANGE: POST /auth/register"):
   The spec does not define whether "redirect to `/welcome`" is communicated via a
   JSON response field, an HTTP redirect from the backend, or purely frontend logic
   inferred from an empty `memberships` list in `GET /auth/me`.

2. **`onboarding_required` field** (API Contract §, "CHANGE: GET /auth/me"):
   The spec does not state whether `MeOut` should expose a dedicated boolean flag
   for the onboarding state, or whether the empty `memberships` list is the sole
   signal.

3. **NFR-D8 first-startup mechanism** (Data Changes §):
   The spec does not clarify whether the zero-membership `/welcome` flow fully
   satisfies NFR-D8 or whether a separate "no User rows" startup detection
   mechanism is required.
