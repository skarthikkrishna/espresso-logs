/**
 * Chip — generic tone-aware chip with semantic variants.
 *
 * Principle 7 (Chip System — Canonical Casing): NO text-transform: uppercase.
 * Data values (shot eligibility, status) render as stored ("Good Espresso",
 * not "GOOD ESPRESSO"). Only SectionHeader applies uppercase.
 * Principle 4 (Warm Coherence): success/brand/warning/danger map to
 * semantically appropriate warm-espresso palette tokens.
 * Principle 12 (No One-Offs): replaces per-page inline chip spans.
 */
import type { ReactNode } from 'react'
import type { EligibilityTone } from '../../utils/eligibility'

type ChipVariant = EligibilityTone | 'default'

interface ChipProps {
  variant?: ChipVariant
  children: ReactNode
  'data-testid'?: string
}

export function Chip({ variant = 'default', children, 'data-testid': testId }: ChipProps) {
  const variantClass = variant === 'default' || variant === 'neutral'
    ? ''
    : `kk-tc-chip--${variant}`
  return (
    <span
      className={['kk-tc-chip', variantClass].filter(Boolean).join(' ')}
      data-testid={testId}
    >
      {children}
    </span>
  )
}
