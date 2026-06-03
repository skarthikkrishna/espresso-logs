import type { Page } from '@playwright/test';

export interface SeedResult {
  /** ID of the created CatalogItem (e.g. "CAT100") */
  catalogItemId?: string;
  /** ID of the bag attached to the CatalogItem via POST /api/catalog/{id}/inventory */
  bagId?: string;
  /** Bag_ID of the active inventory bag (same as bagId when both are created together) */
  inventoryBagId?: string;
}

interface TeardownOptions {
  resetHousehold?: boolean;
}

// When PW_BASE_URL is set (CI/staging), use its origin.
// Locally, seed goes directly to FastAPI (port 8000).
const BASE = process.env.PW_BASE_URL
  ? new URL(process.env.PW_BASE_URL).origin
  : 'http://localhost:8000';

// Module-level token cache — refreshed per-test by the fixtures.ts auth fixture
// via setTokenCache(), falling back to a real POST /auth/login when the cache
// is absent or the token is near expiry. The access_token lifetime is 900 s;
// we refresh 100 s early to avoid hitting a 401 mid-test.
const _ACCESS_TOKEN_TTL_MS = 900_000;
const _ACCESS_TOKEN_REFRESH_BUFFER_MS = 100_000;

let _tokenPromise: Promise<string> | null = null;
let _tokenIssuedAt = 0;

/**
 * Pre-populate the Bearer token cache with a token already obtained by the
 * per-test fixture (POST /api/e2e/session). Calling this prevents
 * getAccessToken() from issuing a separate POST /auth/login — which would
 * overwrite the fixture's rt httpOnly cookie with a new one.
 */
export function setTokenCache(token: string): void {
  _tokenPromise = Promise.resolve(token);
  _tokenIssuedAt = Date.now();
}

async function getAccessToken(page: Page): Promise<string> {
  // Reset the cache if the token is within the refresh buffer of expiry.
  if (
    _tokenPromise !== null &&
    Date.now() - _tokenIssuedAt > _ACCESS_TOKEN_TTL_MS - _ACCESS_TOKEN_REFRESH_BUFFER_MS
  ) {
    _tokenPromise = null;
    _tokenIssuedAt = 0;
  }

  if (!_tokenPromise) {
    _tokenPromise = (async () => {
      const res = await page.request.post(`${BASE}/auth/login`, {
        data: { username: 'user', password: 'password' },
      });
      if (!res.ok()) {
        _tokenPromise = null; // allow retry on next call
        throw new Error(
          `seed: POST /auth/login failed: ${res.status()} ${await res.text()}`,
        );
      }
      const body = (await res.json()) as { access_token: string };
      _tokenIssuedAt = Date.now();
      return body.access_token;
    })();
  }
  return _tokenPromise;
}

/**
 * Seeds a CatalogItem with one associated active inventory bag.
 *
 * - CatalogItem: needed by D2/D3 tests to navigate to a catalog detail page.
 * - InventoryBag (Status: Active): needed by the D5 test to populate the Bag <select>
 *   on the BrewLogAdd form.
 *
 * All names are prefixed with "PW_TEST_" for easy identification and manual cleanup.
 *
 * Protected API calls use an explicit Authorization: Bearer header obtained via
 * a real login. page.request does not run AuthContext, so the in-memory access
 * token would not be present without this header.
 */
export async function seedTestData(page: Page): Promise<SeedResult> {
  const result: SeedResult = {};
  const token = await getAccessToken(page);
  const authHeaders = { Authorization: `Bearer ${token}` };

  // 1. Create a CatalogItem via POST /api/catalog
  const catalogRes = await page.request.post(`${BASE}/api/catalog`, {
    headers: authHeaders,
    data: {
      roaster: 'PW_TEST_Roaster',
      bean_name: 'PW_TEST_Bean',
      roast_level: 'Medium',
    },
  });
  if (!catalogRes.ok()) {
    throw new Error(
      `seedTestData: POST /api/catalog failed: ${catalogRes.status()} ${await catalogRes.text()}`,
    );
  }
  const catalogItem = await catalogRes.json();
  result.catalogItemId = catalogItem.catalog_id as string;

  // 2. Create an inventory bag for the catalog item via POST /api/catalog/{id}/inventory
  // This bag will have Status: Active (default), making it available in the Bag <select>.
  const bagRes = await page.request.post(
    `${BASE}/api/catalog/${result.catalogItemId}/inventory`,
    {
      headers: authHeaders,
      data: {
        roast_date: '2026-01-01',
        roast_level: 'Medium',
        beans: 'PW_TEST_Roaster — PW_TEST_Bean',
        storage_method: 'Freezer',
      },
    },
  );
  if (!bagRes.ok()) {
    throw new Error(
      `seedTestData: POST /api/catalog/${result.catalogItemId}/inventory failed: ${bagRes.status()} ${await bagRes.text()}`,
    );
  }
  const bag = await bagRes.json();
  result.bagId = bag.bag_id as string;
  result.inventoryBagId = bag.bag_id as string;

  return result;
}

/**
 * Removes records created by seedTestData by calling the E2E cleanup endpoint.
 *
 * The endpoint (DELETE /api/e2e/cleanup) is only available when the backend
 * is started with E2E_AUTH_BYPASS=1.  Teardown failures are logged as warnings
 * rather than thrown — a teardown error should not fail the test itself.
 */
export async function teardownSeedData(
  page: Page,
  seed: SeedResult | undefined,
  options: TeardownOptions = {},
): Promise<void> {
  const resetHousehold = options.resetHousehold ?? false;
  if (!seed?.catalogItemId && !seed?.bagId && !resetHousehold) return;

  let authHeaders: Record<string, string> = {};
  try {
    const token = await getAccessToken(page);
    authHeaders = { Authorization: `Bearer ${token}` };
  } catch {
    // If token acquisition fails, proceed without auth header —
    // the cleanup endpoint may still accept the request in E2E_AUTH_BYPASS mode.
  }

  const res = await page.request.delete(`${BASE}/api/e2e/cleanup`, {
    headers: authHeaders,
    data: {
      catalog_id: seed?.catalogItemId ?? null,
      bag_id: seed?.bagId ?? null,
      reset_household: resetHousehold,
    },
  });

  if (!res.ok()) {
    console.warn(
      `teardownSeedData: DELETE /api/e2e/cleanup failed: ${res.status()} ${await res.text()}`,
    );
  }
}

export async function resetE2EState(page: Page): Promise<void> {
  await teardownSeedData(page, {}, { resetHousehold: true });
}
