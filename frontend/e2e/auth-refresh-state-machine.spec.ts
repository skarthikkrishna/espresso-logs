import { expect, test, type Page, type Route } from '@playwright/test';

const BASE = process.env.PW_BASE_URL
  ? new URL(process.env.PW_BASE_URL).origin
  : 'http://localhost:8000';

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

test.use({ serviceWorkers: 'block' });

async function json(route: Route, status: number, body: unknown): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function mockAppData(page: Page): Promise<void> {
  await page.route(/\/auth\/me(?:\?|$)/, (route) => json(route, 200, authUser));
  await page.route(/\/api\/dashboard(?:\?|$)/, (route) => json(route, 200, []));
  await page.route(/\/api\/brew-log(?:\?|$)/, (route) => json(route, 200, { items: [], total: 0 }));
  await page.route(/\/api\/hardware(?:\?|$)/, (route) => json(route, 200, []));
}

test.describe('spec-035 auth refresh state machine', () => {
  // Reset /auth/refresh rate-limit counters before this spec batch runs.
  // Defense-in-depth: even though all refresh calls are route-mocked, any
  // leaked real requests from service-worker timing races will not 429 later
  // specs.
  test.beforeAll(async ({ request }) => {
    try {
      await request.post(`${BASE}/api/e2e/reset-limiter`);
    } catch {
      // Soft guard: backend may not be started with E2E_AUTH_BYPASS=1.
    }
  });

  test('T-03: OAuth callback sends at most one refresh POST and clears the callback URL', async ({ page }) => {
    await mockAppData(page);
    let refreshCount = 0;
    await page.route('**/auth/refresh', async (route) => {
      refreshCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 100));
      await json(route, 200, { access_token: 'oauth-callback-token', token_type: 'bearer' });
    });

    await page.goto('/login?oauth_success=1');

    await expect(page).not.toHaveURL(/oauth_success=1/);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText(/espresso/i)).toBeVisible();
    expect(refreshCount).toBe(1);
  });

  test('T-05: returning user restores session with one refresh and no login loop', async ({ page }) => {
    await mockAppData(page);
    let refreshCount = 0;
    await page.route('**/auth/refresh', async (route) => {
      refreshCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 100));
      await json(route, 200, { access_token: 'returning-token', token_type: 'bearer' });
    });

    await page.goto('/');

    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText(/espresso/i)).toBeVisible();
    expect(refreshCount).toBe(1);
  });

  test('T-06: 401 refresh redirects to login without retry', async ({ page }) => {
    let refreshCount = 0;
    await page.route('**/auth/refresh', async (route) => {
      refreshCount += 1;
      await json(route, 401, { detail: 'Invalid refresh token' });
    });

    await page.goto('/');

    await expect(page).toHaveURL(/\/login/);
    expect(refreshCount).toBe(1);
  });

  test('T-07: two 5xx refresh failures retry and then restore the session', async ({ page }) => {
    await mockAppData(page);
    let refreshCount = 0;
    await page.route('**/auth/refresh', async (route) => {
      refreshCount += 1;
      if (refreshCount < 3) {
        await json(route, 500, { detail: 'temporary failure' });
        return;
      }
      await json(route, 200, { access_token: 'eventual-token', token_type: 'bearer' });
    });

    await page.goto('/');

    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText(/espresso/i)).toBeVisible();
    expect(refreshCount).toBe(3);
  });

  test('T-08: three 5xx refresh failures redirect cleanly after retry exhaustion', async ({ page }) => {
    let refreshCount = 0;
    await page.route('**/auth/refresh', async (route) => {
      refreshCount += 1;
      await json(route, 500, { detail: 'temporary failure' });
    });

    await page.goto('/');

    await expect(page).toHaveURL(/\/login/);
    expect(refreshCount).toBe(3);
  });

  test('T-11: first visit with no rt cookie sends one refresh and lands on login', async ({ page }) => {
    let refreshCount = 0;
    await page.route('**/auth/refresh', async (route) => {
      refreshCount += 1;
      await json(route, 401, { detail: 'Refresh token missing' });
    });

    await page.goto('/');

    await expect(page).toHaveURL(/\/login/);
    expect(refreshCount).toBe(1);
  });

  test('T-12: after logout, protected navigation redirects without a new refresh', async ({ page }) => {
    await mockAppData(page);
    let refreshCount = 0;
    await page.route('**/auth/refresh', async (route) => {
      refreshCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 100));
      await json(route, 200, { access_token: 'logout-token', token_type: 'bearer' });
    });
    await page.route('**/auth/logout', (route) => json(route, 200, {}));

    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: /profile/i })).toBeVisible();
    expect(refreshCount).toBe(1);

    await page.getByRole('button', { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.evaluate(() => {
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await expect(page).toHaveURL(/\/login/);
    expect(refreshCount).toBe(1);
  });
});
