/**
 * TitleIcon — 64×64 bean/item image with a fallback placeholder.
 *
 * Principle 6 (Typography Hierarchy): the icon is always left-aligned in the
 * title-section flex row, complementing the title stack on the right.
 * Principle 12 (No One-Offs): replaces per-page image/placeholder divs with
 * a unified component that handles src presence, error fallback, and overlays.
 */
import type { ReactNode } from 'react'

interface TitleIconProps {
  /** Image URL — if falsy the placeholder renders. */
  src?: string | null
  alt?: string
  /** Single uppercase letter shown in the placeholder tile instead of ☕. */
  monogram?: string
  /** Content shown when src is absent and no monogram. Defaults to ☕. */
  fallback?: ReactNode
  /** Optional overlay children (e.g. Replace button in edit mode). */
  children?: ReactNode
  /** Callback on image load error so callers can track broken URLs. */
  onError?: () => void
  'data-testid'?: string
}

export function TitleIcon({
  src,
  alt = '',
  monogram,
  fallback,
  children,
  onError,
  'data-testid': testId,
}: TitleIconProps) {
  return (
    <div className="relative shrink-0">
      {src ? (
        <img
          src={src}
          alt={alt}
          className="kk-tc-title-icon"
          onError={onError}
        />
      ) : (
        <div
          data-testid={testId ?? 'catalog-image-placeholder'}
          className="kk-tc-title-icon-placeholder"
        >
          {monogram ? (
            <span className="kk-tc-title-icon-monogram">{monogram}</span>
          ) : (
            fallback ?? <span aria-hidden="true">☕</span>
          )}
        </div>
      )}
      {children}
    </div>
  )
}
