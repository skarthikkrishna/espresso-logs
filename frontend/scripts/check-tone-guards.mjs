import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const cssPath = join(process.cwd(), 'src/index.css')
const importWizardPath = join(process.cwd(), 'src/pages/ImportWizard.tsx')
const sidebarPath = join(process.cwd(), 'src/components/Sidebar.tsx')
const exceptionsPath = join(process.cwd(), 'scripts/tone-exceptions.json')
const css = readFileSync(cssPath, 'utf8')
const importWizardSource = readFileSync(importWizardPath, 'utf8')
const sidebarSource = readFileSync(sidebarPath, 'utf8')
const lines = css.split(/\r?\n/)
const exceptions = JSON.parse(readFileSync(exceptionsPath, 'utf8'))
const flatteningAllowlist = new Map(
  (exceptions.toneFlatteningAllowlist ?? []).map((entry) => [entry.family, entry]),
)

const CONTRAST_THRESHOLD = 4.5
const DIRECT_TEXT_BODY_TARGET = 5.5
const scopes = [':root', '[data-tone="dark"]', '[data-tone="beige"]']
const toneScopes = ['[data-tone="dark"]', '[data-tone="beige"]']
// Aria §3.4 deletes localized photo-text scrims. Text over photography is
// guarded by compositing normal tone tokens over the one global .app-bg overlay.
// The deterministic baseline treats the photo as fully transmissive and samples
// the contract worst case: white under dark overlays, black under beige overlays.
const overlayPhotoBaselines = new Map([
  ['[data-tone="dark"]', ['bright-photo', { r: 255, g: 255, b: 255, a: 1 }]],
  ['[data-tone="beige"]', ['dark-photo', { r: 0, g: 0, b: 0, a: 1 }]],
])

function lineOf(token, scope) {
  const def = tokenDefinitions.get(scope)?.get(token)
  return def?.line ?? 1
}

function extractScopeBody(scope) {
  const selector = `${scope} {`
  const start = lines.findIndex((line) => line.trim() === selector)
  if (start === -1) throw new Error(`Missing ${scope} block in src/index.css`)

  let depth = 0
  const body = []
  for (let i = start; i < lines.length; i += 1) {
    const line = lines[i]
    depth += (line.match(/\{/g) ?? []).length
    depth -= (line.match(/\}/g) ?? []).length
    if (i > start && depth > 0) body.push({ line, lineNumber: i + 1 })
    if (i > start && depth === 0) break
  }
  return body
}

function extractDefinitions(scope) {
  const definitions = new Map()
  for (const { line, lineNumber } of extractScopeBody(scope)) {
    const match = line.match(/^\s*(--kk-[A-Za-z0-9-]+)\s*:\s*(.+?)\s*;\s*$/)
    if (match) definitions.set(match[1], { value: match[2], line: lineNumber })
  }
  return definitions
}

const tokenDefinitions = new Map(scopes.map((scope) => [scope, extractDefinitions(scope)]))

function tokenValue(scope, token) {
  const scoped = tokenDefinitions.get(scope)?.get(token)?.value
  const root = tokenDefinitions.get(':root')?.get(token)?.value
  if (scoped) return scoped
  if (root) return root
  throw new Error(`Missing ${token} in ${scope} and :root`)
}

function optionalTokenValue(scope, token) {
  return tokenDefinitions.get(scope)?.get(token)?.value ?? tokenDefinitions.get(':root')?.get(token)?.value
}

function normalizeValue(value) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

function parseColor(value) {
  const trimmed = value.trim().toLowerCase()
  if (trimmed === 'transparent') return { r: 0, g: 0, b: 0, a: 0 }
  const hex = trimmed.match(/#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})\b/)
  if (hex) return parseHex(hex[1])

  const rgba = trimmed.match(/rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)/)
  if (rgba) {
    return {
      r: Number(rgba[1]),
      g: Number(rgba[2]),
      b: Number(rgba[3]),
      a: rgba[4] === undefined ? 1 : Number(rgba[4]),
    }
  }

  throw new Error(`Unsupported color value: ${value}`)
}

function parseHex(hex) {
  if (hex.length === 3) {
    return {
      r: Number.parseInt(hex[0] + hex[0], 16),
      g: Number.parseInt(hex[1] + hex[1], 16),
      b: Number.parseInt(hex[2] + hex[2], 16),
      a: 1,
    }
  }
  if (hex.length === 6 || hex.length === 8) {
    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16),
      a: hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1,
    }
  }
  throw new Error(`Unsupported hex color: #${hex}`)
}

function composite(foreground, background) {
  const a = foreground.a + background.a * (1 - foreground.a)
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 }
  return {
    r: (foreground.r * foreground.a + background.r * background.a * (1 - foreground.a)) / a,
    g: (foreground.g * foreground.a + background.g * background.a * (1 - foreground.a)) / a,
    b: (foreground.b * foreground.a + background.b * background.a * (1 - foreground.a)) / a,
    a,
  }
}

function channelToLinear(channel) {
  const srgb = channel / 255
  return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4
}

function luminance(color) {
  return 0.2126 * channelToLinear(color.r) + 0.7152 * channelToLinear(color.g) + 0.0722 * channelToLinear(color.b)
}

function contrastRatio(a, b) {
  const l1 = luminance(a)
  const l2 = luminance(b)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

function resolveStack(scope, tokens) {
  return tokens.reduce((background, token) => composite(parseColor(tokenValue(scope, token)), background), parseColor(tokenValue(scope, '--kk-card-surface-bg-solid')))
}

function formatBackgroundStack(tokens) {
  return [...tokens].reverse().join(' over ')
}

function gradientStopColors(value) {
  const colors = []
  for (const match of value.matchAll(/rgba?\(\s*[^)]+\)/g)) {
    colors.push(parseColor(match[0]))
  }
  return colors
}

const legibilityChecks = [
  ['chip.default', '--kk-chip-text', ['--kk-card-surface-bg', '--kk-chip-bg']],
  ['chip.neutral', '--kk-chip-neutral-text', ['--kk-card-surface-bg', '--kk-chip-neutral-bg']],
  ['chip.success', '--kk-chip-success-text', ['--kk-card-surface-bg', '--kk-chip-success-bg']],
  ['chip.brand', '--kk-chip-brand-text', ['--kk-card-surface-bg', '--kk-chip-brand-bg']],
  ['chip.warning', '--kk-chip-warning-text', ['--kk-card-surface-bg', '--kk-chip-warning-bg']],
  ['chip.danger', '--kk-chip-danger-text', ['--kk-card-surface-bg', '--kk-chip-danger-bg']],
  ['edit.default', '--kk-tc-btn-edit-text', ['--kk-card-surface-bg', '--kk-tc-btn-edit-bg']],
  ['edit.hover', '--kk-tc-btn-edit-hover-text', ['--kk-card-surface-bg', '--kk-tc-btn-edit-hover-bg']],
  ['edit.active', '--kk-tc-btn-edit-active-text', ['--kk-card-surface-bg', '--kk-tc-btn-edit-active-bg']],
  ['ghost.default', '--kk-text-secondary', ['--kk-card-surface-bg', '--kk-tc-btn-edit-bg']],
  ['ghost.hover', '--kk-text-primary', ['--kk-card-surface-bg', '--kk-tc-btn-edit-hover-bg']],
  ['danger.default', '--kk-tc-btn-danger-text', ['--kk-card-surface-bg', '--kk-tc-btn-danger-bg']],
  ['danger.hover', '--kk-tc-btn-danger-hover-text', ['--kk-card-surface-bg', '--kk-tc-btn-danger-hover-bg']],
  ['danger.active', '--kk-tc-btn-danger-active-text', ['--kk-card-surface-bg', '--kk-tc-btn-danger-active-bg']],
  ['primary.default', '--kk-primary-btn-text', ['--kk-card-surface-bg', '--kk-primary-btn-bg']],
  ['primary.hover', '--kk-primary-btn-hover-text', ['--kk-card-surface-bg', '--kk-primary-btn-hover-bg']],
  ['primary.active', '--kk-primary-btn-active-text', ['--kk-card-surface-bg', '--kk-primary-btn-active-bg']],
  ['back-link.default', '--kk-tc-back-link-color', ['--kk-card-surface-bg', '--kk-tc-back-link-chip-bg']],
  ['back-link.hover', '--kk-tc-back-link-hover', ['--kk-card-surface-bg', '--kk-tc-back-link-chip-bg']],
  ['toggle.default', '--kk-tc-tone-btn-text', ['--kk-card-surface-bg', '--kk-tc-tone-btn-bg']],
  ['toggle.hover', '--kk-tc-tone-btn-text', ['--kk-card-surface-bg', '--kk-tc-tone-btn-hover-bg']],
]

const toneSensitiveFamilies = [
  {
    family: 'chip',
    tokens: ['--kk-chip-text', '--kk-chip-neutral-text', '--kk-chip-success-text', '--kk-chip-brand-text', '--kk-chip-warning-text', '--kk-chip-danger-text'],
  },
  {
    family: 'btn-edit',
    tokens: ['--kk-tc-btn-edit-text', '--kk-tc-btn-edit-hover-text', '--kk-tc-btn-edit-active-text'],
  },
  {
    family: 'btn-danger',
    tokens: ['--kk-tc-btn-danger-text', '--kk-tc-btn-danger-hover-text', '--kk-tc-btn-danger-active-text'],
  },
  {
    family: 'primary-btn',
    tokens: ['--kk-primary-btn-text', '--kk-primary-btn-hover-text', '--kk-primary-btn-active-text'],
  },
]

const globalOverlayTokens = [
  '--kk-page-bg-overlay',
  '--kk-page-bg-overlay-dashboard',
  '--kk-page-bg-overlay-brew',
  '--kk-page-bg-overlay-catalog',
  '--kk-page-bg-overlay-hardware',
]

const directOverlayForegrounds = [
  ['primary/body', '--kk-text-primary', DIRECT_TEXT_BODY_TARGET],
  ['secondary/subtitle', '--kk-text-secondary', DIRECT_TEXT_BODY_TARGET],
  ['eyebrow/label', '--kk-text-eyebrow', CONTRAST_THRESHOLD],
  ['link/accent', '--kk-tc-link', CONTRAST_THRESHOLD],
  ['link-hover/accent', '--kk-tc-link-hover', CONTRAST_THRESHOLD],
]

const forbiddenPhotoTextTokenPattern = /--kk-photo-text(?:-scrim)?-[A-Za-z0-9-]+/
const localizedFadeSelectorPattern = /(?:kk-photo-text-scrim|kk-detail-header|kk-detail-shell|kk-extraction|kk-ai-summary|kk-tc-section)/
const localizedFadeValuePattern = /(?:linear-gradient\(|(?:-webkit-)?mask(?:-image)?\s*:)/i

let failed = false
const legibilityViolations = []

for (const forbiddenClass of ['btn', 'btn-outline', 'btn-sm', 'btn-bevel']) {
  if (new RegExp(`(?<![A-Za-z0-9_-])${forbiddenClass}(?![A-Za-z0-9_-])`).test(importWizardSource)) {
    console.error(`::error file=src/pages/ImportWizard.tsx::ImportWizard must use tone-system actions, not DaisyUI .${forbiddenClass}`)
    failed = true
  }
}

if (sidebarSource.includes('/static/img/kaapi-kadai-mark.svg')) {
  console.error('::error file=src/components/Sidebar.tsx::Sidebar must use the shared inline BrandMarkGlyph, not /static/img/kaapi-kadai-mark.svg')
  failed = true
}

if (sidebarSource.includes('kk-sidebar-brand')) {
  console.error('::error file=src/components/Sidebar.tsx::Sidebar must render the split kk-sidebar-wordmark identity, not the old kk-sidebar-brand plain text system')
  failed = true
}

for (const [name, foregroundToken, backgroundTokens] of legibilityChecks) {
  const background = resolveStack('[data-tone="beige"]', backgroundTokens)
  const foreground = composite(parseColor(tokenValue('[data-tone="beige"]', foregroundToken)), background)
  const ratio = contrastRatio(foreground, background)
  if (ratio < CONTRAST_THRESHOLD) {
    legibilityViolations.push({ name, foregroundToken, backgroundTokens, ratio })
    console.error(`::error file=src/index.css,line=${lineOf(foregroundToken, '[data-tone="beige"]')}::${name} contrast ${ratio.toFixed(2)}:1 fails ${CONTRAST_THRESHOLD}:1 AA threshold (${foregroundToken} over ${formatBackgroundStack(backgroundTokens)})`)
    failed = true
  }
}

const flatteningViolations = []
for (const { family, tokens } of toneSensitiveFamilies) {
  const darkValues = tokens.map((token) => normalizeValue(tokenValue('[data-tone="dark"]', token)))
  const beigeValues = tokens.map((token) => normalizeValue(tokenValue('[data-tone="beige"]', token)))
  const identical = darkValues.every((value, index) => value === beigeValues[index])
  if (identical && !flatteningAllowlist.has(family)) {
    flatteningViolations.push({ family, tokens })
    console.error(`::error file=src/index.css,line=${lineOf(tokens[0], '[data-tone="beige"]')}::${family} beige foreground value set is identical to dark; add an owned exception to scripts/tone-exceptions.json only if this is intentional`)
    failed = true
  }
}

function selectorForLine(lineIndex) {
  const sameLineSelector = lines[lineIndex].match(/^\s*([^{}]+)\s*\{/)
  if (sameLineSelector) return sameLineSelector[1].trim()

  for (let i = lineIndex; i >= 0; i -= 1) {
    const line = lines[i]
    const open = line.lastIndexOf('{')
    if (open !== -1) return line.slice(0, open).trim()
  }

  return ''
}

const missingOverlayTokens = new Map()
const overlayLegibilityViolations = []
const overlayLegibilityWarnings = []
const overlayParseViolations = []
const localizedLegibilityViolations = []

for (const scope of toneScopes) {
  for (const token of globalOverlayTokens) {
    if (!optionalTokenValue(scope, token)) {
      const missingScopes = missingOverlayTokens.get(token) ?? []
      missingScopes.push(scope)
      missingOverlayTokens.set(token, missingScopes)
    }
  }
}

if (missingOverlayTokens.size > 0) {
  const missing = [...missingOverlayTokens.entries()]
    .map(([token, missingScopes]) => `${token} (${missingScopes.join(', ')})`)
    .join('; ')
  console.error(`::error file=src/index.css::global .app-bg overlay tokens required by Aria §3.3/§3.4 are missing: ${missing}`)
  failed = true
} else {
  lines.forEach((line, idx) => {
    if (forbiddenPhotoTextTokenPattern.test(line)) {
      localizedLegibilityViolations.push({
        line: idx + 1,
        reason: 'forbidden localized photo-text token family',
        value: line.trim(),
      })
      console.error(`::error file=src/index.css,line=${idx + 1}::localized photo-text token/scrim family is forbidden by Aria §3.4; use normal tone tokens over --kk-page-bg-overlay instead: ${line.trim()}`)
      failed = true
    }

    const selector = selectorForLine(idx)
    if (localizedFadeSelectorPattern.test(selector) && localizedFadeValuePattern.test(line)) {
      localizedLegibilityViolations.push({
        line: idx + 1,
        reason: 'section-local gradient/mask fade in detail/photo text selector',
        value: line.trim(),
      })
      console.error(`::error file=src/index.css,line=${idx + 1}::section-local photo-fade gradient/mask is forbidden by Aria §3.4 (${selector}); move legibility to global --kk-page-bg-overlay tokens`)
      failed = true
    }
  })

  for (const scope of toneScopes) {
    const [photoName, photoBase] = overlayPhotoBaselines.get(scope)
    for (const overlayToken of globalOverlayTokens) {
      const overlayStops = gradientStopColors(tokenValue(scope, overlayToken))
      if (overlayStops.length === 0) {
        overlayParseViolations.push({ scope, overlayToken })
        console.error(`::error file=src/index.css,line=${lineOf(overlayToken, scope)}::${overlayToken} must be a gradient containing rgba()/rgb() color stops for deterministic global-overlay contrast sampling`)
        failed = true
        continue
      }

      for (const [foregroundName, foregroundToken, target] of directOverlayForegrounds) {
        const foreground = parseColor(tokenValue(scope, foregroundToken))
        let worst = { ratio: Number.POSITIVE_INFINITY }

        for (const [stopIndex, overlayStop] of overlayStops.entries()) {
          const background = composite(overlayStop, photoBase)
          const textColor = composite(foreground, background)
          const ratio = contrastRatio(textColor, background)
          if (ratio < worst.ratio) {
            worst = { ratio, overlayToken, photoName, stopIndex }
          }
        }

        if (worst.ratio < CONTRAST_THRESHOLD) {
          overlayLegibilityViolations.push({ scope, foregroundName, foregroundToken, worst })
          console.error(`::error file=src/index.css,line=${lineOf(foregroundToken, scope)}::global-overlay ${foregroundName} contrast ${worst.ratio.toFixed(2)}:1 fails ${CONTRAST_THRESHOLD}:1 AA hard minimum (${foregroundToken} over ${worst.overlayToken} stop ${worst.stopIndex + 1}, ${worst.photoName} baseline)`)
          failed = true
        } else if (target > CONTRAST_THRESHOLD && worst.ratio < target) {
          overlayLegibilityWarnings.push({ scope, foregroundName, foregroundToken, worst, target })
          console.warn(`::warning file=src/index.css,line=${lineOf(foregroundToken, scope)}::global-overlay ${foregroundName} contrast ${worst.ratio.toFixed(2)}:1 clears ${CONTRAST_THRESHOLD}:1 but misses ${target}:1 body/subtitle target (${foregroundToken} over ${worst.overlayToken} stop ${worst.stopIndex + 1}, ${worst.photoName} baseline)`)
        }
      }
    }
  }
}

if (failed) {
  console.error('\nspec-043 tone guards failed')
  console.error(`Contrast/legibility violations (${legibilityViolations.length}):`)
  for (const violation of legibilityViolations) {
    console.error(`- ${violation.name}: ${violation.ratio.toFixed(2)}:1 (${violation.foregroundToken} over ${formatBackgroundStack(violation.backgroundTokens)})`)
  }
  console.error(`Tone-flattening violations (${flatteningViolations.length}):`)
  for (const violation of flatteningViolations) {
    console.error(`- ${violation.family}: ${violation.tokens.join(', ')}`)
  }
  console.error(`Global-overlay missing contract tokens (${missingOverlayTokens.size}):`)
  for (const [token, missingScopes] of missingOverlayTokens.entries()) {
    console.error(`- ${token}: missing in ${missingScopes.join(', ')} and :root`)
  }
  console.error(`Global-overlay parse violations (${overlayParseViolations.length}):`)
  for (const violation of overlayParseViolations) {
    console.error(`- ${violation.scope} ${violation.overlayToken}: no rgba()/rgb() stops`)
  }
  console.error(`Localized photo-legibility violations (${localizedLegibilityViolations.length}):`)
  for (const violation of localizedLegibilityViolations) {
    console.error(`- line ${violation.line}: ${violation.reason} (${violation.value})`)
  }
  console.error(`Global-overlay contrast violations (${overlayLegibilityViolations.length}):`)
  for (const violation of overlayLegibilityViolations) {
    console.error(`- ${violation.scope} ${violation.foregroundName}: ${violation.worst.ratio.toFixed(2)}:1 (${violation.foregroundToken}, ${violation.worst.overlayToken}, ${violation.worst.photoName}, overlay stop ${violation.worst.stopIndex + 1})`)
  }
  process.exit(1)
}

if (overlayLegibilityWarnings.length > 0) {
  console.warn(`spec-043 global-overlay body/subtitle target warnings (${overlayLegibilityWarnings.length})`)
}
console.log('spec-043 tone contrast and flattening guards passed')
