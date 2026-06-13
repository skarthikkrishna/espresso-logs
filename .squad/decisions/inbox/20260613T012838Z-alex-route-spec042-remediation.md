---
node_id: 20260613T012838Z-alex-route-spec042-remediation
node_type: routing_decision
agent: Alex
role: routing
spec: spec-042
date: 2026-06-13T01:28:38Z
status: DIRECT_PERMITTED
implementation_repo: espresso-logs
implementation_branch: household_test_fixtures
---

# Alex Routing Decision — spec-042 remediation

## Request Summary

Route the operator request to remediate spec-042 review feedback from `coffee_tracker/specs/042-pr116-kaapi-kadai-remediation/spec_042_feedback.md`, specifically the skipped tenant-isolation implementation and verification tasks from the already-frozen spec-042 task list.

## Evidence Reviewed

- `spec_042_feedback.md:27-35` states US3 primary tenant-isolation criteria were not implemented and all Quinn verification tasks were skipped.
- `spec_042_feedback.md:197-209` lists remaining work: T027-T033, T034-T037, T019-T026, and transferred G5/G6 disposition.
- `spec_042_feedback.md:213-221` recommends landing T027-T033 plus T034-T037 before or in parallel with spec-043 because they are backend-only and need no design gate.
- `tasks.md:126-138` defines Alex-owned US3 tenant-isolation implementation tasks T027-T033.
- `tasks.md:140-155` defines Quinn-owned verification tasks T019-T026 and T034-T037, including final gate T026.
- `tasks.md:168-176` says Alex owns T027-T033 and Quinn owns T019-T026 plus T034-T037; US3 dependency order is Alex T027-T033 first, then Quinn T034-T037.
- `quinn-gate.md:1-9` and `quinn-gate.md:23-30` show `status: APPROVED_WITH_NOTES`; `quinn-gate.md:130-138` says T027-T033/T034-T037 are not yet implemented but the notes do not block fan-out.
- `spec.md:119-138` reclassifies US3 as household tenant isolation on every read path, with test-pollution guardrails secondary only.
- `spec.md:212-246` records NC-5 as resolved and confirms Maya/Tariq/Quinn re-runs are complete for the US3 scope change.
- `spec.md:308-319` audits unscoped SQL read paths and confirms the AC change was already processed as a scope change before freeze.
- `espresso-logs/app/repos/sql/catalog.py:68-80` still has unscoped catalog list/get reads.
- `espresso-logs/app/repos/sql/brew_log.py:70-75`, `173-180`, `183-190`, `220-227`, and `237-244` show the current household-filter pattern to mirror.

## Quinn Gate Verification Result

`coffee_tracker/specs/042-pr116-kaapi-kadai-remediation/quinn-gate.md` is tracked by git and has `status: APPROVED_WITH_NOTES`. Implementation fan-out is permitted because the gate exists and is not BLOCKED.

## Routing Status

`status: DIRECT_PERMITTED`

Rationale: this is not new product scope. The review feedback identifies previously skipped work already present in frozen spec-042 artifacts. US3 tenant isolation was already reclassified under NC-5, then re-run through Maya planning, Tariq task generation, and Quinn gate before freeze. Resuming the implementation phase for T027-T033 and their required Quinn verification does not require a new SpecKit cycle. Inviolable Rule 6 is respected because no new acceptance criteria are being added.

## Bounded Scope for This Session

### In Scope — backend remediation fan-out

- **Alex:** T027 shared household-scoping helper.
- **Alex:** T028 catalog list/get/_fetch_all scoping.
- **Alex:** T029 inventory list/list_all/get scoping and same-household hydration.
- **Alex:** T030 hardware plus maintenance list/get scoping and same-household linked reads.
- **Alex:** T031 brew-log support/hydration scoping, especially list_existing_ids exposure.
- **Alex:** T032 dual-write/Sheets fallback reachability assessment and blocking/scoping decision if runtime-reachable.
- **Alex:** T033 startup/readiness runtime-role and RLS assertion.
- **Quinn:** T023 retained secondary guardrail/cleanup verification if required as a dependency for T037.
- **Quinn:** T034 SQL-backed direct cross-household isolation tests.
- **Quinn:** T035 SQL-backed linked/hydration/dashboard/defaults/fresh-household/no-context tests.
- **Quinn:** T036 runtime DB-role/RLS metadata tests.
- **Quinn:** T037 CI execution of SQL-backed US3 isolation suite with fail-closed behavior.

### Split from this backend-focused session but still spec-042 debt

- **Quinn/Finn verification split:** T019, T020, T021, T022, T024, and T025 are frontend/PWA/motion/design verification tasks. They remain frozen spec-042 obligations, but they are not prerequisites for the backend-only US3 remediation fan-out recommended by the feedback.
- **Quinn final gate:** T026 remains deferred until T019-T025 and T034-T037 all pass.

### Explicitly Deferred / Out of Scope for This Session

- G5 3D hero failure model is transferred to spec-043 scope per feedback.
- G6 canonical primitive styling is transferred to spec-043 scope per feedback.
- No new UX, design-system, GSAP, three.js, icon, hardware IA, import-copy, infrastructure, auth, schema, or product-entity changes are authorized by this routing decision.
- Do not weaken or rewrite already-squash-merged e2e triage fixes; current evidence shows the CatalogDetail `appearance-none` restoration and updated e2e locators are present in the tree.

## Recommended Owner Fan-Out

1. **Alex backend implementation:** complete T027-T033 in dependency order, using `SqlBrewLogRepo._current_household_filter()` as the reference pattern and returning empty/not-found when no active household context exists.
2. **Quinn backend verification:** in parallel where test scaffolding can start safely, prepare T034-T036 scenarios; finalize T034-T037 after Alex lands T027-T033. Include T023 only as needed for T037 dependency closure.
3. **Coordinator:** schedule separate Quinn/Finn verification work for T019-T025 and only run T026 after all spec-042 verification tasks pass.
