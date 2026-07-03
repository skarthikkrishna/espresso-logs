/**
 * TonePageWrapper — shell-A/B/C/D/E outer wrapper with data-tone attribute.
 *
 * Principle 1 (Dual-Tone Surface): sets [data-tone] on the page root so CSS
 * `:has([data-tone])` selectors can transparentify #main-content.
 * Principle 12 (No One-Offs): single reusable wrapper for all Shell pages;
 * replaces per-page `.kk-proto-043.kk-b-page` div pattern.
 *
 * Usage:
 *   <ToneProvider>
 *     <TonePageWrapper ref={routeRef} testId="brew-log-detail">
 *       <div className="kk-b-page__nav">…</div>
 *       <TakeoverCard>…</TakeoverCard>
 *     </TonePageWrapper>
 *   </ToneProvider>
 */
import { forwardRef, type ReactNode } from 'react'
import { useTone } from '../../contexts/ToneContext'

interface TonePageWrapperProps {
  children: ReactNode
  testId?: string
  className?: string
}

export const TonePageWrapper = forwardRef<HTMLDivElement, TonePageWrapperProps>(
  ({ children, testId, className = '' }, ref) => {
    const { tone } = useTone()
    return (
      <div
        ref={ref}
        data-testid={testId}
        data-tone={tone}
        className={className || undefined}
      >
        {children}
      </div>
    )
  },
)

TonePageWrapper.displayName = 'TonePageWrapper'
