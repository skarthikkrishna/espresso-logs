# handoff: tone-system-rollout · build · 2026-07-08T04:28:59Z

## Done
- T4 (FR3 Welcome): migrated to Pattern A — kept `StandaloneHouseholdShell`+`LayerTransition`, `ToneProvider` → single `TakeoverCard` holding the wizard (choose/create/invite steps); form atoms `ToneInput`+`EntityFormActions`; step CTAs `ToneButton` (primary/edit/ghost). Transition/loading branch is a non-tone sibling reusing `LoadingSpinner`. t4.sh green.
- **D11 (design amended + operator-signed 2026-07-07T06:18):** the 9 standalone pages LOCK to dark (ignore persisted tone, no `ToneToggle`); supersedes D8 for them (D8 now = AppShell/Pattern-C only). Root of the eval complaint: espresso-vs-amber was purely tone, not a button diff (Home "Log a shot" and Welcome "Create my household" are the same `ToneButton variant="primary"`).
- T13 (shared): `ToneProvider` gained `lockedTone?: Tone` — fixed tone, `setTone`/`toggleTone` no-op, localStorage neither read nor written; bare provider unchanged. Test at `src/components/tone-system/__tests__/ToneContext.test.tsx`. t13.sh green.
- T14 (retrofit): NotFound/InviteExpired/InviteInvalid/Welcome now `<ToneProvider lockedTone="dark">`; the 3 status tests tightened `data-tone` `/^(dark|beige)$/`→`.toBe('dark')`, Welcome got a matching dark-lock test. t14.sh green.
- T4 eval polish (operator, all built+rebuilt): (a) removed the "Household setup" eyebrow (`COPY.welcome.eyebrow` now orphaned, harmless); (b) title→description gap now uses the canonical tone-card section gap `.kk-tc-section` (`--kk-tc-section-gap` 32/24px) on a **wrapper div** around each `kk-tc-body-muted` paragraph — NOT on the paragraph itself (`.kk-tc-body-muted` sets `margin:0` at index.css:1891, later + equal specificity to `.kk-tc-section` at :1743, so it cancels a section class placed on the text atom).

## In-flight
- Task: `- [ ] [P] **T5 — FR4 HouseholdNew → tone atoms in kept shell (Pattern A; D11 lockedTone="dark"; t5.sh also greps lockedTone)**`
- State: NOT started. `frontend/src/pages/HouseholdNew.tsx` still legacy (`Button`/`FormField`/`Input` from `../components/ui`, `space-y-*`). Mirror T4/Welcome.tsx: kept shell → `<ToneProvider lockedTone="dark">` → `TakeoverCard` → `ToneInput`+`EntityFormActions`; title→hint gap via a `<div className="kk-tc-section">` wrapper. Check: `sh scripts/checks/t5.sh` (author it: shared `_page_migrated.sh HouseholdNew` + an added `grep 'lockedTone="dark"'`). Needs a new `HouseholdNew.test.tsx`.
- Gate: stage=build; design+requirements signed & current. Per-task cadence (operator starts each task).
- Gotchas: `_page_migrated.sh` needs a `data-tone` emitter — a bare `ToneProvider` is inert (forms use `TakeoverCard`). Section-gap class goes on a container, never on `kk-tc-body-*` (margin:0 wins). `getByLabelText` exact-matches — omit `required` on `ToneInput` (it only adds an aria-hidden asterisk, not forwarded to the input) to keep labels clean under the `noValidate` manual-validated form.
- Instance: backend `make dev` on http://localhost:8000 (Postgres :5432), serves `app/static/spa`. Bundle rebuilt this session incl. T13/T14 + Welcome polish (NO server restart — static rebuild only). Refresh after a build task: `cd frontend && npm run build` (or `sh scripts/checks/t1.sh` which also kills/reboots the port). Probes: `/welcome` (zero-membership user), `/invite/expired`, `/invite/invalid`, any bogus path → 404. Auth = Google OAuth.

## Next
- Start T5 (HouseholdNew) per In-flight; author t5.sh; run it; refresh instance. Remaining: T6 Register, T7 Login (both Pattern-A form, lock dark, section-gap convention), T8 InviteAccept, T9 HouseholdGuestView, T10 Profile, T11 HouseholdSettings (Pattern C — in AppShell, follow persisted, NO lock).
- Prereqs: no `.janus/env.md`; boot = `make dev` (uvicorn :8000), DB = local Postgres :5432.

## Open questions
- Negative-test (tasks.md, T1 area): "attempt a `NotFound.tsx` write while stage=design → expect parkAllow deny" was never run (the deny window only exists mid-design). Operator-owned: re-run from a design bounce, or accept the two recorded denials (state.json + audit.log, log.md) as sufficient.
