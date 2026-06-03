import { defineConfig, devices } from '@playwright/test';

// In local dev: point at the FastAPI backend running with E2E_AUTH_BYPASS=1.
// React Router has no basename, so routing only works correctly when the app
// is served via FastAPI's catch-all (which strips /static/spa/ from the URL).
// Vite preview at /static/spa/ causes React Router to match NotFound for all routes.
//
// In CI: set PW_BASE_URL to the staging environment URL.
// Local dev: start the backend with `E2E_AUTH_BYPASS=1 uv run uvicorn app.main:app`
const BASE_URL = process.env.PW_BASE_URL || 'http://localhost:8000';

export default defineConfig({
  testDir: './e2e',
  // global-setup performs real login via POST /api/e2e/seed-user + POST /auth/login
  // and writes playwright/.auth/user.json for the browser context.
  // DEPENDENCY: requires Alex's POST /api/e2e/seed-user endpoint.
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Keep browser projects serialized: seed/teardown share the same test user's
  // household, so tests must not run concurrently or one teardown may reset
  // state mid-test for another.
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // No global storageState: auth-dependent specs import `test` from
    // ./fixtures, which performs a fresh POST /auth/login per test context.
    // This prevents cookie-revocation failures when the server rotates the rt
    // httpOnly cookie on every refresh.  Mock-auth specs (auth-refresh-*)
    // import from @playwright/test and start with a clean, cookieless context.
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  // No webServer: the FastAPI backend must be running externally.
  // For CI, PW_BASE_URL should point to a pre-deployed staging environment.
});
