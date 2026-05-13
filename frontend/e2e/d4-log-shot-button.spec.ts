import { test, expect } from '@playwright/test';

test.describe('D4 — +Log Shot button underline', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./');
  });

  test('no underline at rest', async ({ page }) => {
    const btn = page.getByRole('button', { name: '+ Log Shot' });
    await expect(btn).toBeVisible();
    const decoration = await btn.evaluate(
      (el) => getComputedStyle(el).textDecorationLine,
    );
    expect(decoration).not.toContain('underline');
  });

  test('no underline on hover', async ({ page }) => {
    const btn = page.getByRole('button', { name: '+ Log Shot' });
    await expect(btn).toBeVisible();
    await btn.hover();
    const decoration = await btn.evaluate(
      (el) => getComputedStyle(el).textDecorationLine,
    );
    expect(decoration).not.toContain('underline');
  });
});
