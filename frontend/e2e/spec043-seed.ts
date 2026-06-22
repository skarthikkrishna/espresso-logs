import type { Page } from '@playwright/test'

const BASE = process.env.PW_BASE_URL
  ? new URL(process.env.PW_BASE_URL).origin
  : 'http://localhost:8000'

export type Spec043SeedResult = {
  household_id: string
  catalog_ids: Record<string, string>
  bag_ids: Record<string, string>
  shot_ids: Record<string, string>
  hardware_ids: Record<string, string>
  routes: Record<string, string>
}

export async function seedSpec043Data(page: Page): Promise<Spec043SeedResult> {
  const seedUser = await page.request.post(`${BASE}/api/e2e/seed-user`)
  if (!seedUser.ok()) {
    throw new Error(`POST /api/e2e/seed-user failed with ${seedUser.status()}`)
  }

  const res = await page.request.post(`${BASE}/api/e2e/spec043/seed`)
  if (!res.ok()) {
    throw new Error(`POST /api/e2e/spec043/seed failed with ${res.status()}: ${await res.text()}`)
  }
  return (await res.json()) as Spec043SeedResult
}

export async function cleanupSpec043Data(page: Page): Promise<void> {
  const res = await page.request.delete(`${BASE}/api/e2e/spec043/cleanup`)
  if (!res.ok() && res.status() !== 404) {
    throw new Error(`DELETE /api/e2e/spec043/cleanup failed with ${res.status()}`)
  }
}
