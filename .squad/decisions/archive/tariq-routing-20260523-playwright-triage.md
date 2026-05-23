# Decision Drop — Tariq Routing (Playwright Triage Request)

**Date:** 2026-05-23T16:29:01Z
**Agent:** Tariq
**Branch:** feat/034-m5-household-roles

## Request
Triage the failing Playwright tests on `feat/034-m5-household-roles` and determine which failures are environment-only (server not running) versus actual code regressions. Do not modify code. Start the server if needed, run pytest Playwright and frontend Playwright with a live server, categorize failures, and report findings only.

## Routing Decision
**Status:** DIRECT_PERMITTED

## Rationale
This is a bounded investigation request against existing test infrastructure and existing application code. It asks only for operational triage: starting already-defined local services if required, running the repository's existing Playwright-related test commands, inspecting failures, and classifying them. It does not request changes to product scope, implementation behavior, architecture, or CI design, so a full SpecKit cycle is not warranted.

## Explicit Scope Confirmation
Permitted scope is limited to:
1. Reading existing backend/frontend test and Playwright configuration.
2. Starting the existing local app/server processes needed to exercise Playwright tests.
3. Running the existing pytest Playwright coverage and frontend Playwright suite with a live server.
4. Distinguishing environment/setup failures from likely code regressions.
5. Producing a findings report only.

Not permitted within this routing decision:
- modifying application or test code
- changing CI/workflow configuration
- widening scope into bug fixes, refactors, or new requirements
- pushing commits beyond this required routing decision drop
