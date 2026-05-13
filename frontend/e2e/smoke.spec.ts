/**
 * Config smoke check — verifies Playwright can navigate and both browser
 * projects (chromium, webkit) are wired up correctly.
 */
import { test, expect } from '@playwright/test';

test('placeholder — config smoke check', async ({ page }) => {
  await page.goto('./');
  await expect(page).not.toBeNull();
});
