# Routing decision: Scribe-only governance/logging cleanup

status: DIRECT_PERMITTED
agent: Tariq
scope: process / governance / Scribe-managed decision and session-log cleanup
recorded_at: 2026-06-05T06:20:18Z
branch: fix/prod-oauth-callback
head_before_decision_commit: 9f4c2b2

## Operator request
Route a Scribe-only governance/logging cleanup. If later implemented, the cleanup must merge every current `.squad/decisions/inbox/` file into `.squad/decisions.md` using existing conventions, delete merged inbox files, create `.squad/log/{timestamp}-spec036-state-cleanup.md` documenting the exact requested state points, then stage and commit only Scribe-managed `.squad` files.

## Classification
status: DIRECT_PERMITTED

rationale: The requested work is self-contained governance/session-record maintenance. It changes only Scribe-managed `.squad` decision and log artifacts, does not alter product behavior, runtime configuration, CI, infrastructure, application code, or tests, and therefore does not require a SpecKit cycle.

explicit_scope_confirmation: Later implementation is limited to `.squad/decisions.md`, merged/deleted files currently under `.squad/decisions/inbox/`, and a new `.squad/log/{timestamp}-spec036-state-cleanup.md`. Existing local uncommitted edits in `app/config.py`, `scripts/_mapping.py`, `tests/scripts/test_migrate.py`, and `tests/test_config_gcp.py` must remain unstaged and uncommitted. No application, test, infrastructure, or non-Scribe files are authorized.

quinn_gate: WAIVED
quinn_gate_rationale: Quinn gate is waived because this is governance/logging cleanup only and explicitly touches no application or infrastructure code. The waiver does not authorize any runtime, test, CI, or infra edits.

## Required staging controls
- Stage and commit only the newly created routing decision drop for this routing action.
- Do not stage or commit `.squad/decisions.md`, `.squad/log/*`, application files, test files, infrastructure files, or pre-existing inbox files as part of this routing commit.
- Do not push.

## Decision
status: DIRECT_PERMITTED
rationale: Scribe-only governance/logging cleanup is bounded, non-runtime, and safe to perform directly with strict staging controls.
explicit_scope_confirmation: Only Scribe-managed `.squad` cleanup files may be edited/staged/committed during later cleanup; this routing commit stages only this new decision drop.
