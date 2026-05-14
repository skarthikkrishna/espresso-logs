# E2E Playwright Tests

Cross-browser (Chromium + WebKit) end-to-end tests for spec-029 Safari UI polish fixes.

## Prerequisites

The FastAPI backend **must be running** with `E2E_AUTH_BYPASS=1` before executing tests:

```bash
# From the repo root
E2E_AUTH_BYPASS=1 uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
```

The backend bypass returns a synthetic test user so Google OAuth is not required locally.

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
| `smoke.spec.ts` | Config health | Playwright config sanity check |
