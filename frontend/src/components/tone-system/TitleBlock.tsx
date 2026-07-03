/**
 * TitleBlock — icon + title + subtitle composition.
 *
 * Principle 6 (Typography Hierarchy): title is always FIRST; no chips or
 * buttons may appear above it. Display font for the title, body font for
 * the subtitle.
 * Principle 12 (No One-Offs): replaces per-page `.kk-tc-title-stack` divs.
 */
import type { ReactNode } from 'react'

interface TitleBlockProps {
  title: ReactNode
  subtitle?: ReactNode
}

export function TitleBlock({ title, subtitle }: TitleBlockProps) {
  return (
    <div className="kk-tc-title-stack">
      <h1 className="kk-tc-title">{title}</h1>
      {subtitle && <p className="kk-tc-subtitle">{subtitle}</p>}
    </div>
  )
}
