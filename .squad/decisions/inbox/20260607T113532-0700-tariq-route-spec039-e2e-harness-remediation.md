---
status: DIRECT_PERMITTED
owner: Tariq
created_at: 2026-06-07T11:35:32-07:00
scope: spec-039 e2e harness/test-evidence remediation routing
branch: chore/planning-session-hygiene
---

# Tariq Routing Decision — Spec-039 E2E Harness/Test-Evidence Remediation

## Status

DIRECT_PERMITTED

## Rationale

This is a bounded test-harness and evidence remediation pass for already-approved Spec-039 work, not new product scope or a new acceptance-criteria cycle. The requested fixes map to known RCA items F1, F2, F4, and F5 and are limited to Playwright harness stability, selectors, synthetic seed-derived expectations, and metadata-only evidence integrity. No SpecKit regeneration is required if implementation stays inside the explicit scope below.

## Explicit Scope Confirmation

Permitted file scope is limited to:

- `frontend/e2e/spec039-seed.ts`
- `frontend/e2e/spec039-ui-data-freshness.spec.ts`
- `frontend/playwright.config.ts` only if project/browser-state isolation config must change for hard-navigation/session stability

Permitted remediation scope is limited to:

- F1: ensure protected API probes include Authorization derived from the active synthetic E2E session.
- F2: make the Medium locator unambiguous without weakening the B06/B07 user-visible evidence value.
- F5: stabilize auth/session refresh-token handling and browser-state isolation across hard navigations and Playwright projects.
- F4: reconcile B07 dose expectation drift by deriving the expectation from seed/session data when practical, instead of hard-coding stale values.
- Preserve metadata-only/synthetic-only evidence and avoid prompt/generated text, production data, production logs, real screenshots, production image assets, deploys, pushes, or external-provider calls.

Out of scope: application behavior changes, backend/API changes, frontend product component changes, broad cache rewrites, non-Spec-039 tests, production/external provider access, deploys, pushes, or PR/review activity.

## Gate Note

Quinn gate exists at `/Users/krishna/Documents/Development/GitHub/coffee_tracker/specs/039-ui-data-freshness-bug-evidence/quinn-gate.md` with `status: APPROVED_WITH_NOTES`. Coordinator must still verify the filesystem artifact with `git ls-files specs/039-ui-data-freshness-bug-evidence/quinn-gate.md` in the `coffee_tracker` repo before any implementation begins.

## Required Handling

Existing worktree changes from prior owners must be preserved. The implementer must touch only the scoped harness/config files above, commit only their own scoped changes, and stop for Tariq triage if validation fails again after this remediation.
