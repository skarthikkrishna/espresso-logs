/**
 * StatTile — informational stat display for summary surfaces.
 *
 * Principle 13 (Affordance Matches Interactivity): StatTile is display-only.
 * No card chrome (border, border-radius, background) that implies tappability.
 * Typography-only treatment distinguishes it from EntityCards on the same view.
 * Principle 6 (Typography-led): value + label hierarchy communicated through
 * type scale and spacing alone.
 * Principle 12 (No One-Offs): reusable for Dashboard hero and any future
 * summary page that needs a stat number + label.
 *
 * Skeleton variant: import { StatTileSkeleton } for the loading state.
 */
import type { ReactNode } from 'react'

export interface StatTileProps {
  /** Numeric or string value displayed large. */
  value: number | string
  /** Short label below the value — e.g. "Active bags". */
  label: string
  className?: string
}

export function StatTile({ value, label, className = '' }: StatTileProps) {
  return (
    <div className={['stat-tile', className].filter(Boolean).join(' ')}>
      <span className="stat-tile__value">{value}</span>
      <span className="stat-tile__label">{label}</span>
    </div>
  )
}

export function StatTileSkeleton({ className = '' }: { className?: string }): ReactNode {
  return (
    <div className={['stat-tile', 'stat-tile--skeleton', className].filter(Boolean).join(' ')} aria-hidden="true">
      <span className="stat-tile__skeleton-value" />
      <span className="stat-tile__skeleton-label" />
    </div>
  )
}
