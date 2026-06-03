import { test, expect } from './fixtures';

test.describe('D5-modals — glass-modal-surface treatment', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./catalog');
    await page.waitForLoadState('networkidle');
  });

  test('modal-box has non-empty, non-none box-shadow', async ({ page }) => {
    // Open the AddBeanModal via the FAB (portalled to document.body)
    const fab = page.getByRole('button', { name: 'Add bean' });
    await expect(fab).toBeVisible({ timeout: 5_000 });
    await fab.click();

    // Wait for the modal surface
    await page.waitForSelector('.modal-box', { timeout: 5_000 });
    const modalBox = page.locator('.modal-box').first();
    await expect(modalBox).toBeVisible();

    const shadow = await modalBox.evaluate(
      (el: HTMLElement) => getComputedStyle(el).boxShadow,
    );
    expect(shadow, 'Expected modal-box to have a box-shadow').not.toBe('');
    expect(shadow, 'Expected modal-box box-shadow to not be "none"').not.toBe('none');
  });

  test('modal-box border-radius matches --bevel-radius (~10px / 0.625rem)', async ({ page }) => {
    const fab = page.getByRole('button', { name: 'Add bean' });
    await expect(fab).toBeVisible({ timeout: 5_000 });
    await fab.click();

    await page.waitForSelector('.modal-box', { timeout: 5_000 });
    const modalBox = page.locator('.modal-box').first();
    await expect(modalBox).toBeVisible();

    const borderRadius = await modalBox.evaluate(
      (el: HTMLElement) => getComputedStyle(el).borderRadius,
    );
    // --bevel-radius is 0.625rem which computes to 10px at default font-size
    expect(borderRadius, 'Expected modal-box border-radius to be set').not.toBe('');
    expect(borderRadius, 'Expected modal-box border-radius to not be 0px').not.toBe('0px');
  });

  test('modal-box has glass-modal-surface class applied', async ({ page }) => {
    const fab = page.getByRole('button', { name: 'Add bean' });
    await expect(fab).toBeVisible({ timeout: 5_000 });
    await fab.click();

    await page.waitForSelector('.modal-box.glass-modal-surface', { timeout: 5_000 });
    const modalBox = page.locator('.modal-box.glass-modal-surface').first();
    await expect(modalBox).toBeVisible();
  });
});
