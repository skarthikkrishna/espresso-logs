import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { expect, test } from './fixtures'
import { cleanupSpec043Data, seedSpec043Data } from './spec043-seed'

test.use({ screenshot: 'off', serviceWorkers: 'block', trace: 'off', video: 'off' })
test.setTimeout(180_000)

const widths = [360, 390, 414, 768, 1024, 1440] as const
const tones = ['dark', 'beige'] as const
const outputRoot = path.join('e2e', '__screenshots__', 'spec-043')

test('captures Batch 0 proof screenshot grid with realistic isolated seed data', async ({ page }) => {
  const seed = await seedSpec043Data(page)

  try {
    const pages = [
      { key: 'dashboard', route: seed.routes.dashboard, proofText: 'Sey Coffee' },
      { key: 'catalog-list', route: seed.routes.catalog_list, proofText: 'Sey Coffee' },
      {
        key: 'catalog-detail',
        route: seed.routes.catalog_detail,
        proofText: 'Ethiopia Bensa Bombe Qonqona',
      },
      {
        key: 'brew-log',
        route: seed.routes.brew_log,
        proofText: 'God Shot',
      },
      {
        key: 'brew-log-detail',
        route: seed.routes.brew_log_detail,
        proofText: 'Strawberry jam, bergamot',
      },
    ]

    for (const target of pages) {
      await mkdir(path.join(outputRoot, target.key), { recursive: true })
      for (const tone of tones) {
        for (const width of widths) {
          await page.setViewportSize({ width, height: 1100 })
          await page.request.post('/api/e2e/reset-limiter')
          await page.addInitScript((nextTone) => {
            window.localStorage.setItem('kaapi-tone-preference', nextTone)
          }, tone)
          await page.goto(target.route, { waitUntil: 'domcontentloaded' })
          await page.waitForLoadState('networkidle')
          await expect(page.getByText(target.proofText, { exact: false }).first()).toBeVisible({
            timeout: 15_000,
          })
          if (target.key === 'catalog-list' || target.key === 'catalog-detail') {
            await expect(page.locator('img[src*="/static/e2e-assets/spec-043/"]').first()).toBeVisible()
          }
          await page.screenshot({
            path: path.join(outputRoot, target.key, `${width}-${tone}.png`),
            fullPage: true,
          })
        }
      }
    }
  } finally {
    await cleanupSpec043Data(page)
  }
})
