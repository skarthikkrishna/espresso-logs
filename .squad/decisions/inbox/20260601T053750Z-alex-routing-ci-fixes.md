# Alex routing decision — branch feat/034-m5-household-roles CI fixes

- Date: 2026-06-01
- Branch: `feat/034-m5-household-roles`
- Request: Fix two CI failures on `feat/034-m5-household-roles` in `espresso-logs`: resolve the asyncpg event-loop mismatch behind 23 failing SQL repo tests by correcting fixture/loop scope conflicts without changing test logic/assertions, upgrade `starlette` from `1.0.0` to `1.0.1` via `uv add starlette==1.0.1`, run all four local CI-equivalent checks, and if passing commit locally without pushing.

## Decision
status: DIRECT_PERMITTED

## Rationale
This is a bounded remediation request inside existing backend test infrastructure and dependency management. The requested work is limited to repairing a fixture/event-loop scope mismatch in current tests, applying a patch-level dependency upgrade, validating with the repository’s established four CI-equivalent commands, and creating a local commit. It does not introduce new product scope, schema design, UX changes, or cross-cutting architectural decisions that would require a SpecKit cycle.

## Explicit scope confirmation
Direct implementation is permitted only for: investigating `tests/conftest.py` and the named failing SQL repo tests, fixing the async fixture or event-loop scope conflict without altering test assertions or intended behavior, running `uv add starlette==1.0.1`, executing the four required local CI-equivalent checks, and creating a local commit if those checks pass. No push, no broader refactor, and no unrelated file changes are authorized by this routing decision.
