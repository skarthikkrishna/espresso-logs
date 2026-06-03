import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'

const testDir = dirname(fileURLToPath(import.meta.url))
const serviceWorkerSource = readFileSync(resolve(testDir, '../app/static/sw.js'), 'utf8')

interface FetchEventLike {
  request: Request
  respondWith: ReturnType<typeof vi.fn>
  waitUntil: ReturnType<typeof vi.fn>
  responsePromise?: Promise<Response>
}

interface ServiceWorkerHarness {
  fetchHandler: (event: FetchEventLike) => void
  fetchSpy: ReturnType<typeof vi.fn>
  caches: {
    open: ReturnType<typeof vi.fn>
    keys: ReturnType<typeof vi.fn>
  }
}

function loadServiceWorker(): ServiceWorkerHarness {
  const handlers = new Map<string, (event: FetchEventLike) => void>()
  const selfScope = {
    location: { href: 'https://espresso.test/sw.js?v=test' },
    clients: { claim: vi.fn() },
    addEventListener: vi.fn((type: string, handler: (event: FetchEventLike) => void) => {
      handlers.set(type, handler)
    }),
  }
  const caches = {
    open: vi.fn(),
    keys: vi.fn(),
  }
  const fetchSpy = vi.fn(async () => new Response('network'))

  new Function('self', 'caches', 'fetch', 'Request', 'Response', 'URL', serviceWorkerSource)(
    selfScope,
    caches,
    fetchSpy,
    Request,
    Response,
    URL,
  )

  const fetchHandler = handlers.get('fetch')
  if (!fetchHandler) {
    throw new Error('service worker did not register a fetch handler')
  }

  return { fetchHandler, fetchSpy, caches }
}

function makeFetchEvent(path: string, method = 'GET'): FetchEventLike {
  const event: FetchEventLike = {
    request: new Request(`https://espresso.test${path}`, { method }),
    respondWith: vi.fn((response: Promise<Response>) => {
      event.responsePromise = response
    }),
    waitUntil: vi.fn(),
  }

  return event
}

function expectPassThroughWithoutCache(event: FetchEventLike, harness: ServiceWorkerHarness): void {
  const respondWithCalls = event.respondWith.mock.calls.length

  expect(harness.caches.open).not.toHaveBeenCalled()
  expect(event.waitUntil).not.toHaveBeenCalled()

  if (respondWithCalls === 0) {
    expect(harness.fetchSpy).not.toHaveBeenCalled()
    return
  }

  expect(event.respondWith).toHaveBeenCalledTimes(1)
  expect(harness.fetchSpy).toHaveBeenCalledTimes(1)
  expect(harness.fetchSpy).toHaveBeenCalledWith(event.request)
}

describe('service worker fetch bypasses', () => {
  it.each([
    ['POST', '/auth/refresh'],
    ['POST', '/auth/login'],
    ['GET', '/auth'],
    ['GET', '/auth/google/callback?code=oauth-code'],
    ['GET', '/oauth/callback?code=oauth-code'],
    ['GET', '/login?oauth_success=1'],
    ['POST', '/api/brew-logs'],
    ['PUT', '/api/brew-logs/1'],
    ['PATCH', '/api/brew-logs/1'],
    ['DELETE', '/api/brew-logs/1'],
  ])('does not cache or duplicate %s %s', async (method, path) => {
    const harness = loadServiceWorker()
    const event = makeFetchEvent(path, method)

    harness.fetchHandler(event)

    expectPassThroughWithoutCache(event, harness)
    if (event.responsePromise) {
      await expect(event.responsePromise).resolves.toBeInstanceOf(Response)
    }
  })
})
