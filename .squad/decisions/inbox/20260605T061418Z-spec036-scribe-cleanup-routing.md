# Routing decision: spec 036 Scribe-managed cleanup

status: DIRECT_PERMITTED
agent: Tariq
scope: process / governance / Scribe-managed decision and session-log cleanup
recorded_at: 2026-06-05T06:14:18Z
branch: fix/prod-oauth-callback
head_before_decision_commit: bdcefc9

## Operator request
Carry the stale PR #80/spec-034 state cleanup forward as part of the 036 changes, and make sure Scribe and logs are updated so that no stale gate blocks the work.

## Authorized cleanup after routing
Direct implementation is permitted for Scribe-managed governance cleanup only:

1. Merge all `.squad/decisions/inbox/` decision drop files into `.squad/decisions.md` using existing repo conventions.
2. Clear/delete merged inbox files.
3. Write `.squad/log/{timestamp}-spec036-state-cleanup.md` documenting:
   - PR #80/spec-034 stale blocker cleared by operator assertion.
   - Branch/merge state checked: HEAD matched `origin/main` before the prior squad decision commit.
   - Local app/test edits are intentionally carried forward into spec 036 and must remain unstaged/uncommitted until spec 036 implementation.
   - Spec 036 still requires normal artifact/gate verification and operator scope confirmation before implementation starts.
4. Commit only Scribe-managed `.squad` files.
5. Do not stage or commit application, infrastructure, test, or docs files outside the Scribe-managed `.squad` cleanup set.
6. Do not push.

## Classification
status: DIRECT_PERMITTED

rationale: The requested follow-up is a self-contained process/governance cleanup that updates Squad decision and session-state records only. It does not authorize or require changes to application code, infrastructure, tests, or product behavior. Because the authorized cleanup is limited to Scribe-managed `.squad` files, a full SpecKit cycle is not required.

explicit_scope_confirmation: The implementation scope is limited to Scribe cleanup of `.squad/decisions.md`, merged inbox files under `.squad/decisions/inbox/`, and `.squad/log/{timestamp}-spec036-state-cleanup.md`. Existing local edits in `app/config.py`, `scripts/_mapping.py`, `tests/scripts/test_migrate.py`, and `tests/test_config_gcp.py` must remain unstaged and uncommitted for spec 036.

quinn_gate: WAIVED
quinn_gate_rationale: Quinn gate is waived for this routing decision because the authorized cleanup is governance/session-record maintenance only and touches no application or infrastructure code.

## State constraints carried forward
- PR #80/spec-034 stale blocker is cleared by operator assertion for this cleanup path.
- Previous Tariq decision drop `b36ed48` recorded that branch HEAD matched `origin/main` before the squad decision commit.
- Current uncommitted application/test edits are intentional spec 036 carry-forward state and must not be staged by Scribe cleanup.
- Spec 036 implementation remains blocked until normal artifact/gate verification and explicit operator scope confirmation occur.

## Decision
status: DIRECT_PERMITTED
rationale: Scribe-only governance/logging cleanup is bounded, non-runtime, and safe to perform directly with strict staging controls.
explicit_scope_confirmation: Only Scribe-managed `.squad` cleanup files may be edited/staged/committed; no app, infra, test, or docs files outside that scope may be touched.
