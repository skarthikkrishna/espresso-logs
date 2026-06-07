import type { Page, Response, TestInfo } from '@playwright/test'
import { test, expect } from './fixtures'
import {
  cleanupSpec039Data,
  resetSpec039BrowserState,
  seedSpec039Data,
  spec039AuthHeaders,
  SPEC039_IDS,
  startSpec039Session,
  type Spec039SeedResult,
} from './spec039-seed'

type ResponseShape = {
  method: string
  path: string
  status: number
  shapeKeys: string[]
  booleans: Record<string, boolean>
}

type ConsoleShape = {
  type: string
  hasMessage: boolean
}

type QueryShape = {
  queryKey: unknown
  stateStatus?: string
  fetchStatus?: string
  isStale?: boolean
  hasData?: boolean
}

type BrewLogDetailShape = Record<string, unknown> & {
  dose_in_g?: number | null
}

test.use({ screenshot: 'off', trace: 'off', video: 'off' })

function topLevelShape(value: unknown): string[] {
  if (Array.isArray(value)) return ['array']
  if (value && typeof value === 'object') return Object.keys(value).sort()
  return [typeof value]
}

function redactedPath(url: string): string {
  const parsed = new URL(url)
  return parsed.pathname
}

function responseBooleans(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== 'object') return {}
  const body = value as Record<string, unknown>
  return {
    has_items: Array.isArray(body.items),
    has_api_feedback: typeof body.ai_feedback === 'string' && body.ai_feedback.length > 0,
    has_catalog_id: typeof body.catalog_id === 'string' && body.catalog_id.length > 0,
    has_bag_id: typeof body.bag_id === 'string' && body.bag_id.length > 0,
    has_shot_id: typeof body.shot_id === 'string' && body.shot_id.length > 0,
  }
}

async function readResponseShape(response: Response): Promise<ResponseShape | null> {
  const path = redactedPath(response.url())
  if (!path.startsWith('/api/')) return null
  if (
    !path.includes('/brew-log') &&
    !path.includes('/catalog') &&
    !path.includes('/inventory') &&
    !path.includes('/dashboard') &&
    !path.includes('/defaults')
  ) {
    return null
  }

  let parsed: unknown = null
  try {
    parsed = await response.json()
  } catch {
    parsed = null
  }

  return {
    method: response.request().method(),
    path,
    status: response.status(),
    shapeKeys: topLevelShape(parsed),
    booleans: responseBooleans(parsed),
  }
}

function installEvidenceCapture(page: Page): {
  network: ResponseShape[]
  consoleMessages: ConsoleShape[]
} {
  const network: ResponseShape[] = []
  const consoleMessages: ConsoleShape[] = []

  page.on('console', (msg) => {
    consoleMessages.push({ type: msg.type(), hasMessage: msg.text().length > 0 })
  })
  page.on('response', (response) => {
    void readResponseShape(response)
      .then((shape) => {
        if (shape) network.push(shape)
      })
      .catch(() => undefined)
  })

  return { network, consoleMessages }
}

async function persistedQueryShapes(page: Page): Promise<QueryShape[]> {
  return page.evaluate(() => {
    const output: QueryShape[] = []
    for (const key of Object.keys(window.localStorage)) {
      if (!key.startsWith('REACT_QUERY_OFFLINE_CACHE_')) continue
      const raw = window.localStorage.getItem(key)
      if (!raw) continue
      try {
        const parsed = JSON.parse(raw) as {
          clientState?: {
            queries?: Array<{
              queryKey?: unknown
              state?: { status?: string; fetchStatus?: string; data?: unknown; isInvalidated?: boolean }
            }>
          }
        }
        for (const query of parsed.clientState?.queries ?? []) {
          output.push({
            queryKey: query.queryKey,
            stateStatus: query.state?.status,
            fetchStatus: query.state?.fetchStatus,
            isStale: query.state?.isInvalidated,
            hasData: query.state?.data != null,
          })
        }
      } catch {
        output.push({ queryKey: ['unparseable-persisted-cache'], hasData: false })
      }
    }
    return output
  })
}

async function attachMetadata(
  testInfo: TestInfo,
  name: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  await testInfo.attach(name, {
    body: JSON.stringify(metadata, null, 2),
    contentType: 'application/json',
  })
}

async function fetchSpec039BrewLogDetail(page: Page, shotId: string): Promise<BrewLogDetailShape> {
  const apiResponse = await page.request.get(`/api/brew-log/${shotId}`, {
    headers: await spec039AuthHeaders(page),
  })
  if (!apiResponse.ok()) {
    throw new Error(
      `GET /api/brew-log/${shotId} failed with ${apiResponse.status()}. ` +
        `Response shape: ${(await apiResponse.text()) ? 'non-empty' : 'empty'}`,
    )
  }
  return (await apiResponse.json()) as BrewLogDetailShape
}

function formNumberValue(value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('Expected seeded latest-shot dose metadata to be a finite number')
  }
  return Number.isInteger(value) ? value.toFixed(1) : String(value)
}

async function gotoWithFreshSpec039Session(page: Page, path: string): Promise<void> {
  await startSpec039Session(page)
  await page.goto(path)
}

async function gotoCatalogDetail(page: Page, catalogId: string): Promise<void> {
  await gotoWithFreshSpec039Session(page, `/catalog/${catalogId}`)
  await expect(page.getByTestId('catalog-detail')).toBeVisible({ timeout: 15_000 })
}

async function gotoBrewLogDetail(page: Page, shotId: string): Promise<void> {
  await gotoWithFreshSpec039Session(page, `/brew-log/${shotId}`)
  await expect(page.getByTestId('brew-log-detail')).toBeVisible({ timeout: 15_000 })
}

test.describe('spec-039 UI data freshness evidence', () => {
  let seed: Spec039SeedResult
  let latestActiveBagDoseValue: string

  test.beforeEach(async ({ page }) => {
    await cleanupSpec039Data(page)
    seed = await seedSpec039Data(page)
    const latestActiveBagShot = await fetchSpec039BrewLogDetail(page, SPEC039_IDS.shots.aiEmpty)
    latestActiveBagDoseValue = formNumberValue(latestActiveBagShot.dose_in_g)
    await resetSpec039BrowserState(page)
  })

  test.afterEach(async ({ page }) => {
    await cleanupSpec039Data(page)
  })

  test('B03 diagnostic keeps stored AI feedback non-repro and metadata-only', async ({
    page,
  }, testInfo) => {
    const evidence = installEvidenceCapture(page)
    const apiBody = await fetchSpec039BrewLogDetail(page, SPEC039_IDS.shots.aiPresent)
    expect(Object.keys(apiBody).sort()).toContain('ai_feedback')
    expect(typeof apiBody.ai_feedback === 'string' && apiBody.ai_feedback.length > 0).toBe(true)

    await gotoBrewLogDetail(page, SPEC039_IDS.shots.aiPresent)
    const feedbackSection = page.getByRole('heading', { name: 'AI feedback' }).locator('..')
    await expect(feedbackSection.getByRole('button', { name: /get ai feedback/i })).toHaveCount(0)
    await expect(feedbackSection.getByText('No feedback available.')).toHaveCount(0)
    await expect(feedbackSection.locator('p').first()).toBeVisible()

    const queryShapes = await persistedQueryShapes(page)
    await attachMetadata(testInfo, 'spec039-b03-metadata.json', {
      shot_id: SPEC039_IDS.shots.aiPresent,
      seed_has_ai_feedback: seed.has_ai_feedback[SPEC039_IDS.shots.aiPresent] === true,
      api_shape_keys: Object.keys(apiBody).sort(),
      has_api_feedback: typeof apiBody.ai_feedback === 'string' && apiBody.ai_feedback.length > 0,
      rendered_feedback_section: true,
      query_keys: queryShapes.map((entry) => entry.queryKey),
      network: evidence.network,
      console: evidence.consoleMessages,
    })
  })

  test('B01/B02/B04/B05/B06/B07 actionable flow checks expose exact implementation gaps', async ({
    page,
  }, testInfo) => {
    const evidence = installEvidenceCapture(page)

    await gotoCatalogDetail(page, SPEC039_IDS.catalogs.locked)
    await expect(page.getByText('Active')).toBeVisible()
    await expect(page.getByText('Finished')).toBeVisible()
    await expect.soft(page.getByRole('button', { name: /finish bag/i })).toBeVisible()
    await expect.soft(page.getByRole('button', { name: /reactivate/i })).toBeVisible()

    await page.getByRole('button', { name: /\+ add bag/i }).click()
    const bagsSection = page
      .getByTestId('catalog-detail')
      .locator('section', { has: page.getByRole('heading', { name: 'Bags' }) })
    const roastLevel = bagsSection.getByLabel('Roast level')
    await expect.soft(roastLevel).toHaveValue('Medium')
    await expect.soft(roastLevel).toBeDisabled()
    await expect.soft(bagsSection.getByText(/^Roast level set by catalog: Medium$/)).toBeVisible()

    await gotoWithFreshSpec039Session(page, '/catalog')
    await page.getByRole('button', { name: /add bean/i }).click()
    await page.getByRole('button', { name: /enter manually/i }).click()
    await expect.soft(page.locator('dialog input[type="file"]')).toBeVisible()

    await gotoBrewLogDetail(page, SPEC039_IDS.shots.typo)
    await expect.soft(page.getByRole('button', { name: /edit|correct/i })).toBeVisible()

    await gotoBrewLogDetail(page, SPEC039_IDS.shots.aiEmpty)
    const postFeedbackPromise = page.waitForResponse(
      (response) =>
        redactedPath(response.url()) === `/api/brew-log/${SPEC039_IDS.shots.aiEmpty}/feedback` &&
        response.request().method() === 'POST',
      { timeout: 5_000 },
    )
    await page.getByRole('button', { name: /get ai feedback/i }).click()
    await expect.soft(postFeedbackPromise).resolves.toBeTruthy()

    await gotoWithFreshSpec039Session(page, '/')
    await page
      .getByText('SPEC039_Roaster_Locked — SPEC039_Locked_Bean')
      .first()
      .click()
    await expect.soft(page).toHaveURL(new RegExp(`/brew-log/add\\?bag_id=${SPEC039_IDS.bags.active}`))
    await expect.soft(page.getByLabel('Bag')).toHaveValue(SPEC039_IDS.bags.active)
    await expect.soft(page.getByLabel('Dose (g)')).toHaveValue(latestActiveBagDoseValue)

    await attachMetadata(testInfo, 'spec039-actionable-flow-metadata.json', {
      synthetic_ids: {
        catalog: SPEC039_IDS.catalogs.locked,
        active_bag: SPEC039_IDS.bags.active,
        finished_bag: SPEC039_IDS.bags.finished,
        typo_shot: SPEC039_IDS.shots.typo,
        empty_feedback_shot: SPEC039_IDS.shots.aiEmpty,
      },
      network: evidence.network,
      console: evidence.consoleMessages,
    })
  })

  test('B08 diagnostic create flows are immediately actionable with empty and warm cache', async ({
    page,
  }, testInfo) => {
    const evidence = installEvidenceCapture(page)
    const stamp = Date.now()
    const roaster = `PW_TEST_SPEC039_CACHE_${stamp}`
    const bean = `PW_TEST_SPEC039_BEAN_${stamp}`

    await gotoWithFreshSpec039Session(page, '/catalog')
    await page.getByRole('button', { name: /add bean/i }).click()
    await page.getByRole('button', { name: /enter manually/i }).click()
    await page.locator('dialog input[type="text"]').nth(0).fill(roaster)
    await page.locator('dialog input[type="text"]').nth(1).fill(bean)
    await page.locator('dialog select').selectOption('Medium')
    await page.getByRole('button', { name: /save bean/i }).click()
    await expect(page.getByText(roaster)).toBeVisible({ timeout: 15_000 })
    await page.getByText(roaster).click()
    await expect(page.getByTestId('catalog-detail')).toBeVisible()

    await page.getByRole('button', { name: /\+ add bag/i }).click()
    await page.getByLabel('Roast date').fill('2026-02-04')
    const roastLevel = page.getByLabel('Roast level')
    if ((await roastLevel.count()) > 0 && await roastLevel.isEnabled()) {
      await roastLevel.selectOption('Medium')
    }
    await page.getByRole('button', { name: /save bag/i }).click()
    await expect(page.getByText('Active')).toBeVisible({ timeout: 15_000 })

    await gotoWithFreshSpec039Session(page, '/brew-log/add')
    const bagSelect = page.getByLabel('Bag')
    await expect(bagSelect).toContainText(roaster)
    const createdBagOptionValue = await bagSelect
      .locator('option')
      .filter({ hasText: roaster })
      .first()
      .getAttribute('value')
    if (!createdBagOptionValue) {
      throw new Error('Created SPEC039 bag option did not expose a selectable value')
    }
    await bagSelect.selectOption(createdBagOptionValue)
    await page.getByLabel('Dose (g)').fill('18')
    await page.getByLabel('Yield (g)').fill('36')
    await page.getByLabel('Time (s)').fill('28')
    await page.getByLabel('Shot eligibility').selectOption('Good Espresso')
    await page.getByRole('button', { name: /save|log shot/i }).click()
    await expect(page).toHaveURL(/\/brew-log/)
    await expect(page.getByText(roaster).first()).toBeVisible({ timeout: 15_000 })

    const emptyCacheQueryShapes = await persistedQueryShapes(page)
    await startSpec039Session(page)
    await page.reload()
    await expect(page.getByText(roaster).first()).toBeVisible({ timeout: 15_000 })
    const warmCacheQueryShapes = await persistedQueryShapes(page)

    await attachMetadata(testInfo, 'spec039-b08-cache-metadata.json', {
      created_prefixes: { roaster_prefix: 'PW_TEST_SPEC039_CACHE_', bean_prefix: 'PW_TEST_SPEC039_BEAN_' },
      empty_cache_query_keys: emptyCacheQueryShapes.map((entry) => entry.queryKey),
      warm_cache_query_keys: warmCacheQueryShapes.map((entry) => entry.queryKey),
      network: evidence.network,
      console: evidence.consoleMessages,
    })
  })
})
