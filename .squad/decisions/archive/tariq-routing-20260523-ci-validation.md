# Decision Drop — Tariq Routing (CI Validation Request)

**Date:** 2026-05-23
**Agent:** Tariq
**Branch:** feat/034-m5-household-roles

## Request
Run the full existing validation stack in read-only fashion on the current branch: backend CI (`ruff check`, `ruff format --check`, `mypy --strict`, `pytest` excluding `tests/e2e`), frontend CI (`npm run lint`, `npm run test`, `npm run build`), inspect `tests/e2e` to determine the Playwright runner, run the Playwright suite if feasible, and return a structured pass/fail report with full failure output.

## Routing Decision
**Status:** DIRECT_PERMITTED

## Rationale
This is an operational validation request against the already-existing code on the current branch. It is bounded, read-only in scope, does not ask for product, architectural, or implementation changes, and can be satisfied by executing the repository's established CI/test commands plus reporting results. No SpecKit artifact generation is required because the request does not introduce or change requirements, behavior, design, or delivery scope.

## Explicit Scope Confirmation
Permitted scope is limited to:
1. Inspecting repository test configuration, including `tests/e2e`, to identify the Playwright runner/setup.
2. Running the existing backend and frontend validation commands.
3. Running the existing Playwright suite only if the repository already supports it in the current environment.
4. Returning a structured report of pass/fail status and full failure output.

Not permitted within this routing decision:
- modifying application code
- pushing commits
- widening scope into feature work, refactors, or CI redesign
