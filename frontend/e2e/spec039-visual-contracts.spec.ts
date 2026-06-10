import { expect, test, type Page, type Route } from '@playwright/test'

// T019 CONFIRMATION (Quinn, spec-041):
// The `expectTokenizedButton` helper in this file asserts on boxShadow, borderRadius,
// and -webkit-tap-highlight-color ONLY — it does NOT assert on backgroundColor.
// Therefore the spec-041 T001 change (--color-primary: #d97706 → #b45309) requires
// NO updates to any assertion in this file. Confirmed: grep for "backgroundColor" returns
// only the glass-card and input assertions (lines ~126, ~144, ~202, ~211), never btn-primary.
// This file requires no spec-041 edits beyond the already-present heading text rename
// ('Welcome to Coffee Tracker' → 'Welcome to Kaapi Kadai'). — DO NOT REMOVE ANY ASSERTION.

test.use({ screenshot: 'off', serviceWorkers: 'block', trace: 'off', video: 'off' })

type MembershipRole = 'admin' | 'member'

type MockMembership = {
  household_id: string
  household_name: string
  role: MembershipRole
  joined_at: string
}

const ADMIN_MEMBERSHIPS: MockMembership[] = [
  {
    household_id: 'hh-spec039',
    household_name: 'Spec Household',
    role: 'admin',
    joined_at: '2026-01-02T00:00:00Z',
  },
  {
    household_id: 'hh-roastery',
    household_name: 'Roastery Lab',
    role: 'member',
    joined_at: '2026-01-03T00:00:00Z',
  },
]

const ZERO_MEMBERSHIPS: MockMembership[] = []

async function fulfillJson(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
}

async function mockUnauthenticated(page: Page): Promise<void> {
  await page.route('**/auth/refresh', (route) => fulfillJson(route, { detail: 'Unauthenticated' }, 401))
}

async function mockAuthenticated(page: Page, memberships: MockMembership[]): Promise<void> {
  const activeHouseholdId = memberships[0]?.household_id ?? null

  await page.route('**/auth/refresh', (route) =>
    fulfillJson(route, { access_token: 'spec039-access-token', token_type: 'bearer' }),
  )
  await page.route('**/auth/me', (route) =>
    fulfillJson(route, {
      id: 'user-spec039',
      username: 'spec039user',
      display_name: 'Spec User',
      email: null,
      picture_url: null,
      created_at: '2026-01-01T00:00:00Z',
      household_id: activeHouseholdId,
      role: memberships[0]?.role ?? null,
      active_household_id: activeHouseholdId,
      memberships,
    }),
  )
  await page.route('**/api/hardware', (route) => fulfillJson(route, []))
  await page.route('**/auth/switch-household', (route) =>
    fulfillJson(route, {
      household_id: 'hh-roastery',
      household_name: 'Roastery Lab',
      role: 'member',
    }),
  )
  await page.route(/\/households\/invite-info(?:\?.*)?$/, (route) =>
    fulfillJson(route, {
      household_name: 'Spec Household',
      inviter_display_name: 'Spec Admin',
      role: 'member',
    }),
  )
  await page.route(/\/households\/hh-spec039$/, (route) =>
    fulfillJson(route, {
      id: 'hh-spec039',
      name: 'Spec Household',
      created_at: '2026-01-02T00:00:00Z',
      is_guest_accessible: true,
      members: [
        {
          user_id: 'user-spec039',
          username: 'spec039user',
          display_name: 'Spec User',
          role: 'admin',
          joined_at: '2026-01-02T00:00:00Z',
        },
        {
          user_id: 'user-member',
          username: 'member',
          display_name: 'Member User',
          role: 'member',
          joined_at: '2026-01-03T00:00:00Z',
        },
      ],
      pending_invitations: [
        {
          invite_id: 'invite-spec039',
          invited_email: null,
          role: 'member',
          expires_at: '2026-01-10T00:00:00Z',
          status: 'pending',
        },
      ],
    }),
  )
}

async function tokenizedCardStyles(page: Page, selector: string): Promise<Record<string, string>> {
  return page.locator(selector).first().evaluate((element) => {
    function computedToken(token: string, property: string): string {
      const probe = document.createElement('div')
      probe.style.setProperty(property, `var(${token})`)
      document.body.append(probe)
      const value = getComputedStyle(probe).getPropertyValue(property).trim()
      probe.remove()
      return value
    }

    const style = getComputedStyle(element)
    return {
      backgroundColor: style.backgroundColor,
      borderColor: style.borderTopColor,
      borderRadius: style.borderRadius,
      boxShadow: style.boxShadow,
      glassBackground: computedToken('--glass-bg', 'background-color'),
      glassBorder: computedToken('--glass-border', 'border-color'),
      bevelRadius: computedToken('--bevel-radius', 'border-radius'),
      bevelShadow: computedToken('--bevel-shadow-raised', 'box-shadow'),
    }
  })
}

async function expectTokenizedCard(page: Page, selector = '.glass-card.card-bevel'): Promise<void> {
  await page.mouse.move(0, 0)
  const card = page.locator(selector).first()
  await expect(card).toBeVisible()
  const styles = await tokenizedCardStyles(page, selector)

  expect(styles.backgroundColor, `${selector} must use --glass-bg`).toBe(styles.glassBackground)
  expect(styles.borderColor, `${selector} must use --glass-border`).toBe(styles.glassBorder)
  expect(styles.borderRadius, `${selector} must use --bevel-radius`).toBe(styles.bevelRadius)
  expect(styles.boxShadow, `${selector} must use --bevel-shadow-raised`).toBe(styles.bevelShadow)
}

async function tabToFocusVisible(page: Page, selector: string): Promise<void> {
  const target = page.locator(selector).first()
  await expect(target).toBeVisible()

  for (const tabKey of ['Tab', 'Shift+Tab']) {
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
    })

    for (let tabCount = 0; tabCount < 80; tabCount += 1) {
      await page.keyboard.press(tabKey)
      const isActiveElement = await target.evaluate((element) => element === document.activeElement)

      if (isActiveElement) {
        const isFocusVisible = await target.evaluate((element) => element.matches(':focus-visible'))
        expect(isFocusVisible, `${selector} must match :focus-visible after keyboard ${tabKey}`).toBe(
          true,
        )
        return
      }
    }
  }

  throw new Error(`${selector} was not reachable by keyboard Tab or Shift+Tab`)
}

async function expectTokenizedInput(page: Page, selector: string): Promise<void> {
  const input = page.locator(selector).first()
  await expect(input).toBeVisible()
  const styles = await input.evaluate((element) => {
    function computedToken(token: string, property: string): string {
      const probe = document.createElement('div')
      probe.style.setProperty(property, `var(${token})`)
      document.body.append(probe)
      const value = getComputedStyle(probe).getPropertyValue(property).trim()
      probe.remove()
      return value
    }

    function computedBorderToken(token: string): string {
      const probe = document.createElement('div')
      probe.style.setProperty('border', `var(${token})`)
      document.body.append(probe)
      const value = getComputedStyle(probe).borderTopColor
      probe.remove()
      return value
    }

    const style = getComputedStyle(element)
    return {
      backgroundColor: style.backgroundColor,
      borderColor: style.borderTopColor,
      borderRadius: style.borderRadius,
      inputBackground: computedToken('--input-bg', 'background-color'),
      inputBorderColor: computedBorderToken('--input-border'),
      bevelRadius: computedToken('--bevel-radius', 'border-radius'),
    }
  })

  expect(styles.backgroundColor, `${selector} must use --input-bg`).toBe(styles.inputBackground)
  expect(styles.borderColor, `${selector} must use --input-border`).toBe(styles.inputBorderColor)
  expect(styles.borderRadius, `${selector} must use --bevel-radius`).toBe(styles.bevelRadius)

  await tabToFocusVisible(page, selector)
  const focus = await input.evaluate((element) => {
    function computedToken(token: string, property: string): string {
      const probe = document.createElement('div')
      probe.style.setProperty(property, `var(${token})`)
      document.body.append(probe)
      const value = getComputedStyle(probe).getPropertyValue(property).trim()
      probe.remove()
      return value
    }

    return {
      boxShadow: getComputedStyle(element).boxShadow,
      focusRing: computedToken('--input-focus-ring', 'box-shadow'),
      isFocusVisible: element.matches(':focus-visible'),
    }
  })
  expect(focus.isFocusVisible, `${selector} must match :focus-visible before focus-ring check`).toBe(true)
  expect(focus.boxShadow, `${selector} focus must use --input-focus-ring`).toBe(focus.focusRing)
}

async function expectSelectAppearanceReset(page: Page, selector: string): Promise<void> {
  const select = page.locator(selector).first()
  await expect(select).toBeVisible()
  const appearance = await select.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      appearance: style.getPropertyValue('appearance'),
      webkitAppearance: style.getPropertyValue('-webkit-appearance'),
    }
  })
  expect(appearance.appearance, `${selector} must reset appearance`).toBe('none')
  expect(appearance.webkitAppearance, `${selector} must reset -webkit-appearance`).toBe('none')
}

async function expectTokenizedButton(page: Page, selector: string): Promise<void> {
  const button = page.locator(selector).first()
  await expect(button).toBeVisible()
  await page.mouse.move(0, 0)

  const rest = await button.evaluate((element) => {
    function computedToken(token: string, property: string): string {
      const probe = document.createElement('div')
      probe.style.setProperty(property, `var(${token})`)
      document.body.append(probe)
      const value = getComputedStyle(probe).getPropertyValue(property).trim()
      probe.remove()
      return value
    }

    const style = getComputedStyle(element)
    return {
      boxShadow: style.boxShadow,
      borderRadius: style.borderRadius,
      tapHighlight: style.getPropertyValue('-webkit-tap-highlight-color'),
      restShadow: computedToken('--btn-rest-shadow', 'box-shadow'),
      bevelRadius: computedToken('--bevel-radius', 'border-radius'),
    }
  })

  await expect
    .poll(
      () => button.evaluate((element) => getComputedStyle(element).boxShadow),
      { message: `${selector} must use --btn-rest-shadow` },
    )
    .toBe(rest.restShadow)
  expect(rest.borderRadius, `${selector} must use --bevel-radius`).toBe(rest.bevelRadius)
  expect(
    ['transparent', 'rgba(0, 0, 0, 0)'],
    `${selector} must suppress WebKit tap highlight`,
  ).toContain(rest.tapHighlight)

  await tabToFocusVisible(page, selector)
  const focused = await button.evaluate((element) => {
    function computedToken(token: string, property: string): string {
      const probe = document.createElement('div')
      probe.style.setProperty(property, `var(${token})`)
      document.body.append(probe)
      const value = getComputedStyle(probe).getPropertyValue(property).trim()
      probe.remove()
      return value
    }

    return {
      boxShadow: getComputedStyle(element).boxShadow,
      focusRing: computedToken('--input-focus-ring', 'box-shadow'),
      isFocusVisible: element.matches(':focus-visible'),
    }
  })
  expect(
    focused.isFocusVisible,
    `${selector} must match :focus-visible before focus-ring check`,
  ).toBe(true)
  expect(focused.boxShadow, `${selector} focus must include --input-focus-ring`).toContain(
    focused.focusRing,
  )

  const disabled = await button.evaluate((element) => {
    if (!(element instanceof HTMLButtonElement)) return null

    function computedToken(token: string, property: string): string {
      const probe = document.createElement('div')
      probe.style.setProperty(property, `var(${token})`)
      document.body.append(probe)
      const value = getComputedStyle(probe).getPropertyValue(property).trim()
      probe.remove()
      return value
    }

    const control = element
    const wasDisabled = control.disabled
    control.disabled = true
    const style = getComputedStyle(control)
    const result = {
      boxShadow: style.boxShadow,
      cursor: style.cursor,
      disabledOpacity: computedToken('--btn-disabled-opacity', 'opacity'),
      opacity: style.opacity,
    }
    control.disabled = wasDisabled
    return result
  })

  if (disabled === null) return

  expect(disabled.boxShadow, `${selector} disabled state must be flat`).toBe('none')
  expect(disabled.cursor, `${selector} disabled cursor must be not-allowed`).toBe('not-allowed')
  expect(disabled.opacity, `${selector} disabled opacity must use --btn-disabled-opacity`).toBe(
    disabled.disabledOpacity,
  )
}

test.describe('spec-039 visual contracts — auth and household surfaces', () => {
  test('Login uses tokenized auth card, inputs, and primary/secondary buttons', async ({ page }) => {
    await mockUnauthenticated(page)
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()

    await expectTokenizedCard(page)
    await expectTokenizedInput(page, '#login-username')
    await expectTokenizedInput(page, '#login-password')
    await expectTokenizedButton(page, 'button[type="submit"].btn-bevel')
    await expectTokenizedButton(page, 'a[aria-label="Sign in with Google"].btn-bevel')
  })

  test('Register uses tokenized auth card, inputs, and submit button', async ({ page }) => {
    await mockUnauthenticated(page)
    await page.goto('/register')
    await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible()

    await expectTokenizedCard(page)
    await expectTokenizedInput(page, '#reg-username')
    await expectTokenizedInput(page, '#reg-display-name')
    await expectTokenizedInput(page, '#reg-password')
    await expectTokenizedInput(page, '#reg-confirm-password')
    await expectTokenizedButton(page, 'button[type="submit"].btn-bevel')
  })

  test('Invite static error surfaces use tokenized cards and CTAs', async ({ page }) => {
    await mockUnauthenticated(page)

    await page.goto('/invite/expired')
    await expect(page.getByRole('heading', { name: 'Invitation expired' })).toBeVisible()
    await expectTokenizedCard(page)
    await expectTokenizedButton(page, 'a.btn-bevel')

    await page.goto('/invite/invalid')
    await expect(page.getByRole('heading', { name: 'Invalid invitation' })).toBeVisible()
    await expectTokenizedCard(page)
    await expectTokenizedButton(page, 'a.btn-bevel')
  })

  test('Welcome and HouseholdNew onboarding surfaces use shared token contracts', async ({ page }) => {
    await mockAuthenticated(page, ZERO_MEMBERSHIPS)

    await page.goto('/welcome')
    await expect(page.getByRole('heading', { name: 'Welcome to Kaapi Kadai' })).toBeVisible()
    await expectTokenizedCard(page)
    await expectTokenizedButton(page, 'button.btn-primary.btn-bevel')
    await expectTokenizedButton(page, 'button.btn-outline.btn-bevel')

    await page.getByRole('button', { name: 'Create my household' }).click()
    await expect(page.getByRole('heading', { name: 'Create your household' })).toBeVisible()
    await expectTokenizedInput(page, '#welcome-household-name')
    await expectTokenizedButton(page, 'button[type="submit"].btn-bevel')

    await page.goto('/household/new')
    await expect(page.getByRole('heading', { name: 'Create a household' })).toBeVisible()
    await expectTokenizedCard(page)
    await expectTokenizedInput(page, '#household-name')
    await expectTokenizedButton(page, 'button[type="submit"].btn-bevel')
  })

  test('Invite accept uses tokenized confirmation surface without exposing real tokens', async ({ page }) => {
    await mockAuthenticated(page, ADMIN_MEMBERSHIPS)
    await page.goto('/invite/accept?token=SPEC039_DUMMY_INVITE')
    await expect(page.getByRole('heading', { name: 'Household Invitation' })).toBeVisible()

    await expectTokenizedCard(page)
    await expectTokenizedButton(page, 'button.btn-primary.btn-bevel')
  })

  test('Household settings and invite management use tokenized forms, rows, and actions', async ({
    page,
  }) => {
    await mockAuthenticated(page, ADMIN_MEMBERSHIPS)
    await page.goto('/household/settings')
    await expect(page.getByRole('heading', { name: 'Household settings' })).toBeVisible()

    await expectTokenizedCard(page, 'section.glass-card.card-bevel')
    await expectTokenizedInput(page, 'input.input-styled')
    await expectTokenizedInput(page, '#invite-email')
    await expectSelectAppearanceReset(page, '#invite-role')
    await expectTokenizedButton(page, 'button.btn-primary.btn-bevel')
    await expectTokenizedButton(page, 'button.btn-outline.btn-bevel')
    await expectTokenizedCard(page, 'li.glass-card.card-bevel')

    const destructiveShadow = await page
      .getByRole('button', { name: 'Delete household' })
      .evaluate((element) => getComputedStyle(element).boxShadow)
    expect(destructiveShadow, 'Destructive action remains flat/no bevel').toBe('none')
  })

  test('Profile and household switcher use tokenized read-only inputs, rows, and switch action', async ({
    page,
  }) => {
    await mockAuthenticated(page, ADMIN_MEMBERSHIPS)
    await page.goto('/profile')
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible()

    await expectTokenizedCard(page, 'section.glass-card.card-bevel')
    await expectTokenizedInput(page, 'input.input-styled')
    await expectTokenizedCard(page, 'li.glass-card.card-bevel')
    await expectTokenizedButton(page, 'button.btn-outline.btn-bevel')
  })

  test('Guest read-only view uses tokenized guest cards and auth CTAs', async ({ page }) => {
    await mockUnauthenticated(page)
    await page.goto('/households/hh-spec039/view')
    await expect(page.getByRole('heading', { name: 'Guest household view' })).toBeVisible()

    await expectTokenizedCard(page, 'article.glass-card.card-bevel')
    await expectTokenizedButton(page, 'a.btn-primary.btn-bevel')
    await expectTokenizedButton(page, 'a.btn-outline.btn-bevel')
  })
})
