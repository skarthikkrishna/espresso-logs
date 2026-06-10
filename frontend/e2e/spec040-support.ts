import { expect, type Page, type Route } from '@playwright/test'

export const SPEC040_VIEWPORTS = [
  { name: 'mobile-375', width: 375, height: 812 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1280', width: 1280, height: 900 },
] as const

export const SPEC040_HOUSEHOLD_ID = '11111111-1111-4111-8111-111111111111'
export const SPEC040_USER_ID = '22222222-2222-4222-8222-222222222222'
export const SPEC040_INVITE_TOKEN = 'spec040-invite-token-redacted'
export const SPEC040_GUEST_KEY = 'spec040-guest-key-redacted'

const UUID_PATTERN = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/
const JWT_PATTERN = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/
const PRODUCTION_URL_PATTERN = /https:\/\/[^/\s"']+\.run\.app/
const COOKIE_PATTERN = /\b(rt|refresh_token|cookie)=/i

export async function fulfillJson(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
}

export async function mockSpec040Unauthenticated(page: Page): Promise<void> {
  await page.route('**/auth/refresh', (route) =>
    fulfillJson(route, { detail: 'Unauthenticated' }, 401),
  )
  await page.route('**/auth/me', (route) =>
    fulfillJson(route, { detail: 'Unauthenticated' }, 401),
  )
}

export async function mockSpec040Authenticated(page: Page): Promise<void> {
  const memberships = [
    {
      household_id: SPEC040_HOUSEHOLD_ID,
      household_name: 'Spec Household',
      role: 'admin',
      joined_at: '2026-06-09T00:00:00Z',
      member_count: 3,
      is_active: true,
      can_manage: true,
    },
    {
      household_id: '33333333-3333-4333-8333-333333333333',
      household_name: 'Roastery Lab With A Very Long Name',
      role: 'member',
      joined_at: '2026-06-10T00:00:00Z',
      member_count: 2,
      is_active: false,
      can_manage: false,
    },
  ]

  await page.route('**/auth/refresh', (route) =>
    fulfillJson(route, { access_token: 'spec040-access-token-redacted', token_type: 'bearer' }),
  )
  await page.route('**/auth/me', (route) =>
    fulfillJson(route, {
      id: SPEC040_USER_ID,
      username: 'spec040_user',
      display_name: 'Spec User',
      email: null,
      picture_url: null,
      created_at: '2026-06-08T00:00:00Z',
      household_id: SPEC040_HOUSEHOLD_ID,
      active_household_id: SPEC040_HOUSEHOLD_ID,
      role: 'admin',
      memberships,
    }),
  )
  await page.route('**/households/me', (route) => fulfillJson(route, memberships))
  await page.route('**/auth/switch-household', (route) =>
    fulfillJson(route, {
      household_id: '33333333-3333-4333-8333-333333333333',
      household_name: 'Roastery Lab With A Very Long Name',
      role: 'member',
    }),
  )
  await page.route('**/api/hardware', (route) => fulfillJson(route, []))
  await page.route(`**/households/${SPEC040_HOUSEHOLD_ID}`, (route) =>
    fulfillJson(route, {
      id: SPEC040_HOUSEHOLD_ID,
      name: 'Spec Household',
      created_at: '2026-06-09T00:00:00Z',
      role: 'admin',
      member_count: 3,
      members: [
        {
          user_id: SPEC040_USER_ID,
          username: 'spec040_user',
          display_name: 'Spec User',
          email: null,
          picture_url: null,
          role: 'admin',
          joined_at: '2026-06-09T00:00:00Z',
          is_self: true,
        },
      ],
      member_limit: { current: 3, max: 10, can_invite: true },
      pending_invitations: [],
      guest_access: null,
      permissions: {
        can_rename: true,
        can_delete: true,
        can_manage_members: true,
        can_manage_invites: true,
        can_manage_guest_access: true,
      },
    }),
  )
}

export async function mockSpec040AuthenticatedNoHouseholds(page: Page): Promise<void> {
  await page.route('**/auth/refresh', (route) =>
    fulfillJson(route, { access_token: 'spec040-access-token-redacted', token_type: 'bearer' }),
  )
  await page.route('**/auth/me', (route) =>
    fulfillJson(route, {
      id: SPEC040_USER_ID,
      username: 'spec040_user',
      display_name: 'Spec User',
      email: null,
      picture_url: null,
      created_at: '2026-06-08T00:00:00Z',
      household_id: null,
      active_household_id: null,
      role: null,
      memberships: [],
    }),
  )
  await page.route('**/households/me', (route) => fulfillJson(route, []))
  await page.route('**/api/hardware', (route) => fulfillJson(route, []))
}

export async function mockSpec040InviteAndGuestContracts(page: Page): Promise<void> {
  await page.route(`**/households/invitations/${SPEC040_INVITE_TOKEN}`, (route) =>
    fulfillJson(route, {
      household_name: 'Spec Household',
      inviter_display_name: 'Spec Admin',
      invited_role: 'member',
      expires_at: '2026-06-12T00:00:00Z',
      status: 'pending',
    }),
  )
  await page.route(`**/households/invitations/${SPEC040_INVITE_TOKEN}/decline`, (route) =>
    fulfillJson(route, { status: 'dismissed' }),
  )
  await page.route(`**/households/invitations/${SPEC040_INVITE_TOKEN}/accept`, (route) =>
    fulfillJson(route, {
      household_id: SPEC040_HOUSEHOLD_ID,
      household_name: 'Spec Household',
      role: 'member',
      active_household_id: SPEC040_HOUSEHOLD_ID,
    }),
  )
  await page.route('**/households/invitations', (route) =>
    fulfillJson(route, {
      invitation_id: '44444444-4444-4444-8444-444444444444',
      invite_url: `http://localhost:8000/invite/accept?token=${SPEC040_INVITE_TOKEN}`,
      expires_at: '2026-06-12T00:00:00Z',
      invited_email: null,
      invited_role: 'member',
      status: 'pending',
      delivery: {
        email_configured: false,
        email_attempted: false,
        email_sent: false,
      },
    }, 201),
  )
  await page.route(`**/api/guest/households/${SPEC040_HOUSEHOLD_ID}/view?**`, (route) =>
    fulfillJson(route, {
      household: { name: 'Spec Household' },
      banner: "You're viewing Spec Household as a guest. Sign in or create an account to log shots.",
      dashboard: { active_bags: [], recent_shots: [], stats: {} },
      brew_log: { entries: [], pagination: { page: 1, per_page: 25, total: 0 } },
      catalog: { beans: [], compass_summary: {} },
      capabilities: { can_write: false },
    }),
  )
}

export async function expectNoSensitiveVisibleText(
  page: Page,
  forbiddenLiterals: string[] = [],
): Promise<void> {
  const bodyText = await page.locator('body').innerText()
  for (const literal of forbiddenLiterals) {
    expect(bodyText, `visible text must not contain ${literal}`).not.toContain(literal)
  }
  expect(bodyText, 'visible text must not contain UUIDs').not.toMatch(UUID_PATTERN)
  expect(bodyText, 'visible text must not contain JWT-like values').not.toMatch(JWT_PATTERN)
  expect(bodyText, 'visible text must not contain Cloud Run production URLs').not.toMatch(
    PRODUCTION_URL_PATTERN,
  )
  expect(bodyText, 'visible text must not contain cookie or refresh-token values').not.toMatch(
    COOKIE_PATTERN,
  )
}

export async function expectNoTokenPersistence(page: Page): Promise<void> {
  const storageValues = await page.evaluate(() => [
    ...Object.entries(window.localStorage).map(([key, value]) => `${key}=${value}`),
    ...Object.entries(window.sessionStorage).map(([key, value]) => `${key}=${value}`),
  ])
  const joined = storageValues.join('\n')

  expect(joined).not.toContain(SPEC040_INVITE_TOKEN)
  expect(joined).not.toContain(SPEC040_GUEST_KEY)
  expect(joined).not.toMatch(JWT_PATTERN)
}

export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }))

  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1)
}

