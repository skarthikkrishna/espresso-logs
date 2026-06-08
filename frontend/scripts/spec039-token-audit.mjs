import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const frontendRoot = path.resolve(scriptDir, '..')
const outputPath = path.join(frontendRoot, 'baselines', 'spec039-token-audit.csv')

const targetPageFiles = [
  'src/pages/Login.tsx',
  'src/pages/Register.tsx',
  'src/pages/Welcome.tsx',
  'src/pages/HouseholdNew.tsx',
  'src/pages/HouseholdSettings.tsx',
  'src/pages/InviteAccept.tsx',
  'src/pages/InviteExpired.tsx',
  'src/pages/InviteInvalid.tsx',
  'src/pages/HouseholdGuestView.tsx',
  'src/pages/Profile.tsx',
]

const tokenQueries = [
  {
    tokenType: 'tailwind_shadow_utility',
    regex: utilityRegex('shadow'),
  },
  {
    tokenType: 'tailwind_rounded_utility',
    regex: utilityRegex('rounded'),
  },
  {
    tokenType: 'tailwind_border_utility',
    regex: utilityRegex('border'),
  },
  {
    tokenType: 'raw_rgba',
    regex: /rgba\(\s*[-.\d]+(?:\s*,\s*[-.\d]+){2}\s*,\s*[-.\d]+%?\s*\)/g,
  },
  {
    tokenType: 'css_custom_property',
    regex: /--[A-Za-z][A-Za-z0-9-]*/g,
  },
  {
    tokenType: 'backdrop_filter_assignment',
    regex: /(?:-webkit-)?backdrop-filter\s*:/g,
  },
  {
    tokenType: 'hardcoded_box_shadow',
    regex: /box-shadow\s*:\s*(?![^;\n]*var\()/g,
  },
  {
    tokenType: 'hardcoded_border_radius',
    regex: /border-radius\s*:\s*(?![^;\n]*var\()/g,
  },
  {
    tokenType: 'spec030_token_usage',
    regex:
      /--(?:glass|bevel|btn|input)-[A-Za-z0-9-]+|\b(?:btn-bevel|input-styled|glass-card|card-bevel|glass-modal-backdrop|glass-modal-surface)\b/g,
  },
]

function utilityRegex(prefix) {
  return new RegExp(
    String.raw`(?:^|[\s"'` + '`' + String.raw`])((?:[a-z0-9-]+:)*${prefix}(?:-[A-Za-z0-9_:/\[\]().%#-]+)?)(?=$|[\s"'` + '`' + String.raw`])`,
    'g',
  )
}

function surfaceFor(filePath) {
  const basename = path.basename(filePath, path.extname(filePath))
  if (filePath === 'src/index.css') return 'global-css'
  if (filePath.startsWith('src/components/')) return `component:${basename}`
  return basename
}

function csvEscape(value) {
  const text = String(value)
  if (!/[",\n]/.test(text)) return text
  return `"${text.replaceAll('"', '""')}"`
}

function countMatches(content, regex) {
  regex.lastIndex = 0
  const matches = content.match(regex)
  return matches ? matches.length : 0
}

function exampleLines(content, regex) {
  const examples = []
  const lines = content.split(/\r?\n/)
  for (const [index, line] of lines.entries()) {
    regex.lastIndex = 0
    if (!regex.test(line)) continue
    examples.push(`L${index + 1}: ${line.trim().replace(/\s+/g, ' ')}`)
    if (examples.length === 3) break
  }
  return examples.join(' | ')
}

async function componentFiles() {
  const componentDir = path.join(frontendRoot, 'src/components')
  const entries = await readdir(componentDir)
  return entries
    .filter((entry) => entry.endsWith('.tsx') && !entry.endsWith('.test.tsx'))
    .sort()
    .map((entry) => `src/components/${entry}`)
}

async function assertReadable(relativePath) {
  const absolutePath = path.join(frontendRoot, relativePath)
  try {
    await readFile(absolutePath, 'utf8')
  } catch (error) {
    throw new Error(`Missing or unreadable audit target ${relativePath}: ${error.message}`)
  }
}

async function main() {
  const files = [...targetPageFiles, 'src/index.css', ...(await componentFiles())]
  for (const file of files) {
    await assertReadable(file)
  }

  const rows = [['surface', 'file_path', 'token_type', 'count', 'example_lines']]
  for (const file of files) {
    const content = await readFile(path.join(frontendRoot, file), 'utf8')
    for (const query of tokenQueries) {
      rows.push([
        surfaceFor(file),
        file,
        query.tokenType,
        countMatches(content, query.regex),
        exampleLines(content, query.regex),
      ])
    }
  }

  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(
    outputPath,
    `${rows.map((row) => row.map(csvEscape).join(',')).join('\n')}\n`,
    'utf8',
  )

  const surfaceCount = new Set(targetPageFiles.map(surfaceFor)).size
  console.log(
    `Wrote ${path.relative(frontendRoot, outputPath)} with ${rows.length - 1} matrix rows across ${surfaceCount} target page surfaces.`,
  )
}

await main()
