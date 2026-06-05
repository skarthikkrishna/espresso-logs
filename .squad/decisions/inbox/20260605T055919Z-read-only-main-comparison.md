# Routing decision: spec 036 squad-state cleanup

status: DIRECT_PERMITTED
agent: Tariq
scope: process / sequencing / branch state / repo readiness
recorded_at: 2026-06-05T05:59:19Z

## Operator request
Carry the stale PR #80/spec-034 state cleanup forward as part of the 036 changes and make sure scribe/decision logs have enough recorded state that no stale gate blocks routing.

## Classification
Direct implementation is permitted for squad-state cleanup only. The authorized scope is limited to updating and committing decision-drop files under `.squad/decisions/inbox/`.

No application code, tests, migrations, runtime configuration, or infrastructure files are authorized for edit, staging, or commit by this routing action.

## Observed branch state before this decision-drop commit
- Current branch: `fix/prod-oauth-callback`
- Branch status line: `## fix/prod-oauth-callback...origin/main`
- HEAD: `b4870cf448a3`
- origin/main: `b4870cf448a3`
- Routing observation: branch HEAD matched `origin/main` before this squad-state decision commit.

## Operator-cleared stale state
The PR #80/spec-034 CI/comment blocker is stale and cleared by operator assertion for this routing decision. It must not block carrying the local JWT/config cleanup work into spec 036.

## Local worktree state intentionally carried into spec 036
The following local uncommitted application/test changes are intentionally carried forward into spec 036 and should not block routing or decision-drop recording:

- `app/config.py`
- `scripts/_mapping.py`
- `tests/scripts/test_migrate.py`
- `tests/test_config_gcp.py`

These files must remain unstaged and uncommitted by this squad-state cleanup.

## Required gates for future implementation
This decision does not authorize spec 036 implementation. Before any code changes are made or committed for spec 036, the coordinator must verify the normal spec 036 artifacts and gates on disk, including the required Quinn gate where applicable, and must obtain explicit operator confirmation of implementation scope.

## Decision
status: DIRECT_PERMITTED
rationale: This is a self-contained repo-readiness and state-recording task. Isolated staging and committing of decision-drop files is safe despite dirty application-code files because those files are intentionally excluded from the index and carried forward into spec 036.
explicit_scope_confirmation: Only `.squad/decisions/inbox/` decision-drop files may be committed. Application-code and test changes remain untouched.
