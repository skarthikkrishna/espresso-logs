import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const cssPath = join(process.cwd(), 'src/index.css')
const css = readFileSync(cssPath, 'utf8')
const lines = css.split(/\r?\n/)

const canonicalPerTone = [
  '--kk-card-surface-bg',
  '--kk-card-surface-bg-solid',
  '--kk-card-surface-border',
  '--kk-card-surface-shadow',
  '--kk-card-surface-blur',
  '--kk-card-surface-filter',
  '--kk-text-primary',
  '--kk-text-secondary',
  '--kk-text-tertiary',
  '--kk-text-eyebrow',
  '--kk-primary-btn-bg',
  '--kk-primary-btn-text',
  '--kk-primary-btn-border',
  '--kk-primary-btn-hover-bg',
  '--kk-primary-btn-active-bg',
  '--kk-chip-bg',
  '--kk-chip-text',
  '--kk-chip-border',
  '--kk-monogram-tile-bg',
]

const allowedScopes = new Map([
  [':root', new Set(canonicalPerTone)],
  ['[data-tone="dark"]', new Set(canonicalPerTone)],
  ['[data-tone="beige"]', new Set(canonicalPerTone)],
])

function scopeAt(lineIndex) {
  let scope = ':root'
  for (let i = lineIndex; i >= 0; i -= 1) {
    const line = lines[i].trim()
    if (line === '[data-tone="dark"] {' || line === '[data-tone="dark"] {') return '[data-tone="dark"]'
    if (line === '[data-tone="beige"] {' || line === '[data-tone="beige"] {') return '[data-tone="beige"]'
    if (line === ':root {' || line.endsWith(' :root {')) return ':root'
  }
  return scope
}

let failed = false
for (const [scope, allowed] of allowedScopes.entries()) {
  for (const token of allowed) {
    const matches = []
    lines.forEach((line, idx) => {
      if (new RegExp(`^\\s*${token.replaceAll('-', '\\-')}\\s*:`).test(line) && scopeAt(idx) === scope) {
        matches.push(idx + 1)
      }
    })
    const expected = scope === ':root' ? (['--kk-text-primary','--kk-text-secondary','--kk-text-tertiary','--kk-text-eyebrow','--kk-primary-btn-bg','--kk-primary-btn-text','--kk-primary-btn-border','--kk-primary-btn-hover-bg','--kk-primary-btn-active-bg','--kk-chip-bg','--kk-chip-text','--kk-chip-border','--kk-monogram-tile-bg'].includes(token) ? 0 : 1) : 1
    if (matches.length !== expected) {
      console.error(`::error file=src/index.css::${token} has ${matches.length} definitions in ${scope}; expected ${expected}${matches.length ? ` (lines ${matches.join(', ')})` : ''}`)
      failed = true
    }
  }
}

const forbiddenDefinitionPatterns = [
  /^\s*--kk-tc-surface(?:-solid)?\s*:/,
  /^\s*--kk-tc-border\s*:/,
  /^\s*--kk-tc-bevel-shadow\s*:/,
  /^\s*--kk-tc-blur\s*:/,
  /^\s*--kk-ec-blur\s*:/,
  /^\s*--kk-tc-primary-btn-(?:bg|text|border|hover-bg|hover-text|hover-border|active-bg|active-text|active-border|focus-ring)\s*:/,
  /^\s*--kk-tc-chip(?:-|$)/,
  /^\s*--kk-tc-text-(?:primary|secondary|tertiary)\s*:/,
  /^\s*--kk-tc-roast-.*-border\s*:/,
  /^\s*--kk-tc-monogram-tile-bg\s*:/,
]

lines.forEach((line, idx) => {
  if (forbiddenDefinitionPatterns.some((pattern) => pattern.test(line))) {
    console.error(`::error file=src/index.css,line=${idx + 1}::forbidden in-scope parallel token definition remains: ${line.trim()}`)
    failed = true
  }
})

const definedKkTokens = new Set()
const definitionPattern = /^\s*(--kk-[A-Za-z0-9-]+)\s*:/
lines.forEach((line) => {
  const match = line.match(definitionPattern)
  if (match) definedKkTokens.add(match[1])
})

const undefinedKkVarUsages = new Map()
const varUsagePattern = /var\(\s*(--kk-[A-Za-z0-9-]+)\s*(,|\))/g
lines.forEach((line, idx) => {
  for (const match of line.matchAll(varUsagePattern)) {
    const [, token, delimiter] = match
    if (delimiter === ')' && !definedKkTokens.has(token)) {
      const usages = undefinedKkVarUsages.get(token) ?? []
      usages.push(idx + 1)
      undefinedKkVarUsages.set(token, usages)
    }
  }
})

for (const [token, usageLines] of undefinedKkVarUsages.entries()) {
  console.error(`::error file=src/index.css::${token} is consumed via var(${token}) without an inline fallback but is never defined (usage lines ${usageLines.join(', ')})`)
  failed = true
}

if (failed) process.exit(1)
console.log('spec-043 token unification guard passed')
