import { test, expect } from './fixtures';
import { seedTestData, teardownSeedData } from './seed';
import type { SeedResult } from './seed';

test.describe('D2 — +Add bag button rendering', () => {
  let seed: SeedResult;

  test.beforeEach(async ({ page }) => {
    seed = await seedTestData(page);
    await page.goto(`catalog/${seed.catalogItemId}`);
    await page.waitForSelector('[data-testid="catalog-detail"]');
  });

  test.afterEach(async ({ page }) => {
    await teardownSeedData(page, seed);
  });

  test('overflow is hidden', async ({ page }) => {
    const button = page.getByRole('button', { name: '+ Add bag' });
    await expect(button).toBeVisible();

    const overflow = await button.evaluate(
      (el) => getComputedStyle(el).overflow,
    );
    expect(overflow).toBe('hidden');
  });

  test('all corners rounded', async ({ page }) => {
    const button = page.getByRole('button', { name: '+ Add bag' });
    await expect(button).toBeVisible();

    const corners = await button.evaluate((el) => {
      const s = getComputedStyle(el);
      return [
        s.borderTopLeftRadius,
        s.borderTopRightRadius,
        s.borderBottomRightRadius,
        s.borderBottomLeftRadius,
      ];
    });

    for (const corner of corners) {
      expect(corner, `expected border-radius corner to be non-zero, got: ${corner}`).not.toBe('0px');
    }
  });
});
