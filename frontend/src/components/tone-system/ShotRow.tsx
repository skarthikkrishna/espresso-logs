/**
 * ShotRow — compact glass row for recent-shot summaries.
 *
 * Principle 1 (Dual-Tone Surface): background/border/text resolve via
 * --kk-tc-* tokens from the enclosing [data-tone] element.
 * Principle 2 (Single Surface): lighter glass treatment than EntityCard —
 * single-line density. No nested blur.
 * Principle 8 (INTENSIFY states): hover translateY(-1px) + shadow. No colour
 * inversion.
 * Principle 10 (Responsive/Accessibility): rendered as <a> for semantic
 * link; focus ring; prefers-reduced-motion respected in CSS.
 * Principle 12 (No One-Offs): reusable for Dashboard recent-shots list and
 * any future surface that renders a compact shot summary row.
 *
 * GSAP stagger: the `.kaapi-motion-card` class is applied by default so
 * staggerCards() targets this element without extra config.
 *
 * Skeleton variant: import { ShotRowSkeleton } for the loading state.
 */
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export interface ShotRowProps {
  /** Navigation target. */
  href: string
  /** Coffee bag display name. */
  bagName: string
  /** Formatted date string. */
  date: string
  /** Optional dose→yield string — e.g. "18g → 36g". Omit to hide chip. */
  doseYield?: string
  className?: string
  'data-testid'?: string
}

export function ShotRow({
  href,
  bagName,
  date,
  doseYield,
  className = '',
  'data-testid': testId,
}: ShotRowProps) {
  return (
    <Link
      to={href}
      data-testid={testId}
      className={['shot-row', 'kaapi-motion-card', className].filter(Boolean).join(' ')}
    >
      <span className="shot-row__bag">{bagName}</span>
      <span className="shot-row__date">{date}</span>
      {doseYield && (
        <span className="shot-row__chip">{doseYield}</span>
      )}
      <svg
        className="shot-row__arrow"
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </Link>
  )
}

export function ShotRowSkeleton({ className = '' }: { className?: string }): ReactNode {
  return (
    <div
      className={['shot-row', 'shot-row--skeleton', className].filter(Boolean).join(' ')}
      aria-hidden="true"
    >
      <span className="shot-row__skeleton-bag" />
      <span className="shot-row__skeleton-date" />
      <span className="shot-row__skeleton-chip" />
    </div>
  )
}
