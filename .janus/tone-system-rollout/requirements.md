# Requirements — tone-system-rollout

Migration ledger item **L4** (spec-043 tone-system rollout): migrate the pages still on the old
`StandaloneHouseholdShell` / `components/ui` stack onto the tone system. Frontend-only. Presentation
migration — no new behavior, no contract change. Scope granularity **Option B** (one FR per page,
operator-decided 2026-07-06): each page is its own core FR with its own done-when check.

## Functional requirements

**What "migrate a page" means** (applies to every FR — this is a full internal conversion, not just
the outer shell): (a) correct tone shell (`FormPageShell`/`TakeoverCard`/`ToneStateCard`, or none for
the in-place FR7/FR8), wrapped in `ToneProvider`; (b) **every `components/ui` primitive on the page is
replaced by its tone-system equivalent** — CTAs/buttons → `ToneButton`/`ToneLinkAction`;
`Input`/`Select`/`Textarea` → `ToneInput`/`ToneSelect`/`ToneTextarea`; `FormField` → `EntityFormSection`/
`FormSection` (+ `EntityFormActions` for CTA rows); `Badge` → `Chip`; `GlassCard` → `EntityCard`/
`TakeoverCard`/`ToneStateCard`; `PageHeader` → `ListPageHeader`/`DetailHeader`/`TitleBlock`; (c) renders
under both `ToneToggle` states without a `useTone()`-outside-provider throw, with functional parity (NFR1).

**Structural done-when (per FR, greppable):** the migrated page has **no import from
`../components/ui` and no `StandaloneHouseholdShell`** — this makes a half-migration (tone shell around
old buttons/inputs) a hard failure. Paths under `frontend/src/pages/`.

⚠ **OPEN → design:** `LayerTransition` (used by FR1–FR5, FR9–FR11) has no tone component; migrated pages
replace its behavior with the `useKaapiMotion` route-enter pattern (`lib/motion.ts`). The exact
replacement is a design-stage motion decision, not a 1:1 swap.

- **FR1** — `Login.tsx` → `FormPageShell` + tone form atoms (`ToneInput/ToneSelect/ToneButton`). Preserve login submit, OAuth interstitial, and 401/429 handling.
- **FR2** — `Register.tsx` → `FormPageShell` + tone form atoms. Preserve registration submit + field validation.
- **FR3** — `Welcome.tsx` → `FormPageShell` + tone form atoms. Preserve first-run create-household.
- **FR4** — `HouseholdNew.tsx` → `FormPageShell` + tone form atoms. Preserve create-additional-household.
- **FR5** — `InviteAccept.tsx` → `TakeoverCard` + tone atoms. Preserve invite preview + accept/decline.
- **FR6** — `HouseholdGuestView.tsx` → `TakeoverCard`/`ToneStateCard`. Preserve read-only guest-token view.
- **FR7** — `HouseholdSettings.tsx` → tone atoms in place (no shell swap; renders inside `AppShell`). Preserve ALL admin actions: rename, delete, invitations (create/resend/revoke), member roles, guest tokens.
- **FR8** — `Profile.tsx` → tone atoms in place (no shell swap; inside `AppShell`). Preserve the memberships list.
- **FR9** — `InviteExpired.tsx` → `ToneStateCard` (`not-found`/`error` state). Preserve message + link.
- **FR10** — `InviteInvalid.tsx` → `ToneStateCard`. Preserve message + link.
- **FR11** — `NotFound.tsx` → `ToneStateCard` (no shell today). Preserve 404 message + link.

**Amended 2026-07-07** (mid-build, operator running-instance eval):
- **FR12** — `Dashboard.tsx` first-run empty state. When the active household has **zero** beans/bags AND **zero** shots, suppress the "Active bags" and "Recent shots" section headers and their "View all →" links; render only the "No coffee data yet" message with the Add-first-bag / Import-CSV CTAs. The section headers + "View all →" reappear as soon as any bag or shot exists. (Not a tone migration — a first-run information-architecture fix surfaced during the tone-rollout eval.)

**Below the line:** none — all 11 tone-migration FRs are core (Option B). The cost (lines + wall-clock) is accepted.

Build sequencing is a design-stage concern; proposal: shake out the shell/atom pattern on a minimal
page (FR11 `NotFound`) before the 569-line FR7 `HouseholdSettings`.

## Non-functional requirements

- **NFR1 — Functional parity, zero regression** (per page). Each migrated page keeps its route, every
  field, validation rule, submit path, and error/auth behavior. *Evidence:* the co-located
  `PageName.test.tsx` (Vitest + testing-library) passes for every migrated page. The 4 pages with no
  test today — `HouseholdNew`, `InviteExpired`, `InviteInvalid`, `NotFound` — get a co-located test as
  part of their migration. This is the per-task done-when spine (each FR's `scripts/checks/tN.sh`).
- **NFR2 — Design-token compliance.** No hardcoded colors or frost; `npm run test:tokens` passes (it
  runs first in `npm test`). Children must NOT duplicate the shell's 24px blur — frost is CSS-driven via
  `data-tone` (tone-system Principle 3), not a child prop.
- **NFR3 — Tone integrity.** Every migrated page wraps its content in `ToneProvider` and renders under
  both `ToneToggle` states (dark/beige) with no `useTone()`-outside-provider throw.
- **NFR4 — No contract drift.** No new network calls; identity stays from the auth context/session,
  never request bodies. Migration is presentation-only.

*Verify-provability (stated for the sign-off):* NFR1/NFR2/NFR3 are provable in-env — Vitest suite +
`test:tokens` + a running instance under both tones. NFR4 is a negative ("no new API") — provable by
inspection/diff, not a load test.

## Capacity estimation

N/A: no quantity here changes the design — presentation migration, existing data volumes.

## Core entities

N/A: no new persisted nouns. Pages consume existing ones unchanged — Household, Membership, Invitation,
GuestToken, User.

## API / system interface

N/A: no contract change. Pages call existing endpoints unchanged (households create/rename/delete;
invitations create/resend/revoke/accept; auth login/register; guest-token read). Listed only for FR
traceability; nothing is added, and identity comes from auth/session (NFR4), not request bodies.

## Data flow

N/A: not pipeline-shaped.
```
