import { expect, test, type Page, type Route } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const BASE = process.env.PW_BASE_URL
  ? new URL(process.env.PW_BASE_URL).origin
  : 'http://localhost:8000';

const serviceWorkerPath = fileURLToPath(new URL('../../app/static/sw.js', import.meta.url));

const authUser = {
  id: 'user-1',
  username: 'alice',
  display_name: 'Alice',
  email: 'alice@example.com',
  picture_url: null,
  household_id: 'hh-1',
  active_household_id: 'hh-1',
  role: 'admin',
  memberships: [
    {
      household_id: 'hh-1',
      household_name: 'Home',
      role: 'admin',
      joined_at: '2026-01-01T00:00:00Z',
    },
  ],
};

async function json(route: Route, status: number, body: unknown): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function mockAppData(page: Page): Promise<void> {
  const context = page.context();

  await context.route(/\/auth\/me(?:\?|$)/, (route) => json(route, 200, authUser));
  await context.route(/\/api\/dashboard(?:\?|$)/, (route) => json(route, 200, []));
  await context.route(/\/api\/brew-log(?:\?|$)/, (route) => json(route, 200, { items: [], total: 0 }));
  await context.route(/\/api\/hardware(?:\?|$)/, (route) => json(route, 200, []));
}

async function waitForServiceWorkerReady(page: Page): Promise<void> {
  await page.waitForFunction(async () => {
    if (!('serviceWorker' in navigator)) return false;
    const registration = await navigator.serviceWorker.ready;
    return registration.active?.state === 'activated';
  });
}

async function waitForServiceWorkerController(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    if (!('serviceWorker' in navigator)) return false;
    return navigator.serviceWorker.controller !== null;
  });
}

test.describe('spec-035 service worker auth refresh regression', () => {
  // Reset /auth/refresh rate-limit counters before this spec batch runs.
  // Defense-in-depth for any real requests that slip through SW/route-mock
  // timing windows.
  test.beforeAll(async ({ request }) => {
    try {
      await request.post(`${BASE}/api/e2e/reset-limiter`);
    } catch {
      // Soft guard: backend may not be started with E2E_AUTH_BYPASS=1.
    }
  });

  test('T-13: service worker auth pass-through does not side-fetch /auth/refresh', async () => {
    const source = await readFile(serviceWorkerPath, 'utf8');

    expect(source, 'Expected sw.js to keep an explicit /auth/ pass-through guard').toContain(
      "pathname.startsWith('/auth/')",
    );
    expect(source).not.toMatch(/return\s+fetch\s*\(\s*event\.request\s*\)\s*;?/);
  });

  test.describe('browser flow with service worker allowed', () => {
    test.use({ serviceWorkers: 'allow' });

    test('T-14: controlled OAuth callback flow does not duplicate refresh POSTs', async ({
      page,
      browserName,
    }) => {
      test.skip(
        browserName !== 'chromium',
        'Service-worker request visibility is asserted in Chromium; T-13 statically guards the SW source for all projects.',
      );

      await mockAppData(page);

      let refreshSucceeds = false;
      let refreshCount = 0;

      // context.route() intercepts SW-originated fetches; page.route() does not.
      await page.context().route('**/auth/refresh', async (route) => {
        refreshCount += 1;
        if (!refreshSucceeds) {
          await json(route, 401, { detail: 'Refresh token missing' });
          return;
        }
        await json(route, 200, { access_token: 'sw-controlled-token', token_type: 'bearer' });
      });

      await page.goto('/login');
      await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
      await waitForServiceWorkerReady(page);
      await page.reload({ waitUntil: 'load' });
      await waitForServiceWorkerController(page);

      refreshSucceeds = true;
      refreshCount = 0;

      await page.goto('/login?oauth_success=1');

      await expect(page).not.toHaveURL(/oauth_success=1/);
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.getByRole('heading', { name: /Espresso Logs/i })).toBeVisible();
      expect(
        refreshCount,
        'OAuth callback should issue at most one refresh POST; zero is valid when /auth/me authenticates first.',
      ).toBeLessThanOrEqual(1);
    });
  });
});
