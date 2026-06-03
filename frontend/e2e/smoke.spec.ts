/**
 * Config smoke check — verifies Playwright can navigate and both browser
 * projects (chromium, webkit) are wired up correctly.
 *
 * DEPENDENCY: requires globalSetup to have successfully written
 * playwright/.auth/user.json (i.e. Alex's POST /api/e2e/seed-user must exist
 * and the backend must be running with E2E_AUTH_BYPASS=1).
 */
import { test, expect } from './fixtures';

test('app loads and renders authenticated dashboard', async ({ page }) => {
  await page.goto('/');
  // storageState from globalSetup provides the rt cookie; the SPA refreshes,
  // loads the seed user's household, and renders the dashboard.
  await expect(page.getByRole('heading', { name: /Espresso Logs/i })).toBeVisible();
  await expect(page.getByRole('button', { name: '+ Log Shot' })).toBeVisible();
});
