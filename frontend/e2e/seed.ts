import type { Page } from '@playwright/test';

export interface SeedResult {
  /** ID of the created CatalogItem (e.g. "CAT100") */
  catalogItemId?: string;
  /** ID of the bag attached to the CatalogItem via POST /api/catalog/{id}/inventory */
  bagId?: string;
  /** Bag_ID of the active inventory bag (same as bagId when both are created together) */
  inventoryBagId?: string;
}

const BASE = process.env.PW_BASE_URL
  ? new URL(process.env.PW_BASE_URL).origin
  : 'http://localhost:4173';

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
 * Removes records created by seedTestData.
 *
 * No DELETE /api/catalog or DELETE /api/inventory endpoints exist as of spec-029.
 * Records are identifiable by the "PW_TEST_" prefix and can be removed manually if needed.
 */
export async function teardownSeedData(
  _page: Page,
  _seed: SeedResult,
): Promise<void> {
  // TODO: teardown requires DELETE /api/catalog/{catalogItemId}
  // TODO: teardown requires DELETE /api/inventory/{bagId}
  // Until DELETE endpoints are available, PW_TEST_-prefixed records must be
  // cleaned up manually or via a separate maintenance script.
}
