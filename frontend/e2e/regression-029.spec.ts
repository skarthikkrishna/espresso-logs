/**
 * spec-029 regression guard — ensures spec-030 changes did not break prior acceptance criteria.
 *
 * D2: Cards have overflow:hidden (no content bleed)
 * D3: Select inputs have -webkit-appearance:none (no double-arrow)
 * D4: text-decoration:none on links/buttons (no underline)
 * D5: Labels are display:block (label stacks above input)
 */
import { test, expect } from './fixtures';
import { seedTestData, teardownSeedData } from './seed';
import type { SeedResult } from './seed';

// ── D2 regression: cards have overflow:hidden ─────────────────────────────────
test.describe('regression-029 D2 — card overflow:hidden', () => {
  let seed: SeedResult;

  test.beforeEach(async ({ page }) => {
    seed = await seedTestData(page);
    await page.goto(`catalog/${seed.catalogItemId}`);
    await page.waitForSelector('[data-testid="catalog-detail"]', { timeout: 20_000 });
  });

  test.afterEach(async ({ page }) => {
    await teardownSeedData(page, seed);
  });

  test('card-bevel elements still have overflow:hidden', async ({ page }) => {
    await page.waitForSelector('.card-bevel', { timeout: 10_000 });
    const overflows = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>('.card-bevel')).map(
        (el) => getComputedStyle(el).overflow,
      ),
    );
    expect(overflows.length).toBeGreaterThanOrEqual(1);
    for (const ov of overflows) {
      expect(ov, 'card-bevel must have overflow:hidden').toBe('hidden');
    }
  });
});

// ── D3 regression: select inputs have -webkit-appearance:none ────────────────
test.describe('regression-029 D3 — select -webkit-appearance:none', () => {
  let seed: SeedResult;

  test.beforeEach(async ({ page }) => {
    seed = await seedTestData(page);
    await page.goto(`catalog/${seed.catalogItemId}`);
    await page.waitForSelector('[data-testid="catalog-detail"]', { timeout: 20_000 });
  });

  test.afterEach(async ({ page }) => {
    await teardownSeedData(page, seed);
  });

  test('Edit button still has appearance:none (webkit-appearance suppressed)', async ({ page }) => {
    const editBtn = page.getByRole('button', { name: 'Edit' });
    await expect(editBtn).toBeVisible({ timeout: 10_000 });

    const { webkitAppearance, appearance } = await editBtn.evaluate((el: HTMLElement) => {
      const s = getComputedStyle(el);
      return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        webkitAppearance: (s as any).webkitAppearance as string | undefined,
        appearance: s.appearance,
      };
    });

    const isNone = webkitAppearance === 'none' || appearance === 'none';
    expect(
      isNone,
      `Expected webkitAppearance or appearance to be 'none', got webkitAppearance=${webkitAppearance} appearance=${appearance}`,
    ).toBe(true);
  });
});

// ── D4 regression: no underline on "+ Log Shot" button ───────────────────────
test.describe('regression-029 D4 — no underline on Log Shot button', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./');
    // Wait for the dashboard heading to be present rather than relying on the
    // brittle networkidle event — covers auth token refresh + React Query load.
    await expect(page.getByTestId('dashboard-heading')).toBeVisible({ timeout: 15_000 });
  });

  test('+ Log Shot button still has no text-decoration underline at rest', async ({ page }) => {
    const btn = page.getByRole('button', { name: 'Log a shot' });
    await expect(btn).toBeVisible({ timeout: 15_000 });
    const decoration = await btn.evaluate(
      (el: HTMLElement) => getComputedStyle(el).textDecorationLine,
    );
    expect(decoration, 'Expected no underline on + Log Shot button').not.toContain('underline');
  });
});

// ── D5 regression: labels are display:block ───────────────────────────────────
test.describe('regression-029 D5 — labels display:block above inputs', () => {
  let seed: SeedResult;

  test.beforeEach(async ({ page }) => {
    seed = await seedTestData(page);
    await page.goto('./brew-log/add');
    // Wait for the form root to appear — more reliable than networkidle because
    // the form renders after inventory + hardware queries resolve.
    await page.waitForSelector('[data-testid="brew-log-add-form"]', { timeout: 15_000 });
  });

  test.afterEach(async ({ page }) => {
    await teardownSeedData(page, seed);
  });

  test('.form-control > .label elements are still display:block', async ({ page }) => {
    const displayValues = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>('.form-control > .label')).map(
        (el) => getComputedStyle(el).display,
      ),
    );
    expect(displayValues.length).toBeGreaterThanOrEqual(1);
    for (const d of displayValues) {
      expect(d, 'Expected .form-control > .label to be display:block').toBe('block');
    }
  });

  test('Bag label bounding box is above Bag select', async ({ page }) => {
    const formControl = page
      .locator('.form-control')
      .filter({ has: page.locator('span.label-text', { hasText: /^Bag\s*\*?$/ }) })
      .first();

    const labelBox = await formControl.locator('label.label').boundingBox();
    const selectBox = await formControl.locator('select').boundingBox();

    expect(labelBox).not.toBeNull();
    expect(selectBox).not.toBeNull();
    expect(labelBox!.y + labelBox!.height).toBeLessThanOrEqual(selectBox!.y);
  });
});
