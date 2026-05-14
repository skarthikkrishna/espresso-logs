import { test, expect } from '@playwright/test';
import { seedTestData, teardownSeedData } from './seed';
import type { SeedResult } from './seed';

test.describe('D4-forms — input-styled consistency and label layout', () => {
  let seed: SeedResult;

  test.beforeEach(async ({ page }) => {
    seed = await seedTestData(page);
    await page.goto('./brew-log/add');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('select.input-styled', { state: 'visible', timeout: 10_000 });
  });

  test.afterEach(async ({ page }) => {
    await teardownSeedData(page, seed);
  });

  test('all enabled input-styled elements share the same background-color', async ({ page }) => {
    const backgrounds = await page.evaluate(() => {
      const inputs = Array.from(
        document.querySelectorAll<HTMLElement>('.input-styled:not(:disabled)'),
      );
      return inputs.map((el) => getComputedStyle(el).backgroundColor);
    });

    expect(
      backgrounds.length,
      'Expected at least one .input-styled element',
    ).toBeGreaterThanOrEqual(1);

    const first = backgrounds[0];
    for (const bg of backgrounds) {
      expect(bg, 'All input-styled elements must share the same background-color').toBe(first);
    }
  });

  test('labels inside .form-control are display:block (label-above-input layout)', async ({ page }) => {
    const displayValues = await page.evaluate(() => {
      const labels = Array.from(
        document.querySelectorAll<HTMLElement>('.form-control > .label'),
      );
      return labels.map((el) => getComputedStyle(el).display);
    });

    expect(
      displayValues.length,
      'Expected at least one .form-control > .label',
    ).toBeGreaterThanOrEqual(1);

    for (const display of displayValues) {
      expect(display, 'Expected label to be display:block').toBe('block');
    }
  });
});
