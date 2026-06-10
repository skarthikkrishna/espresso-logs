/**
 * Spec-040 visual, a11y, and privacy contract E2E tests.
 *
 * Must run against the FastAPI SPA catch-all, not Vite preview.
 * See spec040-household-experience.spec.ts header for startup instructions.
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
  mockSpec040AuthenticatedNoHouseholds,
  mockSpec040InviteAndGuestContracts,
  mockSpec040Unauthenticated,
} from './spec040-support'

test.use({ screenshot: 'off', trace: 'off', video: 'off', serviceWorkers: 'block' })

const ROUTES = [
  {
    label: 'login invite-preserved',
    path: `/login?invite=${SPEC040_INVITE_TOKEN}`,
    expectedBackground: 'bg-auth-login',
    auth: 'public',
    forbidden: [SPEC040_INVITE_TOKEN],
  },
  {
    label: 'register invite-preserved',
    path: `/register?invite=${SPEC040_INVITE_TOKEN}`,
    expectedBackground: 'bg-auth-register',
    auth: 'public',
    forbidden: [SPEC040_INVITE_TOKEN],
  },
  {
    label: 'welcome onboarding',
    path: '/welcome',
    expectedBackground: 'bg-household-onboarding',
    auth: 'zero-member',
    forbidden: [],
  },
  {
    label: 'invite accept',
    path: `/invite/accept?token=${SPEC040_INVITE_TOKEN}`,
    expectedBackground: 'bg-invite-accept',
    auth: 'member',
    forbidden: [SPEC040_INVITE_TOKEN],
  },
  {
    label: 'invite invalid',
    path: '/invite/invalid',
    expectedBackground: 'bg-invite-recovery',
    auth: 'public',
    forbidden: [],
  },
  {
    label: 'guest read-only',
    path: `/households/${SPEC040_HOUSEHOLD_ID}/view?key=${SPEC040_GUEST_KEY}`,
    expectedBackground: 'bg-guest',
    auth: 'public',
    forbidden: [SPEC040_GUEST_KEY, SPEC040_HOUSEHOLD_ID],
  },
  {
    label: 'profile',
    path: '/profile',
    expectedBackground: 'bg-profile-household',
    auth: 'member',
    forbidden: [SPEC040_HOUSEHOLD_ID],
  },
  {
    label: 'household settings',
    path: '/household/settings',
    expectedBackground: 'bg-household-settings',
    auth: 'member',
    forbidden: [SPEC040_HOUSEHOLD_ID],
  },
] as const

for (const viewport of SPEC040_VIEWPORTS) {
  test.describe(`Spec-040 visual/a11y/privacy contract at ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

    for (const routeCase of ROUTES) {
      test(`${routeCase.label} uses approved background and hides sensitive text`, async ({
        page,
      }, testInfo) => {
        expect(['chromium', 'webkit']).toContain(testInfo.project.name)

        if (routeCase.auth === 'member') {
          await mockSpec040Authenticated(page)
        } else if (routeCase.auth === 'zero-member') {
          await mockSpec040AuthenticatedNoHouseholds(page)
        } else {
          await mockSpec040Unauthenticated(page)
        }
        await mockSpec040InviteAndGuestContracts(page)

        await page.goto(routeCase.path)

        const appBackground = page.locator('.app-bg').first()
        await expect(appBackground).toBeVisible()
        await expect(appBackground).toHaveClass(
          new RegExp(`\\b${routeCase.expectedBackground}\\b`),
        )
        await expectNoHorizontalOverflow(page)
        await expectNoSensitiveVisibleText(page, routeCase.forbidden)
        await expectNoTokenPersistence(page)
      })
    }

    test('modal and shell blur remain limited to approved layers', async ({ page }) => {
      await mockSpec040Authenticated(page)
      await mockSpec040InviteAndGuestContracts(page)
      await page.goto('/household/settings')

      const disallowedBlurCount = await page.evaluate(() => {
        const disallowedSelectors = [
          '.glass-card',
          '.card-bevel',
          '.btn',
          '.menu',
          'li',
          '.modal-box',
        ]
        return disallowedSelectors.reduce((count, selector) => {
          return count + Array.from(document.querySelectorAll(selector)).filter((element) => {
            const style = getComputedStyle(element)
            const blur = style.backdropFilter || style.getPropertyValue('-webkit-backdrop-filter')
            return Boolean(blur && blur !== 'none')
          }).length
        }, 0)
      })

      expect(disallowedBlurCount).toBe(0)
    })
  })
}

