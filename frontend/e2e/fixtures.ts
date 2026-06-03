/**
 * Playwright fixtures — per-test real auth.
 *
 * Exports a `test` that overrides the `page` fixture to obtain a fresh
 * authenticated session via POST /api/e2e/session before each test. This puts
 * a valid, freshly-issued rt httpOnly cookie into the browser context,
 * preventing cookie-revocation failures caused by sharing a single
 * storageState across tests when the server rotates refresh tokens on every
 * use.
 *
 * /api/e2e/session is a zero-rate-limit alternative to /auth/login —
 * available only when the backend is running with E2E_AUTH_BYPASS=1 and
 * APP_ENV=local or APP_ENV=test.
 *
 * The fixture also calls setTokenCache() from seed.ts with the access_token
 * returned by /api/e2e/session.  This keeps the Bearer token cache in sync
 * with each test's fresh session, so seedTestData() never falls back to
 * POST /auth/login (which would overwrite the fixture's rt cookie with a new
 * one, breaking subsequent same-describe-block tests that rely on the fixture
 * rt alone).
 *
 * Usage (auth-dependent specs):
 *   import { test, expect } from './fixtures';
 *
 * Mock-auth specs (auth-refresh-state-machine, auth-refresh-service-worker)
 * continue to import from '@playwright/test' — they mock all auth routes and
 * do not need a real session.
 */
import { test as base } from '@playwright/test';
import { setTokenCache } from './seed';

export { expect } from '@playwright/test';

const BASE = process.env.PW_BASE_URL
  ? new URL(process.env.PW_BASE_URL).origin
  : 'http://localhost:8000';

/**
 * Parse the value of the `rt` cookie from a raw Set-Cookie header string.
 * Returns null if the header is absent or does not contain an `rt` cookie.
 */
function parseRtCookie(setCookieHeader: string | null): string | null {
  if (!setCookieHeader) return null;
  // Set-Cookie: rt=<value>; Path=/auth; ... (value may be quoted)
  const match = setCookieHeader.match(/(?:^|,\s*)rt="?([^";,]+)"?/);
  return match ? match[1] : null;
}

export const test = base.extend<object>({
  page: async ({ page }, use) => {
    // Obtain a fresh session for every test context via the E2E bypass
    // endpoint. The server issues a new rt httpOnly cookie and returns an
    // access_token.
    // We explicitly parse the Set-Cookie response header and inject the rt
    // cookie into the browser context via addCookies() rather than relying on
    // implicit cookie propagation from page.request to the browser jar --
    // implicit propagation is unreliable in Playwright when the cookie path
    // does not match the current page URL.
    // No request body is required -- the endpoint authenticates as the seeded
    // E2E user when E2E_AUTH_BYPASS=1.
    const res = await page.request.post(`${BASE}/api/e2e/session`);
    if (!res.ok()) {
      throw new Error(
        `[auth-fixture] POST /api/e2e/session failed (${res.status()}): ${await res.text()}`,
      );
    }

    const setCookieHeader = res.headers()['set-cookie'] ?? null;
    const rtValue = parseRtCookie(setCookieHeader);
    if (!rtValue) {
      throw new Error(
        `[auth-fixture] Set-Cookie header missing or does not contain rt cookie. ` +
          `Received Set-Cookie: ${setCookieHeader ?? '(none)'}`,
      );
    }

    const baseUrl = new URL(BASE);
    const isSecure = baseUrl.protocol === 'https:';
    const domain = baseUrl.hostname; // 'localhost' for local, hostname for remote

    // Explicitly add the rt cookie to the browser context so page navigations
    // carry it regardless of prior page URL or Playwright's internal routing.
    await page.context().addCookies([
      {
        name: 'rt',
        value: rtValue,
        domain,
        path: '/auth',
        httpOnly: true,
        sameSite: 'Lax',
        secure: isSecure,
      },
    ]);

    const { access_token } = (await res.json()) as { access_token: string };

    // Prime the seed module Bearer token cache so seedTestData() uses this
    // token instead of calling POST /auth/login -- which would overwrite the
    // fixture's rt httpOnly cookie with a new one.
    setTokenCache(access_token);

    // eslint-disable-next-line react-hooks/rules-of-hooks -- Playwright fixture `use`, not a React Hook
    await use(page);
  },
});
