/**
 * Section — the kk-tc-section spacing wrapper.
 *
 * Principle 2 (Single Surface): sections are separated by vertical whitespace
 * (--kk-tc-section-gap), never by borders, boxes, or nested cards.
 * Principle 6 (Typography Hierarchy): title block always uses `isTitle` which
 * applies the flex-row layout for the icon + title stack.
 */
import type { ReactNode } from 'react'

interface SectionProps {
  children: ReactNode
  isTitle?: boolean
  className?: string
  'data-testid'?: string
}

export function Section({ children, isTitle, className = '', 'data-testid': testId }: SectionProps) {
  const classes = ['kk-tc-section', isTitle ? 'kk-tc-section--title' : '', className]
    .filter(Boolean)
    .join(' ')
  return (
    <div className={classes} data-testid={testId}>
      {children}
    </div>
  )
}
