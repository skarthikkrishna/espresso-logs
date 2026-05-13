/**
 * Config smoke check — verifies Playwright can navigate and both browser
 * projects (chromium, webkit) are wired up correctly.
 */
import { test, expect } from '@playwright/test';

test('app loads and renders navigation', async ({ page }) => {
  await page.goto('./');
  // Sidebar brand text is always rendered on desktop viewport; confirms React mounted and routing works
  await expect(page.getByText('Coffee Tracker')).toBeVisible();
  await expect(page.locator('#main-content')).toBeVisible();
});
