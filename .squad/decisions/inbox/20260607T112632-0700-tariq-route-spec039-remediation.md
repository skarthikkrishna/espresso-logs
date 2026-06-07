---
status: DIRECT_PERMITTED
owner: Tariq
created_at: 2026-06-07T11:26:32-07:00
scope: spec-039 bounded remediation routing
---

# Tariq Routing Decision — Spec-039 Bounded Remediation

## Status

DIRECT_PERMITTED

## Rationale

The work is a bounded recovery loop for already-approved Spec-039 implementation/validation tasks. The prior RCA classifies the remaining failures as concrete T32/T34 blockers, not new product scope or new acceptance criteria, so no new SpecKit cycle is required. Implementation remains paused until the required owners fix only the enumerated blockers, then Quinn reruns validation in order.

## Explicit Scope

Permitted fixes are limited to the reported blockers:

- Quinn/Finn: E2E auth/API probe token use, browser/session isolation, Playwright selector stability, and Add Brew accessible labels.
- Alex/Quinn: fake/noop LLM hermeticity and no external-provider calls in T32.
- Alex: Spec-039 cleanup for B08-created brew logs tied to synthetic bag/catalog lineage.
- Alex: preserve the canonical no-key/noop inference message for existing non-forced paths.
- Alex/Finn: make shot-eligibility clearing consistent between UI and API.
- Quinn/Alex: reconcile B07 dose fixture/assertion drift with documented rationale.

Out of scope: new feature behavior, broad cache rewrites, production data/log/image access, deploys, pushes, or PR/review requests.

## Required Owners

- Alex: backend/API, inference hermeticity, cleanup, shot-eligibility API contract, backend tests.
- Finn: frontend/UI/cache/accessibility fixes and affected UI tests.
- Quinn: E2E harness/selectors/fixture evidence and validation reruns.
- Tariq: triage only if validation fails again; no implementation ownership.

## Quinn Gate Requirement

Quinn gate is required and is not waived because this route authorizes application and test-code fixes. Filesystem verification was performed in `coffee_tracker`: `git ls-files specs/039-ui-data-freshness-bug-evidence/quinn-gate.md` returned the tracked artifact, and the gate frontmatter is `status: APPROVED_WITH_NOTES`.

## Next Validation Sequence

1. Fix only the bounded blockers above.
2. Quinn reruns T32: `cd frontend && PW_BASE_URL=http://localhost:8000 npm run test:e2e -- spec039-ui-data-freshness.spec.ts`.
3. Only after T32 passes, Quinn reruns T33 targeted backend/frontend validation.
4. Only after T33 passes, Quinn reruns T34 full local CI/build/evidence safeguard gate.
5. If any validation fails, pause for Tariq triage before further fixes.
6. No push is authorized; after all checks pass, the operator must explicitly approve any push.
