import { test, expect } from './fixtures';

const TOKENS: string[] = [
  '--glass-bg',
  '--glass-blur',
  '--glass-border',
  '--glass-highlight',
  '--bevel-shadow-raised',
  '--bevel-shadow-inset',
  '--bevel-radius',
  '--btn-rest-shadow',
  '--btn-hover-shadow',
  '--btn-active-shadow',
  '--btn-disabled-opacity',
  '--input-bg',
  '--input-border',
  '--input-focus-ring',
  '--input-label-gap',
];

test.describe('D2-tokens — CSS custom property existence', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./');
    await page.waitForLoadState('networkidle');
  });

  for (const token of TOKENS) {
    test(`${token} is defined and non-empty`, async ({ page }) => {
      const val = await page.evaluate((t: string) => {
        return getComputedStyle(document.documentElement)
          .getPropertyValue(t)
          .trim();
      }, token);
      expect(val, `Expected CSS custom property ${token} to be non-empty`).not.toBe('');
    });
  }
});
