/**
 * RoastChip — roast-level gradient chip absorbing roastChipClass.ts.
 *
 * Principle 7 (Chip System — Canonical Casing): renders `level` as-is from
 * the data source ("Light", "Light / Medium") with NO text-transform:uppercase.
 * The CSS `.kk-tc-chip--roast` previously had `text-transform:uppercase`; that
 * is now removed — this component is the authoritative roast chip renderer.
 * Principle 7 (Roast Gradation): 5-stop beige→espresso gradient; text flips
 * at Medium for AA contrast on both tones (see aria-principles-northstar.md §7).
 * Principle 12 (No One-Offs): replaces inline `roastChipClass()` utility calls.
 */
import { ROAST_LEVELS } from '../../utils/roastLevels'

const ROAST_SLUGS = new Set(
  ROAST_LEVELS.map((l) => l.toLowerCase().replace(' / ', '-')),
)

interface RoastChipProps {
  level?: string | null
}

export function RoastChip({ level }: RoastChipProps) {
  if (!level) return null
  const slug = level.toLowerCase().replace(' / ', '-')
  const className = ROAST_SLUGS.has(slug)
    ? `kk-tc-chip kk-tc-chip--roast kk-tc-chip--roast-${slug}`
    : 'kk-tc-chip'
  // Render canonical casing — never uppercase (Principle 7)
  return <span className={className}>{level}</span>
}
