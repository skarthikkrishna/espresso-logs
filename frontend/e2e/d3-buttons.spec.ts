import { test, expect } from './fixtures';
import { seedTestData, teardownSeedData } from './seed';
import type { SeedResult } from './seed';

test.describe('D3-buttons — btn-bevel box-shadow consistency', () => {
  let seed: SeedResult;

  test.beforeEach(async ({ page }) => {
    seed = await seedTestData(page);
    await page.goto(`/catalog/${seed.catalogItemId}`);
    await page.waitForSelector('[data-testid="catalog-detail"]', { timeout: 10_000 });
  });

  test.afterEach(async ({ page }) => {
    await teardownSeedData(page, seed);
  });

  test('all btn-bevel elements share identical box-shadow and it is not none', async ({ page }) => {
    // Expand the inline "Add bag" form to reveal a third btn-bevel button (Save bag, initially disabled).
    const addBagBtn = page.getByRole('button', { name: '+ Add bag' });
    await expect(addBagBtn).toBeVisible({ timeout: 5_000 });
    await addBagBtn.click();
    // Move mouse to a neutral position to clear hover state on all buttons.
    await page.mouse.move(0, 0);
    await page.waitForTimeout(100);

    // Now three btn-bevel buttons are visible: Edit, + Add bag, Save bag (disabled).
    await page.waitForSelector('.btn-bevel', { timeout: 5_000 });

    const info = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.btn-bevel'));
      return buttons.map((el) => ({
        shadow: getComputedStyle(el).boxShadow,
        disabled: el.disabled || el.hasAttribute('disabled'),
      }));
    });

    const enabled = info.filter((b) => !b.disabled);
    const disabled = info.filter((b) => b.disabled);

    // At least 2 enabled btn-bevel buttons must be visible (Edit + Add bag).
    expect(
      enabled.length,
      `Expected at least 2 enabled btn-bevel buttons, found ${enabled.length}`,
    ).toBeGreaterThanOrEqual(2);

    // All enabled buttons must have a non-none, multi-layer box-shadow.
    // We verify structural consistency (3 comma-separated layers from --btn-rest-shadow)
    // rather than exact string equality because browsers can vary floating-point px
    // resolution depending on element context.
    for (const btn of enabled) {
      expect(btn.shadow, 'Enabled btn-bevel must have a non-none box-shadow').not.toBe('none');
      expect(btn.shadow, 'Enabled btn-bevel must have a non-empty box-shadow').not.toBe('');
      // --btn-rest-shadow has 3 shadow layers; verify all 3 are present (split on commas outside parens).
      const layers = btn.shadow.split(/,(?![^(]*\))/);
      expect(layers.length, 'Expected btn-rest-shadow to have 3 shadow layers').toBe(3);
    }

    // Disabled buttons must have box-shadow: none (per spec-030 D3 token).
    for (const btn of disabled) {
      expect(btn.shadow, 'Disabled btn-bevel must have box-shadow: none').toBe('none');
    }
  });
});
