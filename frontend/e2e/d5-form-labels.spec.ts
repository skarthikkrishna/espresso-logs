import { test, expect } from '@playwright/test';
import { seedTestData, teardownSeedData } from './seed';
import type { SeedResult } from './seed';

test.describe('D5 — Add Shot form label alignment', () => {
  let seed: SeedResult;

  test.beforeEach(async ({ page }) => {
    seed = await seedTestData(page);
    await page.goto('./brew-log/add');
    // Wait for the inventory fetch to complete so the Bag select is populated
    await page.waitForSelector(
      'select option:not([value=""]):not([disabled])',
      { timeout: 10_000 },
    );
  });

  test.afterEach(async ({ page }) => {
    await teardownSeedData(page, seed);
  });

  test('Bag label is above Bag select', async ({ page }) => {
    const formControl = page
      .locator('.form-control')
      .filter({ has: page.locator('span.label-text', { hasText: /^Bag$/ }) })
      .first();

    const label = formControl.locator('label.label');
    const select = formControl.locator('select');

    const labelBox = await label.boundingBox();
    const selectBox = await select.boundingBox();

    expect(labelBox).not.toBeNull();
    expect(selectBox).not.toBeNull();
    // Label bottom edge must be strictly above select top edge
    expect(labelBox!.y + labelBox!.height).toBeLessThan(selectBox!.y);
  });

  test('Shot eligibility label is above select', async ({ page }) => {
    const formControl = page
      .locator('.form-control')
      .filter({ has: page.locator('span.label-text', { hasText: /Shot eligibility/ }) })
      .first();

    const label = formControl.locator('label.label');
    const select = formControl.locator('select');

    const labelBox = await label.boundingBox();
    const selectBox = await select.boundingBox();

    expect(labelBox).not.toBeNull();
    expect(selectBox).not.toBeNull();
    expect(labelBox!.y + labelBox!.height).toBeLessThan(selectBox!.y);
  });

  test('Basket label is above select', async ({ page }) => {
    const formControl = page
      .locator('.form-control')
      .filter({ has: page.locator('span.label-text', { hasText: /^Basket$/ }) })
      .first();

    const label = formControl.locator('label.label');
    const select = formControl.locator('select');

    const labelBox = await label.boundingBox();
    const selectBox = await select.boundingBox();

    expect(labelBox).not.toBeNull();
    expect(selectBox).not.toBeNull();
    expect(labelBox!.y + labelBox!.height).toBeLessThan(selectBox!.y);
  });
});
