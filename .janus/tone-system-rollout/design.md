# Design — tone-system-rollout

Presentation-only migration of 11 pages onto the existing tone system (spec-043). No backend/API/data
change (NFR4). **Key constraint (adversarial review):** the tone system was built for pages *inside*
`AppShell`; 8 of 11 targets are **standalone** and depend on `StandaloneHouseholdShell` for their auth
backgrounds. Operator decisions: **keep StandaloneHouseholdShell** (D6), **keep AccessibleDialog** restyled
(D7). **Design rework (2026-07-06, from a running-instance eval):** the tone/light-dark mechanism was
misunderstood — a bare `ToneProvider` is inert; pages need a `data-tone` EMITTER (D1/D8). This doc reflects
the correction. Reference for tone controls: `frontend/src/pages/BrewLogAdd.tsx` (0 legacy imports).

## 1. Reuse survey (build-vs-reuse — all reused; nothing new is built)

| Migration mechanism | Reused module (under frontend/src) | Note |
|---|---|---|
| Standalone bg wrapper | `components/StandaloneHouseholdShell` | **kept** on 8 standalone routes (D6); use `align="center"` |
| **Glass surface + tone emitter** | `components/tone-system/TakeoverCard` (`.kk-takeover-card`; self-sets `data-tone`, `TakeoverCard.tsx:22`) | THE liquid-glass card AND a `data-tone` emitter (D1/D8) — the single card for **form** pages only (NOT wrapped around a ToneStateCard, D9) |
| State icon/accent | `components/tone-system/ToneStateCard` (`not-found`/`warning`/`readonly`) | the **single visible card** on status/404 pages; adopts the shared **glass surface** (`--kk-card-surface-*`, D10) so it matches the entity/content cards; needs a `data-tone` ancestor (`TonePageWrapper`) for both the glass tokens AND light/dark — **never nested inside another card** (D9) |
| **Non-card tone emitter** | `TonePageWrapper` (`<div data-tone>`, `TonePageWrapper.tsx:26-40`; no border/glass/shadow) / `ImmersiveListShell` | the `data-tone` ancestor for a bare `ToneStateCard` on status/404 pages, and the Pattern-C emitter |
| Form/control atoms | `ToneInput`/`ToneSelect`/`ToneTextarea`/`EntityFormActions`/`EntityFormSection` | ref `BrewLogAdd.tsx:340-520` |
| CTA button | `ToneButton` (variants); primary link → `<Link className="kk-tc-primary-btn">` (D3) | `ToneLinkAction` is edit-only |
| Badge / card / header | `Chip` / `EntityCard` / `DetailHeader` | control-primitive replacements |
| Confirm dialog | `components/AccessibleDialog` | **kept** (a11y wrapper, not DaisyUI), contents restyled (D7) |
| Route transition | `components/ui/LayerTransition` (kept on standalone) / drop on NotFound | see D2 |
| Tone context | `contexts/ToneContext` `ToneProvider`/`useTone` — provider + a `data-tone` emitter (D1); gains optional `lockedTone` (D11) | ref `BrewLogAdd.tsx:31-39` |
| Test harness | none shared; per-file `vi.mock`+`MemoryRouter`; page self-provides tone so tests don't | ref `Login.test.tsx` |

## 2. Architecture — three migration patterns

Every pattern wraps content in `ToneProvider` **and** renders a `data-tone` emitter (D1) — a bare provider
renders permanently light (the T1–T3 bug). **No card-in-card (D9):** exactly one visible card per page. A
`ToneStateCard` is that one card and must NOT be wrapped in a `TakeoverCard`; its `data-tone` ancestor is the
*non-card* `TonePageWrapper` (`<div data-tone>`, no glass/border/shadow), never a second glass card.

- **Pattern A — standalone pages, keep the shell** (FR1 Login, FR2 Register, FR3 Welcome, FR4 HouseholdNew,
  FR5 InviteAccept, FR6 HouseholdGuestView, FR9 InviteExpired, FR10 InviteInvalid): `StandaloneHouseholdShell`
  + `LayerTransition` stay (auth background/transition), but with **`align="center"`** (`align="left/right"`
  offsets the card into a stray-modal position — the eval finding). Inside: **`ToneProvider lockedTone="dark"`**
  (D11 — standalone pages lock to dark, ignore persisted tone, no on-page `ToneToggle`), then:
  - **Form pages** (FR1/FR2/FR3/FR4): → **`TakeoverCard`** (the single glass card + `data-tone`) holding the
    form atoms: `ToneInput`/`ToneSelect`/`EntityFormActions`; CTAs → `ToneButton`/`<Link className="kk-tc-primary-btn">`;
    badges → `Chip`. One card, no nesting.
  - **Status pages** (FR5/FR6/FR9/FR10): → **`TonePageWrapper`** (non-card `data-tone` emitter) wrapping a
    **single `ToneStateCard`** (`warning`/`readonly`/etc.). No `TakeoverCard` around it (D9 — the rejected
    card-in-card). `TonePageWrapper` supplies the `data-tone` the flat `ToneStateCard` needs to follow tone.
  - **Login/Welcome non-form branches stay siblings** (Login OAuth interstitial `Login.tsx:221-236`; Welcome
    transition `Welcome.tsx:69-74`). Auth frozen (D5).
- **Pattern B — standalone blank takeover** (FR11 NotFound): operator 2026-07-07 — a 404 is EITHER full app
  chrome OR a blank single-card page, never a card floating in a half-shell. Chosen: **blank**. Router hoists
  the `*` route **out of the `AppShell` (`/`) subtree**, kept behind the top-level `ProtectedRoute` (auth
  parity, D5) — no sidebar/nav/toggle. **`ToneProvider lockedTone="dark"`** (D11) → **`TonePageWrapper`** (non-card `data-tone` emitter,
  full-viewport centered background) → a **single `ToneStateCard state=not-found`**. **No `TakeoverCard`, no
  nested card** (D9). Walking skeleton (T1).
- **Pattern C — in-AppShell atom swap** (FR7 HouseholdSettings, FR8 Profile): inside `AppShell`, no shell
  change; `ToneProvider` → a `data-tone` emitter (`TonePageWrapper` or `TakeoverCard`); swap `components/ui`
  + raw DaisyUI for tone atoms; alerts → `ToneStateCard` (nested under the emitter so they follow tone),
  rows → `EntityCard`, **keep `AccessibleDialog`** restyled (D7). Admin actions + role-gating preserved (D5).
  Tests augmented (F7 — see §4).

## 3. Decisions

- **D1 — Each page wraps in `ToneProvider` AND renders a `data-tone` EMITTER.** `App`/`AppShell`/router
  provide no tone (`App.tsx:6-16`, `AppShell.tsx:33-55`); `useTone()` throws without a provider
  (`ToneContext.tsx:68`), so a page self-provides. **Correction (rework):** a bare `ToneProvider` emits NO
  DOM attribute (`ToneContext.tsx:57-61`) — inert for CSS. Light/dark is driven entirely by a `data-tone`
  attribute stamped only by `TakeoverCard`/`TonePageWrapper`/`ImmersiveListShell` (`TakeoverCard.tsx:22`);
  with none in the tree, CSS falls back to `:root` = permanently light (the T1–T3 bug). Every migrated page
  MUST render one of those emitters. **Terminal for this phase:** a future app-level provider promotion must
  delete all self-wraps in the same commit, or toggles desync.
- **D2 — `LayerTransition`: keep on Pattern-A pages, drop on NotFound.** `focusOnEnter` is used by **zero**
  of the 11 pages (grep), so nothing is lost. No motion helper needed.
- **D3 — Primary link CTAs use `<Link className="kk-tc-primary-btn">` inline.** `ToneLinkAction` is edit-only
  and renders a raw `<a>`. No `loading` prop — loading is `disabled` + label swap (EntityFormActions).
- **D4 — Structural done-when (`scripts/checks/_page_migrated.sh`):** page must (a) have no `components/ui`
  CONTROL-primitive import (Button/Input/Select/Textarea/FormField/Badge/GlassCard/PageHeader); (b) have no
  raw DaisyUI control-*variant* class (`alert-*`, `loading-spinner/lg`, `btn-outline/error/ghost/sm/bevel/
  primary` — chosen never to collide with tone's `kk-tc-*-btn` or ARIA `role="alert"`); and **(c) render a
  `data-tone` emitter** (`TakeoverCard`/`TonePageWrapper`/`ImmersiveListShell`/`FormPageShell`/`WizardShell`)
  — a bare `ToneProvider` fails (D1). Kept shells (StandaloneHouseholdShell/LayerTransition/AccessibleDialog)
  allowed. Visual tone-correctness beyond (c) — centering, glass-over-bg — is only provable by the
  running-instance eval (which caught the missing-emitter class the grep could not).
- **D5 — Auth behavior frozen (auth card).** Presentation only: identity/session, Login 401/429 + OAuth
  interstitial, guest-token read-only scope, server-side role authorization preserved verbatim. Per-page test.
- **D6 — Keep `StandaloneHouseholdShell` (operator).** Tone has no standalone/background shell; building one
  is design-system creation beyond a rollout. The 8 standalone pages keep it (with `align="center"`).
- **D7 — FR7 keeps `AccessibleDialog` restyled (operator).** No tone modal exists; kept as an a11y wrapper
  with tone-styled contents. Alerts → `ToneStateCard`, rows → `EntityCard`. Its thin test (1 case, self-only
  admin) is **augmented** (multi-member/non-self fixture: promote/demote, last-admin disable, remove→dialog→
  confirm, delete→dialog→confirm, guest-token generate/revoke, non-admin gate).
- **D10 — `ToneStateCard` adopts the shared glass surface (operator 2026-07-07 eval).** The eval flagged that
  the status/404 card looked/felt different from the home-page & brew-log cards: those (`EntityCard`/`ShotCard`/
  `BagCard`/`TakeoverCard`) use the frosted `--kk-card-surface-*` tokens (translucent + `backdrop-filter`),
  while `.tone-state-card` used the FLAT opaque `--kaapi-content-*` family. Fix (one shared CSS edit,
  `index.css` `.tone-state-card`): repoint its background/border/shadow to `--kk-card-surface-*` + add the
  `backdrop-filter` and the `@supports not` solid fallback (`--kk-card-surface-bg-solid`), text →
  `--kk-text-primary`; **remove the now-redundant `[data-tone="dark"] .tone-state-card` override** since those
  tokens already redefine per `:root`/`[data-tone="dark"]`/`[data-tone="beige"]`. **Cross-feature ripple:**
  `ToneStateCard` is shared — this also restyles **BrewLogList**'s empty/loading/error state cards (already-
  migrated core UI). Layout/accent/`data-state` semantics unchanged; grep+vitest can't see glass, so the
  running-instance eval is the proof. Ticketed as T12 (guards NFR3).
- **D9 — No card-in-card; NotFound is a blank takeover (operator 2026-07-07 eval).** Two decisions from the
  running-instance eval of the amended T1/T2/T3: **(a)** wrapping a `ToneStateCard` inside a `TakeoverCard`
  (two nested visible glass cards) is rejected — status/404 pages render ONE visible card (`ToneStateCard`),
  and the required `data-tone` emitter is the *non-card* `TonePageWrapper` (a `<div data-tone>`, no surface),
  not a second card. Form pages keep a single `TakeoverCard` (glass card holding the form — not a card-in-card).
  **(b)** A 404 is EITHER the full app page (AppShell chrome: sidebar, per-page tone toggle, household switcher)
  OR a blank single-card page — never a card in a half-shell. Chosen: **blank**. `router.tsx` hoists the `*`
  NotFound route out of the `AppShell` (`/`) subtree; it stays behind the top-level `ProtectedRoute` so auth
  behavior is unchanged (D5). Supersedes the prior "Pattern B = in-AppShell TakeoverCard + nested ToneStateCard".
- **D8 — Light/dark IS tone; AppShell pages follow *persisted* tone, not live.** **Superseded for the 9
  standalone pages by D11 (they now lock dark);** D8 governs only the in-AppShell Pattern-C pages (Profile,
  HouseholdSettings) + the app itself. One system: "☀️ Light" is
  `ToneToggle` (Light=beige, Dark=dark); carrier is `data-tone`. A self-providing page reads persisted tone
  (`localStorage['kaapi-tone-preference']`) at mount, so it matches the app tone **on navigation** — L4's
  bar. True *live* global sync (flip on one page → an already-open standalone tab updates) needs promoting
  `ToneProvider` to app level (`data-tone` on `<html>`), which the code defers and which must atomically
  remove all self-wraps. **Out of L4 scope** — tone-architecture follow-up. Status/error pages get no on-page
  `ToneToggle` (odd on a 404); they inherit persisted tone.
- **D11 — Standalone (non-AppShell) pages LOCK to dark (operator 2026-07-07 eval).** The running-instance eval
  of T4 flagged incoherence: a standalone page renders its *persisted* tone (D8), so a beige-persisted user
  lands on a **beige** Welcome/invite/404 card floating on the **dark** coffee-shop background, out of step
  with the (dark) app. Operator picked **force dark**: the 9 standalone pages (FR1 Login, FR2 Register,
  FR3 Welcome, FR4 HouseholdNew, FR5 InviteAccept, FR6 HouseholdGuestView, FR9 InviteExpired, FR10 InviteInvalid,
  FR11 NotFound) render **dark regardless of persisted preference** and expose **no `ToneToggle`**. This
  **supersedes D8** for those pages (D8 now governs only in-AppShell Pattern-C pages + the app). The buttons
  were never wrong — Home's "Log a shot" and Welcome's "Create my household" are the *same* `ToneButton`
  `variant="primary"` (`.kk-tc-primary-btn`); the espresso-vs-amber difference was purely tone (Principle 4).
  **Mechanism (reuse — small extension to the shared provider, no new module):** `ToneProvider` gains an
  optional `lockedTone?: Tone` prop. When set: initial + fixed `tone = lockedTone`; `setTone`/`toggleTone` are
  no-ops; localStorage is **neither read nor written** (a standalone visit never mutates the app's persisted
  preference). Standalone pages wrap in `<ToneProvider lockedTone="dark">`; AppShell/Pattern-C pages keep the
  bare `<ToneProvider>` (follow persisted, D8). Also resolves the earlier NotFound "light/dark wrong" note.
  **Ripple:** shared `ToneProvider` change = **T13**; retrofit the 4 already-built standalone pages
  (NotFound/InviteExpired/InviteInvalid/Welcome) = **T14** — T1/T2/T3/T4 stay `[x]` (their grep+vitest
  done-whens don't assert tone state, same precedent as D10/T12); the pending standalone tasks T5–T9 fold
  `lockedTone="dark"` into their build. Grep can't see tone — running-instance eval is the proof.
- **D12 — Tone form-atom remediation (operator 2026-07-07 eval of T4/T5 form pages).** Two shared-atom
  defects surfaced on the Pattern-A form cards (Welcome/HouseholdNew), affecting all form pages FR1–FR6:
  **(a) ghost button illegible** — `.kk-tc-btn--ghost` (`index.css:2301`) contradicts its own documented
  contract ("text-only, no fill, no border") by setting `background: var(--kk-tc-btn-edit-bg)` + an edit
  border with `color: --kk-text-secondary`, rendering a filled pale-amber block with muted text (fails
  Principle 5 legibility). Fix: conform the CSS to the contract — transparent background, no border, legible
  text (amber `--kk-tc-link` family), keeping the intensify-on-hover rule. **(b) type-scale imbalance** —
  `ToneInput` hardcodes DaisyUI `input-sm` (`ToneInput.tsx:34`, ~0.75rem/2rem) while
  `.entity-form-actions__button` is `1rem`/`2.75rem` (`index.css:3739`), so the field + labels read smaller
  than the CTA. Fix: unify the tone form scale — drop `input-sm` from `ToneInput` (and `ToneSelect`/
  `ToneTextarea` for consistency) so inputs match the 1rem/2.75rem button scale. Both are **shared-atom**
  edits (ToneButton CSS / ToneInput className) rippling to every tone form; ticketed serialized as **T15**
  (guards NFR3). Grep+vitest gate the mechanics; the running-instance eval is the visual proof. No page-code
  change to T4/T5 (they stay `[x]`; same precedent as D10/T12/T14).
  **Refinement (operator 2026-07-08 eval of T15 output):** bare text-only over-corrected — the tertiary read
  as stray text, not a control ("I can't see back"). Revised, superseding (a)'s "no border": the ghost/tertiary
  is an **outlined** button — transparent fill, thin amber `--kk-tc-link` border, legible amber text, intensify
  border+text on hover (Principle 8, no invert). On form pages the tertiary (Cancel / ← Back) moves into the
  `EntityFormActions` action row, **grouped right next to the primary** (the canonical form-action row, already
  right-aligned at ≥640px). Mechanism: `EntityFormActions` gains `secondaryVariant?: ToneButtonVariant`
  (default `'edit'` — backward-compatible for existing consumers; form pages pass `'ghost'`). Re-touches the
  T4/T5 page JSX (move the standalone full-width ghost into the actions row). Ticketed as **T17** (guards NFR3);
  T4/T5/T15 stay `[x]` (grep+vitest don't assert button chrome — running-instance eval is the proof).
- **D13 — FR12 Dashboard first-run empty state (operator 2026-07-07 eval).** Out of the tone-migration set
  (Dashboard is not FR1–FR11) but tracked here per operator. When the active household has zero bags AND zero
  shots, `Dashboard.tsx` suppresses the "Active bags"/"Recent shots" section headers + "View all →" links and
  renders only the existing "No coffee data yet" empty state + Add-first-bag/Import-CSV CTAs. Presentation-only,
  gated on the already-fetched bag/shot counts; no API change (NFR4). Ticketed as **T16** (guards FR12).

## 4. Requirements coverage

- FR1 Login → T7 (A, +D5, OAuth interstitial a sibling). FR2 Register → T6 (A). FR3 Welcome → T4 (A, anchor;
  transition branch a sibling). FR4 HouseholdNew → T5 (A). FR5 InviteAccept → T8 (A). FR6 HouseholdGuestView →
  T9 (A, D5). FR7 HouseholdSettings → T11 (C, D7 + test augmentation). FR8 Profile → T10 (C).
  FR9 InviteExpired → T2 (A, status: TonePageWrapper + single ToneStateCard, D9). FR10 InviteInvalid → T3
  (A, status, D9). FR11 NotFound → T1 (B, blank takeover — out of AppShell, TonePageWrapper + single
  ToneStateCard, D9; walking skeleton).
  **All 9 standalone pages (FR1–FR6, FR9–FR11) lock dark via `ToneProvider lockedTone="dark"` (D11/T13/T14);
  Pattern-C FR7/FR8 stay follow-persisted (D8).**
- **Amended 2026-07-07:** FR12 Dashboard first-run empty state → T16 (D13; out of tone-migration set, tracked here).
- NFR1 parity → per-page `scripts/checks/tN.sh` (import+DaisyUI+emitter grep + vitest); new/augmented tests:
  T1/T2/T3/T5 new, T10/T11 augmented. NFR2 tokens → `test:tokens` in t1 + verify. NFR3 tone integrity →
  emitter (D1) + both-tone render in each page test + running-instance eval (D4/D8) + `ToneStateCard` glass-surface unification (D10/T12) + standalone-page dark lock (D11/T13/T14: `ToneProvider lockedTone` unit test + `data-tone="dark"` assertion on retrofitted pages) + tone form-atom remediation (D12/T15: ghost-button legibility + input/button scale unification, grep on `.kk-tc-btn--ghost`/`ToneInput` + t4/t5 suites green). NFR4 no contract drift →
  verify by diff (no `src/api`/backend change); D5.

## 5. Impact map (per surfaces.md)

| Surface | affected? | why |
|---|---|---|
| Core authenticated tracking UI | affected (indirect) | shared `ToneStateCard` glass surface (D10/T12) restyles **BrewLogList** empty/loading/error state cards; no page-code change there. Shared `ToneProvider` gains `lockedTone` (D11/T13) — **additive/opt-in**: AppShell pages pass no `lockedTone`, so their persisted-tone behavior is unchanged |
| User profile & memberships | affected | FR8 Profile (T10) |
| Auth & onboarding | affected | FR1/FR2/FR3 (T7/T6/T4) |
| Household lifecycle & admin | affected | FR4 create (T5), FR7 settings (T11); import wizard already migrated |
| Invitation & guest access | affected | FR5/FR6/FR9/FR10 (T8/T9/T2/T3) |
| Utility/error pages | affected | FR11 NotFound (T1) — **`router.tsx`: `*` route hoisted out of the AppShell `/` subtree** (D9); still `ProtectedRoute`-gated |
| Backend REST API (FastAPI) | not affected | presentation-only (NFR4, D5) |
| Google Sheets integration | not affected | out of scope this feature (L2) |
