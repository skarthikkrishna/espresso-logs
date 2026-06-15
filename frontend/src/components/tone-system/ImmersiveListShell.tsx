/**
 * ImmersiveListShell — card-less immersive page shell for list pages.
 *
 * Principle 1 (Dual-Tone Surface): reads tone from ToneProvider and sets
 * [data-tone] so CSS `#main-content:has(.immersive-list-shell[data-tone])` can
 * apply the full-area frost (24px blur + tone tint) without a fixed overlay.
 * This mirrors the detail-page anti-double-frost approach in reverse: instead
 * of removing #main-content's blur (detail), we make #main-content the frost
 * layer itself (list), so the catalog photo blurs through the content panel.
 * Principle 2 (Single Surface): NO page-level wrapper card — content floats
 * directly on the frost; only EntityCards are glass surfaces.
 * Principle 3 (Intentional Translucence): blur is confined to #main-content
 * when this shell is present; child elements do NOT duplicate the blur.
 * Principle 5 (AA Legibility): `@supports`/`prefers-reduced-transparency`
 * fallbacks are in CSS so solid color is always available.
 * Principle 12 (No One-Offs): single reusable shell for all list pages.
 */
import { forwardRef, type ReactNode } from 'react'
import { TonePageWrapper } from './TonePageWrapper'

interface ImmersiveListShellProps {
  children: ReactNode
  className?: string
  /** Forwarded to the outer wrapper as data-testid (matches TonePageWrapper API). */
  testId?: string
}

export const ImmersiveListShell = forwardRef<HTMLDivElement, ImmersiveListShellProps>(
  ({ children, className = '', testId }, ref) => (
    <TonePageWrapper
      ref={ref}
      testId={testId}
      className={['immersive-list-shell', className].filter(Boolean).join(' ')}
    >
      <div className="immersive-list-content">
        {children}
      </div>
    </TonePageWrapper>
  ),
)

ImmersiveListShell.displayName = 'ImmersiveListShell'
