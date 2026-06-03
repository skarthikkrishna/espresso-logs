# E2E Playwright Tests

Cross-browser (Chromium + WebKit) end-to-end tests for spec-029 Safari UI polish fixes.

## Prerequisites

The FastAPI backend **must be running** with `E2E_AUTH_BYPASS=1` and
`APP_ENV=local` before executing tests. The bypass is rejected unless
`APP_ENV` is `test` or `local`.

```bash
# From the repo root
E2E_AUTH_BYPASS=1 \
APP_ENV=local \
SPREADSHEET_ID=dummy \
USE_POSTGRES=true \
DATABASE_URL=postgresql+asyncpg://espresso:espresso@localhost:5432/espresso_logs \
SESSION_SECRET=local-dev-session-secret-at-least-32-chars \
JWT_SECRET=local-dev-jwt-secret-at-least-32-chars \
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
```

## Authentication

Tests use **real login** via a globalSetup (see `e2e/global-setup.ts`).

`playwright.config.ts` declares a `globalSetup` that:
1. Calls `POST /api/e2e/seed-user` — creates the E2E test user (`user`/`password`) and
   a household if they do not exist. **Requires Alex's backend endpoint.**
2. Calls `POST /api/e2e/session` — creates a fresh authenticated session (issues a new
   `rt` httpOnly cookie and access token) without touching the production `/auth/login`
   rate limiter.
3. Writes `playwright/.auth/user.json` — storageState reused by every browser context.

`playwright/.auth/` is gitignored. It contains real session cookies.

**If Alex's `/api/e2e/seed-user` endpoint is not yet available**, globalSetup writes an
empty storageState and logs a warning. Tests that mock all auth routes
(`auth-refresh-state-machine.spec.ts`, `auth-refresh-service-worker.spec.ts`) will
still pass. Tests that require a real session (`smoke.spec.ts`, `d3`–`d6` catalog tests)
will fail until the endpoint is implemented.

Per-test fixtures (`fixtures.ts`) also call `POST /api/e2e/session` for a fresh session
on every test — this replaces the previous per-test `POST /auth/login` and eliminates
rate-limit failures when running many tests in sequence. Both global-setup and fixtures
require `E2E_AUTH_BYPASS=1` and `APP_ENV=local` (or `test`).

## Running tests

```bash
# From frontend/
npm run test:e2e           # run all specs in Chromium + WebKit
npm run test:e2e:report    # open the HTML report after a run
```

## Why FastAPI, not Vite preview?

React Router is configured with `createBrowserRouter` without a `basename`.
When served via Vite preview at `/static/spa/`, the router sees the full path
and renders `NotFound` for every route. FastAPI's SPA catch-all route serves
`index.html` for all paths, so the browser URL is `/`, `/catalog/:id`, etc. —
matching React Router routes correctly.

In CI, set `PW_BASE_URL` to a staging environment URL. The backend webServer is
not started by Playwright; CI must point at a deployed environment.

## Test data (seed)

`seed.ts` creates `PW_TEST_`-prefixed records via the API before each test that
needs them.  After each test, `teardownSeedData` calls `DELETE /api/e2e/cleanup`
to remove the seeded records.  This endpoint is only available when the backend
is running with `E2E_AUTH_BYPASS=1`; teardown failures are logged as warnings
and do not fail the test.

API calls in `seed.ts` use the storageState cookies from globalSetup (no bypass
header is sent). The real test user's household context is used for all data
operations.

## Defects covered

| File | Defect | What it checks |
|------|--------|----------------|
| `d2-add-bag-button.spec.ts` | D2 — +Add bag clipping | `overflow: hidden`, all corners rounded |
| `d2-tokens.spec.ts` | D2 — Design token presence | All glass/bevel/btn/input CSS custom properties are defined and non-empty |
| `d3-buttons.spec.ts` | D3 — btn-bevel consistency | All `btn-bevel` elements share identical, non-`none` `box-shadow` |
| `d3-edit-button.spec.ts` | D3 — Edit bare text | border style, border alpha, appearance suppressed |
| `d4-forms.spec.ts` | D4 — input-styled consistency | All enabled `input-styled` elements share the same `background-color` and label layout |
| `d4-log-shot-button.spec.ts` | D4 — +Log Shot underline | `textDecorationLine` at rest and on hover |
| `d5-form-labels.spec.ts` | D5 — Form label alignment | label bounding box is above select bounding box |
| `d5-modals.spec.ts` | D5 — Glass modal surface | `.modal-box` has a non-empty, non-`none` `box-shadow` |
| `d6-cards.spec.ts` | D6 — card-bevel consistency | All `card-bevel` elements share the same `box-shadow` |
| `regression-029.spec.ts` | spec-029 regression guard | D2 `overflow:hidden`, D3 `-webkit-appearance:none`, D4 `text-decoration:none`, D5 `display:block` labels |
| `smoke.spec.ts` | Config health | Playwright config sanity check (requires real auth via globalSetup) |
