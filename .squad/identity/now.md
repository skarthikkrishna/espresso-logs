---
updated_at: 2026-07-05T00:00:00Z
focus_area: janus migration Phase 1 CLOSED — code-derived wrap-up ledger adjudicated; next = Phase 2 (coffee_tracker docs) then Phase 3 pilot under janus
milestone: trunk = feat/043-completion == origin/household_fixes; side-branch triage complete; main 0 ahead / 4 behind trunk (cutover = fast-forward uber push)
action: drive ledger L4 → L2 → L5 → L1 → L3 → L6 through janus gates (Phase 3); tracker at claude-janus/scratch/espresso-migration-tracker.md
---

# Ground truth — 2026-07-05 (derived from code, operator-adjudicated)

This file was rewritten at migration Phase 1 close. Everything below was verified against the
code on `feat/043-completion`; spec/.squad assertions were NOT trusted. The old squad workflow
(personas, ceremonies, spec gates) is DEAD — the janus harness replaces it at Phase 3/4.
Phase tracker + standing rules: `claude-janus/scratch/espresso-migration-tracker.md`.
Ledger evidence detail: `claude-janus/scratch/espresso-phase1-ledger-draft.md`.

## Branch state

- **Trunk = `feat/043-completion`**, tree-identical to `origin/household_fixes` (deliberate
  upstream — the stand-in for main). `main` is 0 ahead / 4 behind; cutover = fast-forward.
- Side-branch triage COMPLETE 2026-07-05: `feat/043-design-coherence` (tree-identical) and
  `household_test_fixtures` (operator dual-instance A/B verdict: trunk wins, discarded wholesale)
  are deleted; every pre-triage tip survives as a remote `pre-migration/<branch>` tag.

## What is actually DONE (verified in code)

- Spec-043 RED fixes all landed: hero viz out of render, "Log a shot" is a real ToneButton,
  bag monograms derive from title (`entityMonogram`), immersive frost opacity raised.
- Tone-system migrated pages: Dashboard, CatalogList, CatalogDetail, BrewLogList, BrewLogDetail,
  BrewLogAdd, HardwarePage, ImportWizard.
- Empty/zero-rows paths on all four core surfaces are guarded and use `ImmersiveEmptyState`;
  backends return safe empty payloads (no 404/500 on zero rows).
- Spec-042 US3 tenant read-scoping (except brew-log's divergent path — see L1).

## Wrap-up ledger (adjudicated 2026-07-05, order = pilot order)

1. **L4 (M)** — finish tone-system rollout: HouseholdSettings, Login, Register, Welcome,
   HouseholdNew, InviteAccept, HouseholdGuestView, Profile (+ minimal InviteExpired/InviteInvalid/
   NotFound) still on `StandaloneHouseholdShell`/`components/ui`. First pilot item (stringent janus check).
2. **L2 (L)** — M6 Sheets decommission: `app/config.py:53` still hard-requires SPREADSHEET_ID;
   Sheets client + five `_DualWrite*` wrappers fully wired in `app/deps.py`; ~28 test files coupled.
3. **L5 (S)** — dead-code prune: DashboardHero3D/DashboardHeroMotion/ExtractionBrewViz3D/
   HeroVisualFrame, CharacterTile, duplicate `ui/EmptyState` vs `ImmersiveEmptyState`.
4. **L1 (S/M)** — fresh-household failure signature (operator-observed): four divergent per-page
   error UIs render one upstream failure as unrelated-looking errors; brew-log on divergent
   tenancy path (raw `current_setting` + `resolve_guest_or_member` vs `household_read_scope` +
   `current_household_membership`); catalog `data?.length === 0` edge. Runtime capture owed
   (opportunistically during L4 evals).
5. **L3 (M)** — household-invite email delivery: ABSENT (invite_url copy/share only;
   `delivery.email_*` flags hardcoded False; no SMTP/provider code or config).
6. **L6 (S, gated on L2)** — drop orphaned `sheets_id`/`sheets_hardware_id`/`sheets_catalog_id`
   columns + `uq_*_household_sheets_id` constraints (migrations 0004-0006, 0016).

Flags: `use_postgres` defaults False in config (dev .env = true; default dies with L2);
`brew_log_sync_alert` defaults False pending reconciliation.

**"Wrap-up complete" (= Phase 4 cutover trigger) = all six items shipped through janus gates.**
Per-item acceptance criteria are written at Phase 3 requirements gates, live with operator.

---

## Preserved record — spec-042 US3 session close (2026-06-13, merged from household_fixes)

> Historical record only; kept across rewrites.

- Branch at close: `household_test_fixtures`, forked from `household_fixes`.
- Focus completed: spec-042 US3 app-layer tenant-isolation remediation plus the spec-040 invitation-fixture fix across `espresso-logs` and the spec repo.
- Completed spec-042 read-scoping tasks T027-T033: `HouseholdReadScope` helper; catalog, inventory, hardware, maintenance, and brew-log read and join scoping; startup and readiness runtime RLS assertions.
- Completed SQL isolation coverage, RLS metadata checks, dashboard/defaults/fresh-household isolation coverage, and CI gate work for T034-T037 and T040.
- Completed the spec-040 invitation-fixture time-bomb fix.
- Completed per-household composite `sheets_id` uniqueness migration 0016 and write-path scoping for T038-T039.
- Verification at close: ruff check, ruff format check, and mypy strict all passed; pytest 824 passed / 0 failed / 13 skipped; coverage 86.75%; Playwright 167 passed / 1 skipped.
- PR #117 was opened against `household_fixes`; GitHub CI only runs on PRs to `main`, so local CI-parity plus Playwright were the gate for that branch.
