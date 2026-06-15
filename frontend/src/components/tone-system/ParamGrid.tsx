/**
 * ParamGrid + ParamPair — brew-parameter and hardware-spec data readout.
 *
 * Principle 6 (Typography Hierarchy): labels use `.kk-tc-param-label`
 * (12px/500, tertiary color, uppercase); values use `.kk-tc-param-value`
 * (16px/600, primary color, tabular nums).
 * Principle 2 (Single Surface): sits directly on the glass — no nested card.
 * Principle 12 (No One-Offs): replaces per-page `<dl className="kk-tc-param-grid">
 * <dt/><dd>` inline patterns.
 */
import type { ReactNode } from 'react'

interface ParamGridProps {
  children: ReactNode
}

export function ParamGrid({ children }: ParamGridProps) {
  return <dl className="kk-tc-param-grid">{children}</dl>
}

interface ParamPairProps {
  label: ReactNode
  value: ReactNode
  /** Optional testid on the <dt> label element. */
  labelTestId?: string
}

export function ParamPair({ label, value, labelTestId }: ParamPairProps) {
  return (
    <>
      <dt className="kk-tc-param-label" data-testid={labelTestId}>
        {label}
      </dt>
      <dd className="kk-tc-param-value">{value}</dd>
    </>
  )
}
