/**
 * EntityCard — reusable solid operational card for list items.
 *
 * Principle 1 (Dual-Tone Surface): glass tokens resolve via [data-tone]
 * on the enclosing ImmersiveListShell; no hardcoded colours.
 * Principle 3 (Surface Discipline): repeated cards are opaque; blur stays
 * with app chrome/backdrops, never content cards.
 * Principle 7 (Chip System): chip slot accepts <RoastChip> with canonical
 * casing; no forced uppercase applied here.
 * Principle 8 (INTENSIFY states): hover → brightness(1.05) + shadow lift;
 * active → scale(0.98). No colour-flip.
 * Principle 10 (Responsive/Accessibility): single <a> element for card
 * semantics; visible focus ring; respects prefers-reduced-motion.
 * Principle 12 (No One-Offs): reusable for Hardware list, Home page cards.
 *
 * No-image fallback: a transparent media slot (entity-card-monogram-fill)
 * with a compact display-font monogram — the figure background is transparent
 * so the card surface reads as one continuous surface; the monogram letter
 * (--kk-tc-text-primary) is AA-legible on both tones.
 *
 * Text-first layout (Aria Item 4): compact EntityCard consumers place the
 * media slot top-right beside the roaster eyebrow; bean name/date/chips remain
 * the left-side data hierarchy and media never drifts to the card bottom.
 *
 * GSAP stagger: motionClassName defaults to "kaapi-motion-card" so the
 * staggerCards() hook targets this element without extra config.
 */
import type { MouseEventHandler, ReactNode } from 'react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

export type EntityCardMediaMode = 'image' | 'monogram'

export interface EntityCardProps {
  /** Navigation target (rendered as <a> for semantic card linking) */
  href: string
  /** Primary text — bean name */
  title: string
  /** Full label for media alt text / monogram derivation when title is shortened. */
  mediaTitle?: string
  /** Secondary eyebrow text — roaster name */
  eyebrow?: string
  /** Figure image URL; falls back to TitleIcon monogram when absent */
  imageUrl?: string
  /** Media mode: image keeps catalog/brew-log photos; monogram forces initials for compact Home rails. */
  media?: EntityCardMediaMode
  /** Chip slot — e.g. <RoastChip level="Medium" /> */
  chip?: ReactNode
  /** Date/meta line rendered in the canonical slot directly below the title. */
  date?: ReactNode
  /** Badge slot — e.g. count badge for home-page cards */
  badge?: ReactNode
  /** Meta footer slot — secondary info below chip, e.g. days-since + dose→yield. */
  meta?: ReactNode
  className?: string
  onMouseEnter?: MouseEventHandler<HTMLAnchorElement>
  /** CSS class forwarded to the anchor for GSAP stagger targeting.
   *  Defaults to "kaapi-motion-card" to integrate with useKaapiMotion. */
  motionClassName?: string
  'data-testid'?: string
}

interface EntityCardMediaProps {
  title: string
  imageUrl?: string
  media?: EntityCardMediaMode
  badge?: ReactNode
  className?: string
}

function normalizedImageUrl(imageUrl?: string): string | undefined {
  const trimmed = imageUrl?.trim()
  return trimmed ? trimmed : undefined
}

function entityMonogram(title: string): string {
  return title
    .replace(/[\u2013\u2014]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('')
}

export function EntityCardMedia({
  title,
  imageUrl,
  media = 'image',
  badge,
  className = '',
}: EntityCardMediaProps) {
  const normalizedUrl = normalizedImageUrl(imageUrl)
  const [failedSrc, setFailedSrc] = useState<string | undefined>()
  const showImage = media === 'image' && Boolean(normalizedUrl && failedSrc !== normalizedUrl)

  return (
    <div className={['entity-card-figure', className].filter(Boolean).join(' ')}>
      {showImage ? (
        <img
          src={normalizedUrl}
          alt={title}
          className="entity-card-image"
          onError={() => setFailedSrc(normalizedUrl)}
        />
      ) : (
        <div className="entity-card-monogram-fill" aria-hidden="true">
          <span className="entity-card-monogram">{entityMonogram(title)}</span>
        </div>
      )}
      {badge && <div className="entity-card-badge">{badge}</div>}
    </div>
  )
}

export function EntityCard({
  href,
  title,
  mediaTitle,
  eyebrow,
  imageUrl,
  media = 'image',
  chip,
  date,
  badge,
  meta,
  className = '',
  onMouseEnter,
  motionClassName = 'kaapi-motion-card',
  'data-testid': testId,
}: EntityCardProps) {
  return (
    <Link
      to={href}
      data-testid={testId}
      onMouseEnter={onMouseEnter}
      className={['entity-card', motionClassName, className].filter(Boolean).join(' ')}
    >
      {/* Text body — data hierarchy leads (Aria Item 4: name/roast first,
          decoration second). Compact consumers position the shared media slot
          top-right via the canonical EntityCard grid. */}
      <div className="entity-card-body">
        {eyebrow && (
          <p className="entity-card-eyebrow" title={eyebrow}>
            {eyebrow}
          </p>
        )}
        <p className="entity-card-title" title={title}>
          {title}
        </p>
        {date && (
          <div className="entity-card-date">
            {date}
          </div>
        )}
        {chip && (
          <div className="entity-card-chip-slot">
            {chip}
          </div>
        )}
        {meta && (
          <div className="entity-card__meta">
            {meta}
          </div>
        )}
      </div>

      {/* Shared media slot — compact cards pin this top-right for all media types. */}
      <EntityCardMedia title={mediaTitle ?? title} imageUrl={imageUrl} media={media} badge={badge} />
    </Link>
  )
}
