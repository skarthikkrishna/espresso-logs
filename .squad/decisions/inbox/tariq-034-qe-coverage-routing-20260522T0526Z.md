# Decision Drop — Tariq Routing: spec-034 M5 QE Coverage Task
**Date:** 2026-05-22T05:26Z
**Author:** Tariq (routing agent)
**Branch:** feat/034-m5-household-roles
**Request:** Add backend pytest coverage and frontend Vitest coverage for spec-034 M5 household-role/auth/multi-household/RLS flows, with xfail(strict=True) only where production fixes are pending, and no dependency override of `require_admin` in new tests.

---

## Decision

**status: DIRECT_PERMITTED**

---

## Rationale

This is a bounded, additive QE coverage task on an existing feature branch where the implementation is complete. The following conditions confirm DIRECT_PERMITTED:

1. **No application code changes.** The task is purely additive: new test files and/or new test cases in existing test modules. No routes, models, services, migrations, or frontend components are modified.

2. **Test infrastructure already established.** The repository has mature test scaffolding in place:
   - Backend: `conftest.py`, `FakeSheetsClient` doubles, `pytest-asyncio` in auto mode, existing `tests/test_households.py`, `tests/models/test_household.py`, `tests/integration/` structure.
   - Frontend: Vitest + jsdom configured in `vite.config.ts`, `src/test/setup.ts`, `src/__tests__/` directory with existing test files.

3. **This executes a mandated Quinn QE handoff.** Maya's architectural review (`.squad/decisions/inbox/20260521T2032Z-maya-arch-review.md`) explicitly mandated Quinn QE action items (CRITICAL×1, HIGH×2) on this branch. Writing test coverage to surface those gaps (via `xfail(strict=True)`) is executing the already-approved QE mandate — not new scope.

4. **No SpecKit artifacts required.** SpecKit is warranted for product feature work, spec changes, or architecture decisions. Test coverage on an existing implementation uses established test conventions; it does not require a new specification, plan, tasks.md cycle, or architectural gate.

5. **xfail(strict=True) constraint respected.** The operator explicitly constrains xfail use to flows where production fixes are still pending (surfacing known failures as red, not hiding them as skip). This is a standard pytest pattern consistent with the codebase's QE conventions.

6. **No require_admin override constraint respected.** The operator explicitly prohibits overriding the `require_admin` dependency in new tests. This is consistent with testing the actual auth/role enforcement rather than bypassing it — and with Maya's finding that role enforcement has security gaps that must be surfaced, not papered over.

---

## Explicit Scope Confirmation

The following scope is permitted under this decision:

**Backend (pytest):**
- New test file(s) under `tests/` or `tests/integration/` covering:
  - Household role assignment and enforcement (admin vs. member paths)
  - Auth flows: login, token refresh, password reset with household membership validation
  - Multi-household scenarios: user in multiple households, household switching
  - RLS enforcement: row-level isolation across household boundaries
- `xfail(strict=True)` applied only to test cases where Maya's RED findings correspond to not-yet-fixed production code on this branch
- No overriding `require_admin` via `app.dependency_overrides` in new tests

**Frontend (Vitest):**
- New test file(s) under `frontend/src/__tests__/` covering:
  - Household role-aware UI flows (admin vs. member rendering/routing)
  - Auth context and household context interactions
  - Multi-household selection / switching components
- `xfail`-equivalent patterns (`.todo` or conditional skips) only where frontend fixes remain pending

**Out of scope:**
- No application code changes (routes, models, services, frontend components, migrations)
- No new npm or PyPI dependencies
- No spec amendments or plan changes
- No changes to existing passing tests

---

## Constraints on Implementation Agent

- Must follow `SPREADSHEET_ID=dummy` + `FakeSheetsClient` pattern (no live sheets in tests)
- Must pass all four local CI checks before any push: `ruff check`, `ruff format --check`, `mypy --strict`, `pytest`
- Must not push without explicit operator affirmative
- Quinn gate (`specs/034/quinn-gate.md` in `coffee_tracker` repo) should be verified if this work is intended to formally close the QE mandate; if the gate doesn't yet exist, the implementation agent should flag this to the operator rather than proceeding to push
