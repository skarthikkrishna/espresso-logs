# Tasks — tone-system-rollout

Ledger for L4 (Option B: one FR per page). All 11 tasks are strict tier (each guards a core FR) → each has
a repo-resident `scripts/checks/tN.sh` (shared `_page_migrated.sh`: forbids components/ui control-primitive
imports + raw DaisyUI variant classes, REQUIRES a data-tone emitter (D1/D4c), allows the kept shells; then runs the page's vitest). Patterns per
design.md §2: **A** = standalone page, keep `StandaloneHouseholdShell`+`LayerTransition`, tone-ify controls
(D6) — forms use one `TakeoverCard`, status pages use `TonePageWrapper`+single `ToneStateCard` (D9, no
card-in-card); **B** = standalone blank takeover, hoist `*` out of AppShell, `TonePageWrapper`+single
`ToneStateCard` (NotFound only, D9); **C** = in-AppShell in-place atom swap, keep `AccessibleDialog` restyled
(D7). Reference for tone controls: `pages/BrewLogAdd.tsx`.

`[P]` = safe to fan out (independent page + own test + own check, consumes only existing atoms, creates
none). Non-`[P]` are sequenced: **T1** walking skeleton first; **T4** anchors this feature's Pattern-A form
idiom (tone atoms inside the kept shell + D3 primary-link) before the other form pages; **T7** (Login) carries
the most auth surface + a non-form OAuth interstitial branch; **T11** (HouseholdSettings, 569 lines) is
largest, needs a rebuilt test, lands last.

**Negative test (build-time, once during T1/T2, run through the headless espresso-logs session so the hook
fires):** attempt a `src/pages/NotFound.tsx` write *before* advancing out of design → expect `[janus] deny:
… outside parkAllow`; attempt a `.janus/state.json` write → expect `[janus] deny: sign-offs and gates are
operator-only`. Record both denials in `.janus/tone-system-rollout/log.md`.

- [x] **T1 — FR11 NotFound → blank takeover: hoist `*` out of AppShell + TonePageWrapper + single ToneStateCard state=not-found (Pattern B, D9, walking skeleton)**
      guards: FR11
      files: frontend/src/pages/NotFound.tsx, frontend/src/pages/NotFound.test.tsx (new), frontend/src/router.tsx, scripts/checks/t1.sh, scripts/checks/_page_migrated.sh
      done-when: sh scripts/checks/t1.sh → PASS: t1 walking skeleton green
- [x] [P] **T2 — FR9 InviteExpired → TonePageWrapper + single ToneStateCard in kept shell, align=center (Pattern A status, D9 — no card-in-card)**
      guards: FR9
      files: frontend/src/pages/InviteExpired.tsx, frontend/src/pages/InviteExpired.test.tsx (new), scripts/checks/t2.sh
      done-when: sh scripts/checks/t2.sh → PASS: InviteExpired migrated
- [x] [P] **T3 — FR10 InviteInvalid → TonePageWrapper + single ToneStateCard in kept shell, align=center (Pattern A status, D9 — no card-in-card)**
      guards: FR10
      files: frontend/src/pages/InviteInvalid.tsx, frontend/src/pages/InviteInvalid.test.tsx (new), scripts/checks/t3.sh
      done-when: sh scripts/checks/t3.sh → PASS: InviteInvalid migrated
- [x] **T12 — NFR3 ToneStateCard adopts the shared glass surface (`--kk-card-surface-*` + backdrop-filter, drop flat `--kaapi-content-*` + redundant dark override) (D10; shared CSS — also restyles BrewLogList empty/loading/error cards)**
      guards: NFR3
      files: frontend/src/index.css, scripts/checks/t12.sh (new)
      done-when: sh scripts/checks/t12.sh → PASS: t12 ToneStateCard glass surface unified
- [x] **T4 — FR3 Welcome → tone atoms in kept shell (Pattern A anchor; transition branch stays a sibling)**
      guards: FR3
      files: frontend/src/pages/Welcome.tsx, frontend/src/pages/Welcome.test.tsx, scripts/checks/t4.sh
      done-when: sh scripts/checks/t4.sh → PASS: Welcome migrated
- [x] **T13 — NFR3 ToneProvider gains `lockedTone?: Tone` (D11): when set, tone=lockedTone fixed, setTone/toggleTone no-op, localStorage neither read nor written; bare `<ToneProvider>` unchanged (follow-persisted). Shared component — serialized before T14 & T5–T9 consume it.**
      guards: NFR3
      files: frontend/src/contexts/ToneContext.tsx, frontend/src/contexts/__tests__/ToneContext.test.tsx (new-or-augment), scripts/checks/t13.sh (new)
      done-when: sh scripts/checks/t13.sh → PASS: t13 ToneProvider lockedTone locks tone + skips localStorage
- [x] **T14 — NFR3 retrofit the 4 already-built standalone pages to `<ToneProvider lockedTone="dark">` (D11): NotFound, InviteExpired, InviteInvalid, Welcome (T1/T2/T3/T4 stay [x] — precedent D10/T12). Also resolves NotFound "light/dark wrong". Depends on T13.**
      guards: NFR3
      files: frontend/src/pages/NotFound.tsx, frontend/src/pages/InviteExpired.tsx, frontend/src/pages/InviteInvalid.tsx, frontend/src/pages/Welcome.tsx (+their .test.tsx data-tone="dark" assertion), scripts/checks/t14.sh (new)
      done-when: sh scripts/checks/t14.sh → PASS: t14 standalone pages lock dark
- [x] [P] **T5 — FR4 HouseholdNew → tone atoms in kept shell (Pattern A; D11 `lockedTone="dark"`; t5.sh also greps lockedTone)**
      guards: FR4
      files: frontend/src/pages/HouseholdNew.tsx, frontend/src/pages/HouseholdNew.test.tsx (new), scripts/checks/t5.sh
      done-when: sh scripts/checks/t5.sh → PASS: HouseholdNew migrated
- [x] [P] **T6 — FR2 Register → tone atoms in kept shell (Pattern A; D11 `lockedTone="dark"`; t6.sh also greps lockedTone)**
      guards: FR2
      files: frontend/src/pages/Register.tsx, frontend/src/pages/Register.test.tsx, scripts/checks/t6.sh
      done-when: sh scripts/checks/t6.sh → PASS: Register migrated
- [ ] **T7 — FR1 Login → tone atoms in kept shell (Pattern A; OAuth interstitial stays a non-form sibling; preserve 401/429; D5; D11 `lockedTone="dark"`; t7.sh also greps lockedTone)**
      guards: FR1
      files: frontend/src/pages/Login.tsx, frontend/src/pages/Login.test.tsx, scripts/checks/t7.sh
      done-when: sh scripts/checks/t7.sh → PASS: Login migrated
- [ ] [P] **T8 — FR5 InviteAccept → TakeoverCard content in kept shell (Pattern A; preserve accept/decline; D11 `lockedTone="dark"`; t8.sh also greps lockedTone)**
      guards: FR5
      files: frontend/src/pages/InviteAccept.tsx, frontend/src/pages/InviteAccept.test.tsx, scripts/checks/t8.sh
      done-when: sh scripts/checks/t8.sh → PASS: InviteAccept migrated
- [ ] [P] **T9 — FR6 HouseholdGuestView → TonePageWrapper + single ToneStateCard readonly in kept shell (Pattern A status, D9 — emitter required; preserve guest-token scope; D5; D11 `lockedTone="dark"`; t9.sh also greps lockedTone)**
      guards: FR6
      files: frontend/src/pages/HouseholdGuestView.tsx, frontend/src/pages/HouseholdGuestView.test.tsx, scripts/checks/t9.sh
      done-when: sh scripts/checks/t9.sh → PASS: HouseholdGuestView migrated
- [ ] [P] **T10 — FR8 Profile → in-place atom swap (Pattern C; alert→ToneStateCard, GlassCard→EntityCard, Badge→Chip; augment test)**
      guards: FR8
      files: frontend/src/pages/Profile.tsx, frontend/src/pages/Profile.test.tsx (augment), scripts/checks/t10.sh
      done-when: sh scripts/checks/t10.sh → PASS: Profile migrated
- [ ] **T11 — FR7 HouseholdSettings → in-place atom swap (Pattern C; keep AccessibleDialog restyled, alerts→ToneStateCard, rows→EntityCard; D5/D7). Augment test with multi-member/non-self fixture: promote/demote, last-admin disable, remove→dialog→confirm, delete→dialog→confirm, guest-token generate/revoke, non-admin gate.**
      guards: FR7
      files: frontend/src/pages/HouseholdSettings.tsx, frontend/src/pages/HouseholdSettings.test.tsx (augment), scripts/checks/t11.sh
      done-when: sh scripts/checks/t11.sh → PASS: HouseholdSettings migrated
- [x] **T15 — NFR3 tone form-atom remediation (D12): (a) fix `.kk-tc-btn--ghost` to its documented text-only/no-fill/legible contract; (b) drop `input-sm` so `ToneInput`/`ToneSelect`/`ToneTextarea` match the 1rem/2.75rem button scale. Shared atoms — serialized before T6/T7/T8. T4/T5 stay [x] (D10/T12/T14 precedent).**
      guards: NFR3
      files: frontend/src/index.css, frontend/src/components/tone-system/ToneInput.tsx, frontend/src/components/tone-system/ToneSelect.tsx, frontend/src/components/tone-system/ToneTextarea.tsx, scripts/checks/t15.sh (new)
      done-when: sh scripts/checks/t15.sh → PASS: t15 tone form-atom remediation
- [ ] **T16 — FR12 Dashboard first-run empty state (D13): zero bags AND zero shots → suppress "Active bags"/"Recent shots" headers + "View all →" links, render only the "No coffee data yet" empty state + Add-first-bag/Import-CSV CTAs. Presentation-only, no API change (NFR4). Out of tone-migration set.**
      guards: FR12
      files: frontend/src/pages/Dashboard.tsx, frontend/src/pages/Dashboard.test.tsx (augment), scripts/checks/t16.sh (new)
      done-when: sh scripts/checks/t16.sh → PASS: t16 Dashboard first-run empty state
- [x] **T17 — NFR3 ghost/tertiary = outlined button, grouped in the EntityFormActions action row (D12 refinement): thin amber border on `.kk-tc-btn--ghost`; `EntityFormActions` gains `secondaryVariant` (default 'edit'); Welcome/HouseholdNew move Cancel/← Back into EntityFormActions as a ghost secondary. T4/T5/T15 stay [x].**
      guards: NFR3
      files: frontend/src/index.css, frontend/src/components/tone-system/EntityFormActions.tsx, frontend/src/pages/Welcome.tsx, frontend/src/pages/HouseholdNew.tsx, scripts/checks/t17.sh (new)
      done-when: sh scripts/checks/t17.sh → PASS: t17 ghost outlined + grouped action row
