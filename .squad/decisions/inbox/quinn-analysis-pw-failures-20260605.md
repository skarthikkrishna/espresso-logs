# Quinn: Playwright Test Failure Analysis & Fix Plan
**Date:** 2026-06-05T14:00 PDT  
**Branch:** fix/prod-oauth-callback  
**Requested by:** Karthik Krishna Subramanian  

## Routing Decision
**status: DIRECT_PERMITTED**

This is a **diagnostic + planning-only task** within Quinn's QA domain. No code changes or implementation. Analysis of existing test artifacts and recommendations for Finn (frontend) and Alex (backend) to execute.

---

## Root Cause Analysis

### Summary
6 Playwright E2E tests fail in the full suite (`--retries=0`) due to **accumulated rate-limit exhaustion** of the `/auth/refresh` endpoint during the d2-tokens block, cascading 401 Unauthorized failures through subsequent specs.

**Evidence:** Diagnostic harness in `tmp/auth-refresh-diagnostics-20260605T130009/` confirms:
- **Isolated tests pass** — all failing specs pass 100% when run alone
- **Rate limit is exhausted** — d2-tokens makes 30 page loads × 2 browsers = 60 POST /auth/refresh calls in ~1 minute, exceeding the 20/minute limit
- **Endpoint not implemented** — `/api/e2e/reset-limiter` endpoint called in global-setup does exist and does work (Alex implemented it), but the problem is upstream

### Failure Chain
1. **d2-tokens.spec.ts** — 15 CSS token tests × 2 browsers = 30 tests
   - Each `beforeEach`: `page.goto('./')` + `waitForLoadState('networkidle')`
   - Each page load triggers `AuthContext.attemptRefresh()` → `POST /auth/refresh`
   - 30 POSTs in ~60 seconds exhausts the 20/min rate limit window
   
2. **d3-edit-button.spec.ts** (and d3-buttons, regression-029 D5) — tests run next
   - Their `beforeEach` also tries `POST /auth/refresh` → **429 Too Many Requests**
   - `AuthContext.isRetryableRefreshError(429)` returns `false` → treats as non-retryable
   - App transitions to `UNAUTHENTICATED` state
   - All subsequent API calls return **401 Unauthorized** (no Bearer token sent)
   - `waitForSelector('[data-testid="catalog-detail"]')` times out at 20s → **test failure**

### Failed Tests
Per diagnostic summary (lines 49–62 of summary.md):
| Test | Error | Suite |
|------|-------|-------|
| [webkit] D3-buttons › box-shadow consistency | TimeoutError waitForSelector 20000ms | d3-buttons |
| [chromium] D3 Edit › border color alpha | TimeoutError waitForSelector 20000ms | d3-edit-button |
| [chromium] D3 Edit › appearance suppressed | TimeoutError waitForSelector 20000ms | d3-edit-button |
| [webkit] regression-029 D5 › Bag label above select | TimeoutError waitForSelector 15000ms | regression-029 |

**Note:** d5-modals and d6-cards specs passed in the full suite (lines 88–96 of full-suite.log) — they do not navigate to catalog pages with seed data, so they don't get caught by the rate-limit cascading failures.

---

## Recommended Fixes

### Fix #1: Reduce d2-tokens Page Load Intensity [Finn - Frontend]
**Severity:** BLOCKING  
**Rationale:** d2-tokens' 30 sequential full page loads (each with AuthContext init) is the root cause.

**Option A (Preferred):** Refactor d2-tokens to verify CSS tokens without a real app page load
- CSS custom properties are static content — can be inspected on any DOM element
- Use a minimal test harness or a single navigation to load the app once, then verify tokens in all 15 tests
- Change `beforeEach` to `beforeAll` + shared page state

**Option B (Fallback):** Use a single `beforeAll` navigation instead of `beforeEach`
- Keeps the real auth page load but reduces 30 navigations to 1 per browser
- Reduces `/auth/refresh` POSTs from 60 to 4 (initial global-setup + 1 per browser)
- Less comprehensive but simpler

### Fix #2: Improve Rate-Limiter Reset Mechanism [Alex - Backend]
**Severity:** BLOCKING (for d2-token fix)  
**Rationale:** Even with Fix #1, a safety mechanism prevents future flakiness.

**Current state:**
- `/api/e2e/reset-limiter` endpoint exists and is called in global-setup.ts
- But it's called AFTER the initial E2E session is created — no rate-limit buffer for d2-tokens

**Recommended:**
- Verify the endpoint is being called correctly and that `limiter._storage.reset()` is working
- Consider moving the call to after all initial auth setup + data seeding, right before test suite starts
- OR add a secondary reset call in the `beforeAll` of d2-tokens (if Fix #1 Option A is chosen)

### Fix #3: Investigate React StrictMode Double-Invoke [Finn - Frontend]
**Severity:** MEDIUM (secondary issue, does not cause failures directly)  
**Evidence:** Many API endpoints appear twice in backend logs (200 then 401) even when refresh succeeds

**Cause:** Likely React StrictMode double-invoke in `AuthContext` or `CatalogDetail` `useEffect` without proper cleanup guards

**Recommended:**
- Use `useRef` guard or `AbortController` to prevent double-invoke
- Not blocking but improves test reliability and reduces noise in backend logs

### Fix #4: Verify GET /auth/refresh Source [Finn/Alex - Frontend/Backend]
**Severity:** LOW (secondary issue, does not affect core functionality)  
**Evidence:** 56 GET /auth/refresh requests appear in backend logs, always after POST on same connection

**Rationale:** There is no registered GET route for `/auth/refresh` — the SPA catch-all serves `index.html`. Source is likely service worker network-first handler or browser prefetch.

**Recommended:**
- Trace the exact source (Playwright HAR dump, service worker log)
- If from service worker, add `/auth/refresh` to the no-cache list to prevent caching HTML as auth response

---

## Implementation Sequence

1. **[Immediate] Alex:** Verify `/api/e2e/reset-limiter` is working correctly in global-setup and that `limiter._storage.reset()` is actually clearing the storage
2. **[Blocking] Finn:** Implement Fix #1 Option A (preferred) — refactor d2-tokens to reduce page loads from 30 to 1–2 per browser
3. **[Secondary] Finn:** Implement Fix #3 — add useRef guard or AbortController to prevent StrictMode double-invoke
4. **[Optional] Finn/Alex:** Implement Fix #4 — verify and fix GET /auth/refresh source

---

## Verification Steps

After fixes are implemented:
1. Run `playwright test e2e/d2-tokens.spec.ts --retries=0` (isolated) — should pass
2. Run `playwright test e2e/d3-edit-button.spec.ts --retries=0` (isolated) — should pass  
3. Run `playwright test --retries=0` (full suite) — all 98 tests should pass
4. If any timeouts occur, check backend logs for 429 or 401 patterns

---

## Files Affected

### Frontend
- `frontend/e2e/d2-tokens.spec.ts` — Test structure (beforeEach → beforeAll + shared navigation)
- `frontend/src/components/AuthContext.tsx` — useEffect guards (StrictMode double-invoke)
- `frontend/src/service-worker.ts` — Cache rules for /auth/refresh

### Backend
- `app/routers/api_e2e.py` — Verify `/api/e2e/reset-limiter` and timing
- `app/main.py` — Confirm slowapi limiter configuration

### Test Config
- `frontend/e2e/global-setup.ts` — Rate-limiter reset timing

---

**Quinn (QA Agent)**  
Decision drop generated 2026-06-05T14:00 PDT
