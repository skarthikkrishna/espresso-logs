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

type StatusChipVariant = 'status-active' | 'status-resting' | 'status-finished'
type ChipVariant = EligibilityTone | StatusChipVariant | 'default'
export type BagStatusValue = 'Active' | 'Resting' | 'Finished'

interface ChipProps {
  variant?: ChipVariant
  children: ReactNode
  'data-testid'?: string
}

interface MetricChipProps {
  children: ReactNode
  mono?: boolean
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

export function MetricChip({ children, mono = false, 'data-testid': testId }: MetricChipProps) {
  return (
    <span
      className={['kk-tc-metric-chip', mono ? 'kk-tc-metric-chip--mono' : ''].filter(Boolean).join(' ')}
      data-testid={testId}
    >
      {children}
    </span>
  )
}

function bagStatusVariant(status: string): StatusChipVariant {
  const normalized = status.toLowerCase()
  if (normalized === 'active') return 'status-active'
  if (normalized === 'resting') return 'status-resting'
  return 'status-finished'
}

export function StatusChip({ status, 'data-testid': testId }: { status: BagStatusValue | string; 'data-testid'?: string }) {
  return (
    <Chip variant={bagStatusVariant(status)} data-testid={testId}>
      {status}
    </Chip>
  )
}
