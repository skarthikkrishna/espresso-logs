# Spec-035 Auth Refresh Validation Evidence

Scope: release evidence for the OAuth login-loop fix. Automated evidence is necessary but not sufficient; real browser checks are required for Google OAuth, Safari ITP, and multi-tab replay timing.

## Automated evidence boundary

T-01/T-02 are source-module concurrency tests for the shared `refreshAccessToken()` in-flight promise, so Vitest is the authoritative layer. A prior Playwright module-harness attempted to import `/src/api/client.ts`; that only works against a Vite dev server and skips against the FastAPI/staging `PW_BASE_URL`, so it is not release-grade browser-flow evidence.

- T-01: `frontend/src/api/client.test.ts` calls `refreshAccessToken()` from 2 concurrent callers, holds the mocked `axios.post('/auth/refresh')` promise open, asserts exactly 1 POST, and asserts both callers resolve with the same token.
- T-02: `frontend/src/api/client.test.ts` repeats the same direct source-module assertion with 3 concurrent callers.
- Additional AC-035-01 guard: `frontend/src/api/client.test.ts` also verifies 2 simultaneous 401 interceptor retries share one refresh POST and both original requests retry with the shared token.
- Playwright is reserved for browser-flow evidence: T-03/T-05/T-06/T-07/T-08/T-11/T-12. T-03 asserts `/login?oauth_success=1` clears the callback URL, reaches the app, and sends exactly one refresh POST in the mocked returning-user flow.
- Localhost loop regression evidence added after diagnosis: backend pytest now covers `/auth/callback` as an alias of the canonical Google OAuth callback and verifies the callback sets the `rt` cookie; Playwright T-13/T-14 guard that an active service worker does not duplicate `/auth/refresh`.

## Diagnosed localhost loop causes

Observed on localhost after OAuth redirect:

1. Google redirected to `/auth/callback`, but the backend only handled `/auth/google/callback`; FastAPI fell through to the SPA catch-all, returned HTML, and never set the `rt` cookie.
2. The active service worker performed a bare `return fetch(event.request)` for `/auth/*` requests without `event.respondWith(...)` or a plain pass-through `return;`, creating a side fetch in addition to the browser request. For `/auth/refresh`, that can rotate the same refresh token twice and trigger the login loop.

After a backend/frontend restart, validate with a clean browser state:

1. Stop and restart FastAPI so the `/auth/callback` route and current `sw.js` are served.
2. In DevTools Application, unregister old service workers and clear site data for `localhost`.
3. Complete Google OAuth with the localhost redirect URI.
4. In Network, verify `/auth/callback` returns a 302 to `/login?oauth_success=1`, includes a `Set-Cookie: rt=...` header, and the subsequent browser flow shows exactly one `POST /auth/refresh`.
5. Confirm the URL clears `oauth_success` and lands on `/` or `/welcome` without returning to `/login`.

If Playwright T-14 still observes two refresh POSTs, confirm the FastAPI process was restarted after the `sw.js` change and that the browser is not still controlled by an older service worker.

## Manual operator evidence

| Area | Steps | Expected evidence |
|---|---|---|
| Real Google OAuth — returning user | Preserve DevTools Network log, clear app cookies, sign in with Google, inspect first `POST /auth/refresh` after `/login?oauth_success=1`. | User reaches `/` or intended route within 3s, URL no longer has `oauth_success`, and there are 0–1 refresh POSTs, never 2. Screenshot/network HAR attached. |
| Real Google OAuth — first sign-in | Use a Google account without app household membership, complete OAuth. | User reaches `/welcome`, no login loop, refresh POST count is 0–1. Screenshot/network HAR attached. |
| Safari ITP | Repeat the returning-user OAuth flow on real macOS/iOS Safari, not Playwright WebKit. | Document whether `rt` is present on the first refresh request and confirm no loop. |
| Multi-tab replay | Open two authenticated tabs. Trigger refresh in one tab, then quickly navigate in the other tab. | Other active sessions remain usable for stale-token replay inside 5s; no login loop. If replay is >5s, all sessions are revoked and UX lands cleanly on `/login`. |

## Release gate checklist

- [ ] Backend pytest covers migration, `rotated_at` set on rotation, T-09, T-10, and NULL `rotated_at`.
- [ ] Frontend Vitest covers T-01/T-02 dedup, state machine transitions, retry/no-retry matrix, and no refresh-token browser storage.
- [ ] Playwright evidence exists for browser-flow T-03/T-05/T-06/T-07/T-08/T-11/T-12, or the PR explicitly documents why `PW_BASE_URL`/local server was unavailable. T-01/T-02 remain Vitest-only source-module evidence.
- [ ] Localhost loop regressions covered: `/auth/callback` aliases canonical OAuth callback behavior and active `sw.js` does not side-fetch `/auth/refresh`.
- [ ] Manual evidence above is attached to the PR or linked from the PR description.
- [ ] Rollback confirmed: backend replay logic can be reverted; additive `rotated_at` migration is safe to leave or downgrade with `alembic downgrade -1`.
- [ ] No `[NEEDS CLARIFICATION]` remains in spec-035 artifacts.
