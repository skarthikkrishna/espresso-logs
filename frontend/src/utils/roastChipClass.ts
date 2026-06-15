import { ROAST_LEVELS } from './roastLevels'

const ROAST_SLUGS = new Set(
  ROAST_LEVELS.map((l) => l.toLowerCase().replace(' / ', '-')),
)

/**
 * Returns the full className string for a roast-level gradient chip.
 * Falls back to the default kk-tc-chip when level is empty or unrecognised.
 */
export function roastChipClass(level: string | null | undefined): string {
  if (!level) return 'kk-tc-chip'
  const slug = level.toLowerCase().replace(' / ', '-')
  if (!ROAST_SLUGS.has(slug)) return 'kk-tc-chip'
  return `kk-tc-chip kk-tc-chip--roast kk-tc-chip--roast-${slug}`
}
