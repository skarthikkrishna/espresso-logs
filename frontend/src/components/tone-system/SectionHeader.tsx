/**
 * SectionHeader — restrained Playfair section heading (h2 or h3).
 *
 * Principle 6 (Typography Hierarchy): section headers carry the display layer;
 * functional labels, chips, metadata, and body text remain Inter.
 * Principle 12 (No One-Offs): replaces per-page `<h2 className="kk-tc-section-header">`.
 */
import type { ReactNode } from 'react'

interface SectionHeaderProps {
  children: ReactNode
  level?: 'h2' | 'h3'
  testId?: string
}

export function SectionHeader({ children, level: Tag = 'h2', testId }: SectionHeaderProps) {
  return <Tag className="kk-tc-section-header" data-testid={testId}>{children}</Tag>
}
