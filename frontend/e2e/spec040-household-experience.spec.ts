/**
 * Spec-040 household journey E2E tests.
 *
 * These tests mock all API routes via page.route() but require the FastAPI
 * backend serving the SPA via its catch-all route. Running against Vite
 * preview (/static/spa/) will cause all tests to fail because React Router
 * has no basename and will not match any route.
 *
 * Start the backend:
 *   APP_ENV=local E2E_AUTH_BYPASS=1 USE_POSTGRES=true \
 *   DATABASE_URL=... SPREADSHEET_ID=dummy \
 *   SESSION_SECRET=... JWT_SECRET=... \
 *   uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
 *
 * Run:
 *   PW_BASE_URL=http://localhost:8000 npm run test:e2e -- e2e/spec040-*.spec.ts
 */
import { expect, test } from '@playwright/test'
import {
  SPEC040_GUEST_KEY,
  SPEC040_HOUSEHOLD_ID,
  SPEC040_INVITE_TOKEN,
  SPEC040_VIEWPORTS,
  expectNoHorizontalOverflow,
  expectNoSensitiveVisibleText,
  expectNoTokenPersistence,
  mockSpec040Authenticated,
  mockSpec040InviteAndGuestContracts,
  mockSpec040Unauthenticated,
} from './spec040-support'

test.use({ screenshot: 'off', trace: 'off', video: 'off', serviceWorkers: 'block' })

for (const viewport of SPEC040_VIEWPORTS) {
  test.describe(`Spec-040 household journeys at ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

    test('invite preview supports decline-then-accept without exposing token', async ({ page }) => {
      await mockSpec040Authenticated(page)
      await mockSpec040InviteAndGuestContracts(page)

      const declineRequests: string[] = []
      const acceptRequests: string[] = []
      page.on('request', (request) => {
        const url = request.url()
        if (url.includes('/decline')) declineRequests.push(url)
        if (url.includes('/accept')) acceptRequests.push(url)
      })

      await page.goto(`/invite/accept?token=${SPEC040_INVITE_TOKEN}`)
      await expect(page.getByText('Spec Household')).toBeVisible()
      await expect(page.getByRole('button', { name: /decline/i })).toBeVisible()
      await expectNoSensitiveVisibleText(page, [SPEC040_INVITE_TOKEN])

      await page.getByRole('button', { name: /decline/i }).click()
      expect(declineRequests.some((url) => url.includes('/households/invitations/'))).toBe(true)

      await page.goto(`/invite/accept?token=${SPEC040_INVITE_TOKEN}`)
      await page.getByRole('button', { name: /accept invitation|join/i }).click()
      expect(acceptRequests.some((url) => url.includes('/households/invitations/'))).toBe(true)
      await expectNoTokenPersistence(page)
    })

    test('settings creates link-only invite through canonical endpoint', async ({ page }) => {
      await mockSpec040Authenticated(page)
      await mockSpec040InviteAndGuestContracts(page)

      const invitationRequests: string[] = []
      page.on('request', (request) => {
        const url = request.url()
        if (url.endsWith('/households/invitations')) invitationRequests.push(url)
      })

      await page.goto('/household/settings')
      await page.getByRole('button', { name: /create invite|invite/i }).click()
      await expect(page.locator('.alert-success')).toBeVisible()

      expect(invitationRequests).toHaveLength(1)
      // Admin settings legitimately shows the copyable invite URL which contains
      // the token. Only check that the household UUID is not rendered as visible text.
      await expectNoSensitiveVisibleText(page, [SPEC040_HOUSEHOLD_ID])
      await expectNoTokenPersistence(page)
    })

    test('guest page is read-only and hides key and internal ids', async ({ page }) => {
      await mockSpec040Unauthenticated(page)
      await mockSpec040InviteAndGuestContracts(page)

      await page.goto(`/households/${SPEC040_HOUSEHOLD_ID}/view?key=${SPEC040_GUEST_KEY}`)

      await expect(page.getByText(/viewing spec household as a guest/i)).toBeVisible()
      await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible()
      await expect(page.getByRole('link', { name: /create an account/i })).toBeVisible()

      const writeAffordances = page.getByRole('button', {
        name: /add|edit|delete|import|settings|generate|revoke/i,
      })
      await expect(writeAffordances).toHaveCount(0)
      await expectNoSensitiveVisibleText(page, [SPEC040_GUEST_KEY, SPEC040_HOUSEHOLD_ID])
      await expectNoHorizontalOverflow(page)
    })
  })
}

