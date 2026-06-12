import { test, expect } from './fixtures';

test.describe('D4 — +Log Shot button underline', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./');
    // Dashboard has isLoading / isError early returns; wait until the
    // success state renders before asserting on the "+ Log Shot" button.
    await page.waitForLoadState('networkidle');
  });

  test('no underline at rest', async ({ page }) => {
    const btn = page.getByRole('button', { name: 'Log a shot' });
    await expect(btn).toBeVisible({ timeout: 15_000 });
    const decoration = await btn.evaluate(
      (el) => getComputedStyle(el).textDecorationLine,
    );
    expect(decoration).not.toContain('underline');
  });

  test('no underline on hover', async ({ page }) => {
    const btn = page.getByRole('button', { name: 'Log a shot' });
    await expect(btn).toBeVisible({ timeout: 15_000 });
    await btn.hover();
    const decoration = await btn.evaluate(
      (el) => getComputedStyle(el).textDecorationLine,
    );
    expect(decoration).not.toContain('underline');
  });
});
