# Routing Decision: E2E Test Harness JWT Auth Repair

**Date**: 2026-05-23 09:56:04  
**Agent**: Tariq (Routing)  
**Branch**: `feat/034-m5-household-roles`  
**Repository**: espresso-logs

---

## Request Summary

Fix e2e test harness failures caused by auth model migration from legacy session cookies to JWT access tokens + HttpOnly refresh tokens.

**Requested Changes**:
1. Update `tests/e2e/conftest.py` auth fixture to work with current auth model or E2E_AUTH_BYPASS
2. Add default `E2E_BASE_URL=http://localhost:8000` handling and ensure failing UI test uses it
3. Update `tests/e2e/test_e2e_browser.py` expectations for SPA shell root route and fix pytest-asyncio / Playwright runner conflicts
4. Avoid rate-limit failures during e2e due to `/auth/refresh` 429s using least-invasive test-side configuration

**Constraints**:
- Only modify `tests/e2e/` files
- Do NOT push after completion
- Run live-server e2e suite and non-e2e backend tests to verify

---

## Routing Decision

**Status**: `DIRECT_PERMITTED`

### Rationale

This is a **bounded test infrastructure repair**, not a feature or product behavior change:

1. **Scope is explicit and constrained**:
   - Changes limited to `tests/e2e/` directory only
   - No production code (`app/`, `frontend/`) affected
   - Enumerated fix list with clear success criteria

2. **Repair context**:
   - Auth model migration already occurred (JWT implementation is production code)
   - E2E test harness is simply catching up to existing behavior
   - No new test coverage being added — fixing existing broken harness

3. **Risk profile is low**:
   - Test-only changes cannot break production behavior
   - Verification step built in (run e2e + backend tests)
   - Work is reversible if tests still fail

4. **No SpecKit triggers present**:
   - ❌ No feature development
   - ❌ No API contract changes
   - ❌ No user-facing behavior changes
   - ❌ No architecture decisions required
   - ❌ No multi-domain coordination needed

5. **Clear acceptance criteria**:
   - E2E tests pass against live server with JWT auth
   - No auth-bypass environment variable pollution
   - Rate-limit handling doesn't require upstream code changes

### Classification

- **Type**: Test infrastructure repair
- **Complexity**: Medium (technical understanding of JWT flow required)
- **Effort**: Small (4 enumerated fixes in test code only)
- **Dependencies**: None (JWT auth implementation already exists)

### Ownership Assignment

**Quinn** should execute this work:
- Test harness is Quinn's domain
- Auth fixture logic requires understanding of test patterns
- Verification requires running full test suite (Quinn's specialty)

---

## Next Steps

1. Coordinator verifies this decision drop is committed before proceeding
2. Coordinator spawns **Quinn** via `task` tool with full context
3. Quinn executes all 4 fixes and runs verification suite
4. Quinn commits with message: `test(e2e): update harness for JWT auth + fix base_url + fix runner conflicts (#034)`
5. Session completes without push (per explicit constraint)

---

**Decision Final**: DIRECT_PERMITTED — no SpecKit cycle required for test-only repair work.
