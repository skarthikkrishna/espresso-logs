/**
 * EntityCard — reusable glass card for list items.
 *
 * Principle 1 (Dual-Tone Surface): glass tokens resolve via [data-tone]
 * on the enclosing ImmersiveListShell; no hardcoded colours.
 * Principle 3 (Intentional Translucence): backdrop-filter scoped to THIS
 * element only — no child elements repeat the blur.
 * Principle 7 (Chip System): chip slot accepts <RoastChip> with canonical
 * casing; no forced uppercase applied here.
 * Principle 8 (INTENSIFY states): hover → brightness(1.05) + shadow lift;
 * active → scale(0.98). No colour-flip.
 * Principle 10 (Responsive/Accessibility): single <a> element for card
 * semantics; visible focus ring; respects prefers-reduced-motion.
 * Principle 12 (No One-Offs): reusable for Hardware list, Home page cards.
 *
 * No-image fallback: a full-figure transparent fill (entity-card-monogram-fill)
 * with a large centred display-font monogram letter — the figure background is
 * transparent so the card glass surface reads as one continuous surface; the
 * monogram letter (--kk-tc-text-primary) is AA-legible on both tones.
 *
 * GSAP stagger: motionClassName defaults to "kaapi-motion-card" so the
 * staggerCards() hook targets this element without extra config.
 */
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export interface EntityCardProps {
  /** Navigation target (rendered as <a> for semantic card linking) */
  href: string
  /** Primary text — bean name */
  title: string
  /** Secondary eyebrow text — roaster name */
  eyebrow?: string
  /** Figure image URL; falls back to TitleIcon monogram when absent */
  imageUrl?: string
  /** Chip slot — e.g. <RoastChip level="Medium" /> */
  chip?: ReactNode
  /** Badge slot — e.g. count badge for home-page cards */
  badge?: ReactNode
  className?: string
  /** CSS class forwarded to the anchor for GSAP stagger targeting.
   *  Defaults to "kaapi-motion-card" to integrate with useKaapiMotion. */
  motionClassName?: string
  'data-testid'?: string
}

export function EntityCard({
  href,
  title,
  eyebrow,
  imageUrl,
  chip,
  badge,
  className = '',
  motionClassName = 'kaapi-motion-card',
  'data-testid': testId,
}: EntityCardProps) {
  const monogram = (eyebrow ?? title).slice(0, 2).toUpperCase()

  return (
    <Link
      to={href}
      data-testid={testId}
      className={['entity-card', motionClassName, className].filter(Boolean).join(' ')}
    >
      {/* Figure — image or full-figure monogram fill */}
      <div className="entity-card-figure">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="entity-card-image"
          />
        ) : (
          <div className="entity-card-monogram-fill" aria-hidden="true">
            <span className="entity-card-monogram">{monogram}</span>
          </div>
        )}
        {badge && <div className="entity-card-badge">{badge}</div>}
      </div>

      {/* Text body */}
      <div className="entity-card-body">
        {eyebrow && (
          <p className="entity-card-eyebrow" title={eyebrow}>
            {eyebrow}
          </p>
        )}
        <p className="entity-card-title" title={title}>
          {title}
        </p>
        {chip && (
          <div className="entity-card-chip-slot">
            {chip}
          </div>
        )}
      </div>
    </Link>
  )
}
