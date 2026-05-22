---
updated_at: 2026-05-22T06:25:00Z
focus_area: spec-034 M5 — architectural review complete, 2 CRITICAL security fixes applied, HIGH/MEDIUM items tracked in open work
active_issues:
  - spec: 034
    repo: espresso-logs
    status: security-patched
    branch: feat/034-m5-household-roles
    detail: |
      Maya RED review complete. 2 CRITICAL security fixes committed (BYPASSRLS + cross-household reset).
      Frontend routes, AuthContext multi-household, role guards, X-Household-Id header added by Finn/Quinn.
      485 backend tests + 188 frontend tests passing. CI green.
      Open HIGH items: atomic refresh rotation, invite model (72h/email/role/decline/revoke/resend),
      household rename/delete, active-household header resolution, import wizard session/admin-gate.
  - task: brew_log_reconcile dry-run
    repo: espresso-logs
    status: queued
    detail: validate spec-033 Sheets→Postgres row parity before closing spec-033

# What We're Focused On

## Current Team Focus

Architectural review of M5 spec-034 is complete. Maya returned RED with 2 CRITICAL security failures
and 30+ functional gaps. This session patched both CRITICAL items and applied all CRITICAL/HIGH frontend
fixes. The remaining HIGH backend items (7 items: atomic refresh rotation, invitation model overhaul,
household rename/delete, active-household resolution, import wizard) are documented and ready for Alex
in the next session.

## Open High-Priority Backend Work (next session)

1. Atomic refresh token rotation (race condition in api_auth.py:234-259)
2. Invitation model: 72h expiry, invited_email, invited_role, decline/revoke/resend endpoints
3. Household rename (PATCH /households/{id}) and soft-delete (DELETE /households/{id})
4. Active-household resolution via X-Household-Id header in deps.py
5. Import wizard: admin-gate + replace request.session with DB-backed state
