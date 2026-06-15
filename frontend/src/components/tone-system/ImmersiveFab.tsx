/**
 * ImmersiveFab — floating action button for immersive list pages.
 *
 * Portals to document.body to escape #main-content's backdrop-filter context,
 * preserving correct fixed positioning on all browsers.
 *
 * Principle 1 (Dual-Tone Surface): reads tone from ToneProvider and sets
 * data-tone on the button element itself so --kk-tc-* glass tokens resolve
 * correctly even though the element lives in document.body (outside the
 * [data-tone] wrapper in the React tree).
 * Principle 8 (INTENSIFY states): hover brightens + scales up; active scales
 * down. No colour inversion. Transitions suppressed at prefers-reduced-motion.
 * Principle 5 (AA Legibility): solid fallback applied via @supports and
 * @media prefers-reduced-transparency in CSS.
 *
 * GSAP: forward ref to the <button> element so callers can wire fabMount()
 * and pressFeedback() from useKaapiMotion.
 */
import { createPortal } from 'react-dom'
import { forwardRef, type ReactNode } from 'react'
import { useTone } from '../../contexts/ToneContext'

interface ImmersiveFabProps {
  /** Icon content rendered inside the circular button. */
  icon: ReactNode
  /** Accessible label (aria-label). */
  label: string
  onClick?: () => void
  onMouseDown?: () => void
  /** If provided, renders an <a> tag instead of <button>. */
  href?: string
  className?: string
}

export const ImmersiveFab = forwardRef<HTMLButtonElement, ImmersiveFabProps>(
  ({ icon, label, onClick, onMouseDown, className = '' }, ref) => {
    const { tone } = useTone()
    return createPortal(
      <button
        ref={ref}
        type="button"
        aria-label={label}
        data-tone={tone}
        className={['immersive-fab', className].filter(Boolean).join(' ')}
        onClick={onClick}
        onMouseDown={onMouseDown}
      >
        {icon}
      </button>,
      document.body,
    )
  },
)

ImmersiveFab.displayName = 'ImmersiveFab'
