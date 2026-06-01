---
updated_at: 2026-06-01T04:36:36Z
focus_area: spec-034 M5 — QA closeout identified one critical SPA onboarding defect; backend fallback, setup guard, and invite flows validated
active_issues:
  - spec: 034
    repo: espresso-logs
    status: qa-closeout-spa-welcome-defect-open
    branch: feat/034-m5-household-roles
    detail: |
      QA validation on feat/034-m5-household-roles confirmed mixed closeout status for spec-034 M5.
      Validated in this session:
        - Existing-user backend fallback / household-switch behavior behaved as expected
        - NFR-D8 setup-guard behavior validated
        - Invitation flow behavior validated
      Major failure found:
        - New-user SPA welcome flow fails because Router/AuthProvider composition prevents the
          onboarding path from behaving correctly in the app shell
      Additional follow-up:
        - Route-shape observations were recorded during QA and should be reviewed before final closeout
  - decision: C1
    repo: espresso-logs
    status: awaiting-operator
    branch: feat/034-m5-household-roles
    detail: |
      Operator decision pending on household context compatibility.
      C1 asks whether to keep a server-side active_household_id model or rely on the
      X-Household-Id header. Full compatibility analysis has already been provided.
      No final implementation direction should assume the outcome until the operator decides.

# What We're Focused On

## Current Team Focus

Spec-034 M5 is now in QA closeout on `feat/034-m5-household-roles`. Backend fallback/switch behavior,
setup-guard handling, and invitation-flow behavior all validated successfully, but the new-user
onboarding path still has a critical SPA failure tied to `Router` / `AuthProvider` composition.

Route-shape observations from the QA pass also remain open for review so the branch can be closed out
with the onboarding behavior and navigation contract aligned.

## Open Work State

1. Fix the new-user `/welcome` SPA failure caused by Router/AuthProvider composition in the frontend shell.
2. Review the QA route-shape observations and decide whether any follow-up adjustments are required before closeout.
3. Preserve the validated backend behaviors (existing-user fallback/switch, setup guard, invitation flow) while addressing the frontend defect.
4. Operator decision still pending on C1: server-side `active_household_id` vs `X-Household-Id`.
5. After the above, complete final session close with Scribe + Ralph.
