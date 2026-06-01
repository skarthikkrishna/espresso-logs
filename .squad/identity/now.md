---
updated_at: 2026-05-31T00:00:00Z
focus_area: spec-034 M5 — closeout in progress; backend hardening is largely complete, with NFR-D8 startup guard and welcome-flow follow-through remaining
active_issues:
  - spec: 034
    repo: espresso-logs
    status: m5-closeout-nfr-d8-and-welcome-flow-remaining
    branch: feat/034-m5-household-roles
    detail: |
      Spec-034 (M5 household roles) remains active on feat/034-m5-household-roles.
      Completed this continuation session:
        - Items 1–5 from pending-m5-work.md:
          atomic refresh rotation, invitation overhaul, household rename/soft-delete,
          X-Household-Id routing, and import wizard
        - Quinn QA hardening pass
        - /auth/me N+1 fix
        - 8 spec gap fixes: name max 64, duplicate invite check, member-limit cap,
          rate limit, UUIDv4 tokens, status codes, timestamps
        - C4 session-resolved invitation + member routes
        - DualWrite silent no-op bug fix
        - E2E test harness updated for JWT auth
        - React Query hardware cache invalidation fix
        - Welcome-flow amendment committed:
          docs/requirements/spec-034-amendment-welcome-flow.md
        - NFR-D8 clarified to Option 2: startup guard
      In progress now:
        - Alex: NFR-D8 implementation in app/setup_guard.py plus startup guard and 503 middleware
        - Priya: amendment updates for NC-1, NC-2, and NFR-D8
      Next after clarification:
        - Finn: /welcome frontend page
        - Session close: Scribe + Ralph
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

Spec-034 M5 is in closeout on `feat/034-m5-household-roles`. Most backend and QA hardening work
for household roles is complete, including the M5 pending-work items, spec-gap fixes, session-
resolved invitation/member routes, JWT E2E harness updates, and the welcome-flow amendment.

The active implementation stream is NFR-D8 Option 2 (startup guard + 503 middleware). In parallel,
Priya is updating the amendment doc to resolve NC-1, NC-2, and NFR-D8 so Finn can pick up the
`/welcome` frontend page once the spec text is settled.

## Open Work State

1. Alex to implement NFR-D8 startup guard (`app/setup_guard.py`, startup validation, 503 middleware).
2. Priya to finalize the amendment updates covering NC-1, NC-2, and NFR-D8.
3. Finn to implement `/welcome` after the amendment is clarified.
4. Operator decision still pending on C1: server-side `active_household_id` vs `X-Household-Id`.
5. After the above, close the session with Scribe + Ralph.
