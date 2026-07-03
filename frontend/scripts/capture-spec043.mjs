import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

const baseURL = process.env.PW_BASE_URL || 'http://127.0.0.1:8000'
const outRoot = join(process.cwd(), 'e2e/__screenshots__/spec-043-stats-final')
const tones = ['dark', 'beige']
const homeCaptures = [
  [{ width: 1280, height: 900 }, '1280'],
  [{ width: 390, height: 844 }, '390'],
]

let latestAccessToken = null
async function auth(context) {
  const res = await context.request.post(`${baseURL}/api/e2e/session`)
  if (!res.ok()) throw new Error(`session failed: ${res.status()} ${await res.text()}`)
  const body = await res.json()
  latestAccessToken = body.access_token
  const setCookie = res.headers()['set-cookie'] || ''
  const match = setCookie.match(/(?:^|,\s*)rt="?([^";,]+)"?/)
  if (match) {
    const url = new URL(baseURL)
    await context.addCookies([{ name: 'rt', value: match[1], domain: url.hostname, path: '/auth', httpOnly: true, sameSite: 'Lax', secure: url.protocol === 'https:' }])
  }
}

async function seed() {
  const res = await fetch(`${baseURL}/api/e2e/spec043/seed`, { method: 'POST' })
  if (!res.ok) throw new Error(`seed failed: ${res.status} ${await res.text()}`)
  return res.json()
}

async function settle(page) {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(1200)
}

async function setTypographyVariant(page) {
  await page.waitForSelector('.app-root')
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-typography-variant', 'A')
    document.querySelector('.app-root')?.setAttribute('data-typography-variant', 'A')
  })
}

async function shot(page, file) {
  mkdirSync(dirname(file), { recursive: true })
  await page.screenshot({ path: file, fullPage: true })
}

async function goto(page, path, tone) {
  await auth(page.context())
  await page.goto(`${baseURL}${path}`, { waitUntil: 'domcontentloaded' })
  await page.evaluate((t) => localStorage.setItem('kaapi-tone-preference', t), tone)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await setTypographyVariant(page)
  await settle(page)
}

async function captureHome() {
  const browser = await chromium.launch()
  const context = await browser.newContext({ baseURL })
  await auth(context)
  await context.route('**/auth/refresh', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: latestAccessToken, token_type: 'bearer' }) })
  })
  const page = await context.newPage()
  for (const tone of tones) {
    for (const [viewport, viewportName] of homeCaptures) {
      await page.setViewportSize(viewport)
      await goto(page, '/', tone)
      await shot(page, join(outRoot, tone, `home-${viewportName}.png`))
    }
  }
  await browser.close()
}

function writeComparison() {
  const homeRows = tones.map((tone) => homeCaptures.map(([, vp]) => {
    const rel = relative(outRoot, join(outRoot, tone, `home-${vp}.png`))
    return `<figure><figcaption>Option A · ${tone} · home ${vp}</figcaption><img src="${rel}"></figure>`
  }).join('\n')).join('\n')
  writeFileSync(join(outRoot, 'comparison.html'), `<!doctype html><meta charset="utf-8"><title>spec-043 stats final</title><style>body{font-family:system-ui;margin:24px;background:#120b06;color:#f5e6d3}main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}figure{margin:0}img{width:100%;height:auto;border:1px solid #6b4a2f;border-radius:8px}figcaption{margin:0 0 8px}</style><h1>spec-043 stats final — Option A</h1><main>${homeRows}</main>`)
}

await seed()
await captureHome()
writeComparison()
console.log(`screenshots written to ${outRoot}`)
