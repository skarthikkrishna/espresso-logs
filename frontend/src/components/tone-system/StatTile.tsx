/**
 * StatTile — glass mini-tile for stat displays on summary surfaces.
 *
 * Principle 1 (Dual-Tone Surface): background/border/text resolve via
 * --kk-tc-* tokens from the enclosing [data-tone] element.
 * Principle 2 (Single Surface): each tile is one glass surface; no nested blur.
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
