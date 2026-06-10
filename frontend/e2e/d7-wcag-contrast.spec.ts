/**
 * T017 — WCAG AA Contrast Verification: --color-primary token
 *
 * Asserts that --color-primary resolves to rgb(180, 83, 9) (#b45309, amber-700)
 * which achieves ~4.54:1 contrast against white — passing WCAG 2.1 Level AA (≥4.5:1).
 *
 * This spec uses a probe element (matching the pattern in spec039-visual-contracts)
 * to evaluate the computed token value in a real browser. This catches regression back
 * to the old #d97706 (amber-600, ~3.16:1 contrast, AA FAIL) value.
 *
 * Must run AFTER T001 is applied (--color-primary amended in index.css).
 * Does NOT need authentication — the login page is sufficient since it renders a primary button.
 *
 * Contrast calculation (informational):
 *   #b45309 = R:180 G:83 B:9  →  L ≈ 0.1815
 *   Contrast vs white: (1.05) / (0.2315) ≈ 4.54:1 → WCAG AA PASS ✓
 *   Old #d97706 (amber-600): contrast ≈ 3.16:1 → WCAG AA FAIL ✗
 */

import { expect, test, type Page, type Route } from '@playwright/test'

test.use({ screenshot: 'off', serviceWorkers: 'block', trace: 'off', video: 'off' })

async function fulfillJson(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
}

async function mockUnauthenticated(page: Page): Promise<void> {
  await page.route('**/auth/refresh', (route) =>
    fulfillJson(route, { detail: 'Unauthenticated' }, 401),
  )
}

test.describe('T017 — WCAG AA: --color-primary token contrast', () => {
  test('--color-primary resolves to rgb(180, 83, 9) — WCAG AA pass (~4.54:1 vs white)', async ({
    page,
  }) => {
    await mockUnauthenticated(page)
    await page.goto('/login')
    await expect(page.locator('button.btn-primary').first()).toBeVisible({ timeout: 10_000 })

    // Use a probe element (same pattern as spec039 computedToken helper) to evaluate
    // the CSS custom property value in the browser's real style engine.
    const primaryColor = await page.evaluate(() => {
      const probe = document.createElement('div')
      probe.style.setProperty('background-color', 'var(--color-primary)')
      document.body.append(probe)
      const value = getComputedStyle(probe).backgroundColor
      probe.remove()
      return value
    })

    // Positive assertion: must be #b45309 (amber-700) — WCAG AA PASS
    expect(primaryColor, '--color-primary must be rgb(180, 83, 9) (#b45309) for WCAG AA').toBe(
      'rgb(180, 83, 9)',
    )
  })

  test('btn-primary button computed background-color is rgb(180, 83, 9)', async ({ page }) => {
    await mockUnauthenticated(page)
    await page.goto('/login')

    const btn = page.locator('button.btn-primary').first()
    await expect(btn).toBeVisible({ timeout: 10_000 })
    await page.mouse.move(0, 0) // ensure no hover state

    const bgColor = await btn.evaluate((el) => getComputedStyle(el).backgroundColor)

    expect(bgColor, 'btn-primary background must use amber-700 (#b45309) for WCAG AA').toBe(
      'rgb(180, 83, 9)',
    )
  })
})
