import type { Page } from '@playwright/test';

export interface SeedResult {
  /** ID of the created CatalogItem (e.g. "CAT100") */
  catalogItemId?: string;
  /** ID of the bag attached to the CatalogItem via POST /api/catalog/{id}/inventory */
  bagId?: string;
  /** Bag_ID of the active inventory bag (same as bagId when both are created together) */
  inventoryBagId?: string;
}

// When PW_BASE_URL is set (CI/staging), use its origin.
// Locally, seed goes directly to FastAPI (port 8000) which runs with E2E_AUTH_BYPASS=1.
const BASE = process.env.PW_BASE_URL
  ? new URL(process.env.PW_BASE_URL).origin
  : 'http://localhost:8000';

/**
 * Seeds a CatalogItem with one associated active inventory bag.
 *
 * - CatalogItem: needed by D2/D3 tests to navigate to a catalog detail page.
 * - InventoryBag (Status: Active): needed by the D5 test to populate the Bag <select>
 *   on the BrewLogAdd form.
 *
 * All names are prefixed with "PW_TEST_" for easy identification and manual cleanup.
 */
export async function seedTestData(page: Page): Promise<SeedResult> {
  const result: SeedResult = {};

  // 1. Create a CatalogItem via POST /api/catalog
  const catalogRes = await page.request.post(`${BASE}/api/catalog`, {
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
  seed: SeedResult,
): Promise<void> {
  if (!seed.catalogItemId && !seed.bagId) return;

  const res = await page.request.delete(`${BASE}/api/e2e/cleanup`, {
    data: {
      catalog_id: seed.catalogItemId ?? null,
      bag_id: seed.bagId ?? null,
    },
  });

  if (!res.ok()) {
    console.warn(
      `teardownSeedData: DELETE /api/e2e/cleanup failed: ${res.status()} ${await res.text()}`,
    );
  }
}
