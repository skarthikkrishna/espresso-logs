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
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
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
  // No webServer: the FastAPI backend must be running externally with E2E_AUTH_BYPASS=1.
  // For CI, PW_BASE_URL should point to a pre-deployed staging environment.
});
