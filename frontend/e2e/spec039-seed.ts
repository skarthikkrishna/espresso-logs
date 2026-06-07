import type { Page } from '@playwright/test'

export const SPEC039_IDS = {
  catalogs: {
    locked: 'CAT039_LOCKED',
    emptyRoast: 'CAT039_EMPTY_ROAST',
  },
  bags: {
    active: 'BAG039_ACTIVE',
    finished: 'BAG039_FINISHED',
  },
  shots: {
    typo: 'SHOT039_TYPO',
    aiPresent: 'SHOT039_AI_PRESENT',
    aiEmpty: 'SHOT039_AI_EMPTY',
  },
  hardware: {
    machine: 'HW039_MACHINE',
    grinder: 'HW039_GRINDER',
    basket: 'HW039_BASKET',
    storage: 'HW039_STORAGE',
  },
} as const

export interface Spec039SeedResult {
  household_id: string
  catalog_ids: Record<string, string>
  bag_ids: Record<string, string>
  shot_ids: Record<string, string>
  hardware_ids: Record<string, string>
  has_ai_feedback: Record<string, boolean>
}

export interface Spec039Session {
  accessToken: string
}

const BASE = process.env.PW_BASE_URL
  ? new URL(process.env.PW_BASE_URL).origin
  : 'http://localhost:8000'

function parseRtCookie(setCookieHeader: string | null): string | null {
  if (!setCookieHeader) return null
  const match = setCookieHeader.match(/(?:^|,\s*)rt="?([^";,]+)"?/)
  return match ? match[1] : null
}

async function failWithSafeBody(prefix: string, status: number, body: string): Promise<never> {
  throw new Error(
    `${prefix} failed with ${status}. ` +
      `Expected APP_ENV=local|test, E2E_AUTH_BYPASS=1, USE_POSTGRES=true, and local DATABASE_URL. ` +
      `Response shape: ${body ? 'non-empty' : 'empty'}`,
  )
}

export async function startSpec039Session(page: Page): Promise<Spec039Session> {
  const res = await page.request.post(`${BASE}/api/e2e/session`)
  if (!res.ok()) {
    await failWithSafeBody('POST /api/e2e/session', res.status(), await res.text())
  }

  const rtValue = parseRtCookie(res.headers()['set-cookie'] ?? null)
  if (!rtValue) {
    throw new Error(
      'POST /api/e2e/session did not return an rt cookie. Response header shape: non-secret metadata only.',
    )
  }

  const baseUrl = new URL(BASE)
  await page.context().clearCookies({ name: 'rt' })
  await page.context().addCookies([
    {
      name: 'rt',
      value: rtValue,
      domain: baseUrl.hostname,
      path: '/auth',
      httpOnly: true,
      sameSite: 'Lax',
      secure: baseUrl.protocol === 'https:',
    },
  ])

  const body = (await res.json()) as { access_token?: unknown }
  if (typeof body.access_token !== 'string' || body.access_token.length === 0) {
    throw new Error('POST /api/e2e/session response did not include an access token')
  }

  return { accessToken: body.access_token }
}

export async function spec039AuthHeaders(page: Page): Promise<Record<string, string>> {
  const session = await startSpec039Session(page)
  return { Authorization: `Bearer ${session.accessToken}` }
}

export async function seedSpec039Data(page: Page): Promise<Spec039SeedResult> {
  const seedUser = await page.request.post(`${BASE}/api/e2e/seed-user`, {
    data: { username: 'user', password: 'password' },
  })
  if (!seedUser.ok()) {
    await failWithSafeBody('POST /api/e2e/seed-user', seedUser.status(), await seedUser.text())
  }

  const res = await page.request.post(`${BASE}/api/e2e/spec039/seed`)
  if (!res.ok()) {
    await failWithSafeBody('POST /api/e2e/spec039/seed', res.status(), await res.text())
  }
  return (await res.json()) as Spec039SeedResult
}

export async function cleanupSpec039Data(page: Page): Promise<void> {
  const res = await page.request.delete(`${BASE}/api/e2e/spec039/cleanup`)
  if (!res.ok() && res.status() !== 404) {
    throw new Error(
      `DELETE /api/e2e/spec039/cleanup failed with ${res.status()}. Response shape: ${
        (await res.text()) ? 'non-empty' : 'empty'
      }`,
    )
  }
}

export async function resetSpec039BrowserState(page: Page): Promise<void> {
  await page.context().clearCookies()
  await page.addInitScript(() => {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith('REACT_QUERY_OFFLINE_CACHE_')) {
        window.localStorage.removeItem(key)
      }
    }
    window.sessionStorage.clear()
  })
  await startSpec039Session(page)
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.evaluate(async () => {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith('REACT_QUERY_OFFLINE_CACHE_')) {
        window.localStorage.removeItem(key)
      }
    }
    window.sessionStorage.clear()
    if ('caches' in window) {
      const cacheKeys = await caches.keys()
      await Promise.all(cacheKeys.map((key) => caches.delete(key)))
    }
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((registration) => registration.unregister()))
    }
  })
}
