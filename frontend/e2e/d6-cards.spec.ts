import { test, expect } from './fixtures';
import { seedTestData, teardownSeedData } from './seed';
import type { SeedResult } from './seed';

test.describe('D6-cards — card-bevel consistency', () => {
  let seed: SeedResult;

  test.beforeEach(async ({ page }) => {
    seed = await seedTestData(page);
    await page.goto(`catalog/${seed.catalogItemId}`);
    await page.waitForSelector('[data-testid="catalog-detail"]', { timeout: 10_000 });
  });

  test.afterEach(async ({ page }) => {
    await teardownSeedData(page, seed);
  });

  test('all card-bevel elements share the same box-shadow', async ({ page }) => {
    await page.waitForSelector('.card-bevel', { timeout: 5_000 });

    const shadows = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll<HTMLElement>('.card-bevel'));
      return cards.map((el) => getComputedStyle(el).boxShadow);
    });

    expect(
      shadows.length,
      'Expected at least one .card-bevel element',
    ).toBeGreaterThanOrEqual(1);

    const first = shadows[0];
    for (const shadow of shadows) {
      expect(shadow, 'All card-bevel elements must share the same box-shadow').toBe(first);
    }
  });

  test('all card-bevel elements have overflow: hidden', async ({ page }) => {
    await page.waitForSelector('.card-bevel', { timeout: 5_000 });

    const overflows = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll<HTMLElement>('.card-bevel'));
      return cards.map((el) => getComputedStyle(el).overflow);
    });

    expect(
      overflows.length,
      'Expected at least one .card-bevel element',
    ).toBeGreaterThanOrEqual(1);

    for (const overflow of overflows) {
      expect(overflow, 'Expected card-bevel to have overflow: hidden').toBe('hidden');
    }
  });
});
