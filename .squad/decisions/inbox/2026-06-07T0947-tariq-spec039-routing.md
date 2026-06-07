---
decision_id: tariq-spec039-routing-2026-06-07T0947
date: 2026-06-07T09:47:03-07:00
agent: tariq
repo: espresso-logs
status: DIRECT_PERMITTED
spec_id: spec-039
spec_path: /Users/krishna/Documents/Development/GitHub/coffee_tracker/specs/039-ui-data-freshness-bug-evidence
---

# Tariq routing decision — spec-039 implementation squad handoff

## Request summary

The operator requested: "There is a spec in coffee_tracker/specs/039... Set out a squad within Espresso Logs to implement the work".

This routing decision evaluates whether `espresso-logs` can proceed directly from the existing `coffee_tracker` SpecKit artifacts for spec-039, or whether a new/full SpecKit cycle is required.

## Inspected artifacts

- `/Users/krishna/Documents/Development/GitHub/coffee_tracker/specs/039-ui-data-freshness-bug-evidence/spec.md`
- `/Users/krishna/Documents/Development/GitHub/coffee_tracker/specs/039-ui-data-freshness-bug-evidence/plan.md`
- `/Users/krishna/Documents/Development/GitHub/coffee_tracker/specs/039-ui-data-freshness-bug-evidence/compliance.md`
- `/Users/krishna/Documents/Development/GitHub/coffee_tracker/specs/039-ui-data-freshness-bug-evidence/aria-gate.md`
- `/Users/krishna/Documents/Development/GitHub/coffee_tracker/specs/039-ui-data-freshness-bug-evidence/tasks.md`
- `/Users/krishna/Documents/Development/GitHub/coffee_tracker/specs/039-ui-data-freshness-bug-evidence/quinn-gate.md`

## Routing decision

`status: DIRECT_PERMITTED`

Direct implementation is permitted because the relevant SpecKit artifacts already exist, are tracked in `coffee_tracker`, and define a bounded implementation handoff for `espresso-logs`:

- `spec.md` is `status: clarified` and classifies B01, B02, B04, B05, B06, and B07 as reproducible/actionable, with B03 and B08 retained as diagnostic/non-repro unless new local evidence appears.
- `plan.md` is `status: active` and identifies expected backend, frontend, cache, evidence, and validation surfaces.
- `aria-gate.md` is tracked and `status: APPROVED`, satisfying the user-facing UI design gate.
- `tasks.md` is tracked and dependency-ordered from T0 through T35.
- `quinn-gate.md` is tracked and `status: APPROVED_WITH_NOTES`, with `implementation_may_proceed: true`.

No new/full SpecKit cycle is required unless requirements change, B03/B08 acquire new evidence that changes scope, or implementation uncovers a product/architecture decision outside the bounded tasks.

## Explicit implementation scope

Implementation is limited to the spec-039 task graph and must not broaden into a cache rewrite, product redesign, production data investigation, or unrelated refactor.

Actionable fixes:

- B01: finish/reactivate bag UI and inventory/status freshness.
- B02: bounded typo-safe historical shot correction API and UI.
- B04: explicit AI feedback generation mutation and UI states.
- B05: manual catalog image selection at create time using safe create-then-upload behavior unless backend tests prove otherwise.
- B06: catalog roast is authoritative in add-bag API/UI.
- B07: Home active-bag shortcut prepopulates Add Brew with reload-safe bag context.

Diagnostic/regression-only unless new evidence appears:

- B03: stored AI feedback display.
- B08: inconsistent cache invalidation after creates.

## Squad assignments needed

- **Tariq**: T0 process/repository/no-production-data gate, dependency coordination, blocked-state escalation, T35 no-push PR-readiness handoff.
- **Quinn**: T1-T4 evidence/gate prerequisites if not already no-op reviewed; T10 backend contract tests with Alex; T16 backend validation; T30-T34 diagnostics, Playwright evidence, targeted validation, full CI/build/evidence safeguard gate.
- **Alex**: Backend/API implementation for T11-T15, including RLS-safe brew-log correction, AI feedback generation endpoint, catalog-roast enforcement, inventory status verification, and catalog image contract review.
- **Finn**: Frontend/UI/cache implementation for T20-T26, including Dashboard/Add Brew prepopulation, CatalogDetail finish/reactivate and roast-lock UI, AddBeanModal image-at-create, BrewLogDetail correction/AI generation UI, and mutation-specific freshness tests.
- **Aria**: No new action required while implementation remains within the approved UI guardrails. Re-engage Aria if a new screen, visual system change, broad layout redesign, or copy-system change appears.
- **Priya/Maya**: No new action required unless requirements or architecture scope changes trigger re-clarification or re-planning.

## Gates and artifacts to verify before implementation

Before any application/test edits in `espresso-logs`:

```bash
cd /Users/krishna/Documents/Development/GitHub/coffee_tracker
git ls-files \
  specs/039-ui-data-freshness-bug-evidence/spec.md \
  specs/039-ui-data-freshness-bug-evidence/plan.md \
  specs/039-ui-data-freshness-bug-evidence/compliance.md \
  specs/039-ui-data-freshness-bug-evidence/aria-gate.md \
  specs/039-ui-data-freshness-bug-evidence/tasks.md \
  specs/039-ui-data-freshness-bug-evidence/quinn-gate.md
grep -n "status: APPROVED" specs/039-ui-data-freshness-bug-evidence/aria-gate.md
grep -n "status: APPROVED\|status: APPROVED_WITH_NOTES" specs/039-ui-data-freshness-bug-evidence/quinn-gate.md

cd /Users/krishna/Documents/Development/GitHub/espresso-logs
git branch --show-current
git status --short
```

## Quinn gate requirement

Quinn gate is required and is **not waived** because this handoff touches application and test code across backend, frontend, E2E, CI validation, data safety, and UI behavior.

Filesystem verification has been performed for routing: `specs/039-ui-data-freshness-bug-evidence/quinn-gate.md` is tracked in `coffee_tracker` and has `status: APPROVED_WITH_NOTES`. The coordinator/implementation squad must still repeat the filesystem verification immediately before implementation begins.

## Validation and release constraints

- Use local synthetic Postgres only: `SPREADSHEET_ID=dummy`, `USE_POSTGRES=true`, and `DATABASE_URL=postgresql+asyncpg://espresso:espresso@localhost:5432/espresso_logs`.
- Use fake/stub LLM and local/test image handling; do not use production provider keys or production image infrastructure.
- Preserve RLS household isolation; no privileged runtime bypasses or RLS weakening.
- Do not commit trace zips, screenshots with real data, production row contents, provider secrets, JWTs, cookies, or production logs.
- If any validation command fails unexpectedly, pause and route to Tariq for triage before additional fix attempts.
- Before any push, all required backend and frontend local checks must pass in the current session and the operator must explicitly authorize the push.
