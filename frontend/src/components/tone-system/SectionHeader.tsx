/**
 * SectionHeader — the uppercase small section label (h2 or h3).
 *
 * Principle 6 (Typography Hierarchy): section headers are uppercase, small,
 * and muted — the only UI element that legitimately uses text-transform:uppercase.
 * All data-value chips and body text use canonical casing (Principle 7).
 * Principle 12 (No One-Offs): replaces per-page `<h2 className="kk-tc-section-header">`.
 */
import type { ReactNode } from 'react'

interface SectionHeaderProps {
  children: ReactNode
  level?: 'h2' | 'h3'
}

export function SectionHeader({ children, level: Tag = 'h2' }: SectionHeaderProps) {
  return <Tag className="kk-tc-section-header">{children}</Tag>
}
