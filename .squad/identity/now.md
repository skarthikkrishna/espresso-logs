---
updated_at: 2026-05-23T16:58:21Z
focus_area: spec-034 M5 — welcome-flow amendment committed locally; branch focus shifts to implementation alignment and remaining spec-conformance follow-up before any push
active_issues:
  - spec: 034
    repo: espresso-logs
    status: docs-amendment-committed-local-follow-up-pending
    branch: feat/034-m5-household-roles
    detail: |
      The spec-034 welcome onboarding amendment is committed locally in
      docs/requirements/spec-034-amendment-welcome-flow.md (6637d3c).
      It formalises `/welcome` first-sign-in behaviour, zero-membership redirects,
      and invite-token bypass rules, and explicitly supersedes auth-layer auto-seeding
      of a default household.
      No push has been performed.
      Next action: implement and validate the amendment in backend/frontend auth and
      onboarding flows, along with any remaining spec-034 conformance items, then seek
      operator approval before push/PR.
  - task: brew_log_reconcile dry-run
    repo: espresso-logs
    status: queued
    detail: validate spec-033 Sheets→Postgres row parity before closing spec-033

# What We're Focused On

## Current Team Focus

Spec-034 M5 remains active on `feat/034-m5-household-roles`. The welcome-flow amendment work is complete locally,
and the branch now has an explicit source-of-truth document for `/welcome` onboarding behaviour.
Team focus shifts from documenting the onboarding gap to implementing that behaviour cleanly and reconciling the
remaining spec-034 conformance items before the branch is eligible for push/PR.

## Open Work State

1. `docs/requirements/spec-034-amendment-welcome-flow.md` is committed locally (`6637d3c`) and defines the required `/welcome` onboarding flow; application behaviour still needs to be aligned to that amendment.
2. Follow-up work remains on first-sign-in/auth behaviour: remove the implicit default-household auto-seed path and enforce the documented `/welcome` vs invite-bypass redirect rules.
3. Other outstanding spec-034 implementation/conformance gaps remain open until they are resolved or explicitly waived by the operator.
4. No push has occurred. Before any push: all required local checks must pass and the operator must explicitly approve the push.
5. Separate queued follow-up remains unchanged: `brew_log_reconcile` dry-run for spec-033 closeout.
