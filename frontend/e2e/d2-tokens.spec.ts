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
  // Single navigation shared across all token checks to avoid exhausting
  // /auth/refresh rate limits from 15 separate beforeEach page.goto() calls.
  test('all design tokens are defined and non-empty', async ({ page }) => {
    await page.goto('./');
    await page.waitForLoadState('networkidle');

    const values: Record<string, string> = await page.evaluate((tokens: string[]) => {
      const style = getComputedStyle(document.documentElement);
      return Object.fromEntries(
        tokens.map((t) => [t, style.getPropertyValue(t).trim()]),
      );
    }, TOKENS);

    // Use expect.soft() so every failing token is reported, not just the first.
    for (const token of TOKENS) {
      expect
        .soft(values[token], `Expected CSS custom property ${token} to be non-empty`)
        .not.toBe('');
    }
  });
});
