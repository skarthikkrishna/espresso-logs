import { test, expect } from './fixtures';
import { seedTestData, teardownSeedData } from './seed';
import type { SeedResult } from './seed';

test.describe('D3 — Edit button styling', () => {
  let seed: SeedResult;

  test.beforeEach(async ({ page }) => {
    seed = await seedTestData(page);
    await page.goto(`/catalog/${seed.catalogItemId}`);
    // 20 s covers seed API round-trip + auth cookie + catalog data fetch on WebKit.
    await page.waitForSelector('[data-testid="catalog-detail"]', { timeout: 20_000 });
  });

  test.afterEach(async ({ page }) => {
    await teardownSeedData(page, seed);
  });

  test('Edit button is visible', async ({ page }) => {
    const button = page.getByRole('button', { name: 'Edit' });
    await expect(button).toBeVisible();
  });

  test('border style is not none', async ({ page }) => {
    const button = page.getByRole('button', { name: 'Edit' });
    await expect(button).toBeVisible();

    const borderStyle = await button.evaluate(
      (el) => getComputedStyle(el).borderStyle,
    );
    expect(borderStyle).not.toBe('none');
  });

  test('border color has non-zero alpha', async ({ page }) => {
    const button = page.getByRole('button', { name: 'Edit' });
    await expect(button).toBeVisible();

    const borderColor = await button.evaluate(
      (el) => getComputedStyle(el).borderColor,
    );

    // borderColor is typically "rgba(r, g, b, a)" or "rgb(r, g, b)".
    // Extract alpha: rgba() has 4 components; rgb() implies alpha 1.
    const rgbaMatch = borderColor.match(
      /rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)/,
    );
    const alpha = rgbaMatch ? parseFloat(rgbaMatch[1]) : 1;

    expect(alpha, `expected border color to have non-zero alpha, got: ${borderColor}`).toBeGreaterThan(0);
  });

  test('appearance is suppressed (webkit-appearance or appearance is none)', async ({ page }) => {
    const button = page.getByRole('button', { name: 'Edit' });
    await expect(button).toBeVisible();

    const { webkitAppearance, appearance } = await button.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        webkitAppearance: (s as any).webkitAppearance as string | undefined,
        appearance: s.appearance,
      };
    });

    const isNone =
      webkitAppearance === 'none' || appearance === 'none';

    expect(
      isNone,
      `expected webkitAppearance or appearance to be 'none', got webkitAppearance=${webkitAppearance} appearance=${appearance}`,
    ).toBe(true);
  });
});
