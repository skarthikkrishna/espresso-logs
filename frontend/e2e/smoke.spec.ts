/**
 * Placeholder spec — ensures `npx playwright test --list` resolves with both
 * chromium and webkit projects while D2–D5 specs (T013–T016) are pending.
 * Remove this file once the full suite exists.
 */
import { test, expect } from '@playwright/test';

test('placeholder — config smoke check', async ({ page }) => {
  await page.goto('./');
  await expect(page).not.toBeNull();
});
