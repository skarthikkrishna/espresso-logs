---
updated_at: 2026-05-23T18:15:00Z
focus_area: spec-034 M5 — invitation/member route refactor complete locally; frontend legacy endpoint alignment and welcome-flow implementation remain as follow-up before any push
active_issues:
  - spec: 034
    repo: espresso-logs
    status: backend-route-refactor-complete-local-no-push
    branch: feat/034-m5-household-roles
    detail: |
      Session-resolved invitation/member route refactor is complete and committed locally.
      Key commits:
        1fe8865 — refactor(households): session-resolved invitation + member routes (#034)
          Removed household_id from invitation/member URL paths; accept-invite now uses
          token as path param resolved at route level; decline remains unauthenticated.
        5fb1c2f — fix(households): allow token-resolved invite accept preview (#034)
          Invite-accept endpoint now works without an active household session membership;
          identity resolved via current_user, household resolved via token lookup.
      All four local CI checks passed (ruff check, ruff format --check, mypy --strict, pytest).
      No push has been performed.
      Known follow-up (operator-acknowledged):
        - Frontend still references the legacy invite-accept endpoint
          (POST /households/accept-invite); must be updated to
          POST /households/invitations/{token}/accept before the branch is PR-ready.
        - Welcome-flow / onboarding work stream (spec-034-amendment-welcome-flow.md,
          committed at 6637d3c) remains untouched this session per operator constraint.
          First-sign-in auth behaviour, zero-membership redirects, and invite-token
          bypass rules are not yet implemented.
      Before any push: all four local CI checks must pass in the current terminal
      session and the operator must explicitly approve the push.
  - task: brew_log_reconcile dry-run
    repo: espresso-logs
    status: queued
    detail: validate spec-033 Sheets→Postgres row parity before closing spec-033

# What We're Focused On

## Current Team Focus

Spec-034 M5 is active on `feat/034-m5-household-roles`. The backend invitation and member route
refactor is complete locally (1fe8865, 5fb1c2f) and all local CI checks have passed. The branch
is not yet pushed. Two follow-up streams remain before the branch is PR-ready:

1. **Frontend legacy endpoint** — React SPA still calls the old `POST /households/accept-invite`
   path. It must be updated to `POST /households/invitations/{token}/accept`.
2. **Welcome-flow / onboarding** — the spec-034 amendment document (`6637d3c`) defines the
   required `/welcome` first-sign-in behaviour and invite-token bypass rules but the application
   code has not been aligned to it. This work stream is explicitly deferred per operator constraint.

## Open Work State

1. Route refactor committed locally: `1fe8865` (invitation/member URL cleanup) and `5fb1c2f`
   (token-resolved accept preview). No push performed.
2. Frontend must be updated to call `POST /households/invitations/{token}/accept` — legacy
   `POST /households/accept-invite` is no longer valid.
3. Welcome-flow onboarding work (auth-layer redirect rules, zero-membership handling, invite-token
   bypass) is formally deferred; the amendment doc exists at `6637d3c` as the source of truth.
4. `app/deps.py` contains an unrelated unstaged modification that must remain uncommitted and
   untouched until the operator decides to handle it separately.
5. Separate queued follow-up unchanged: `brew_log_reconcile` dry-run for spec-033 closeout.
