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
import { useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { COPY } from '../../copy'
import { Chip } from './Chip'
import { getFittingCompactChipCount } from './compactChipOverflow'

export type EntityCardMediaMode = 'image' | 'monogram' | 'none'

export interface CompactCardChip {
  key: string
  node: ReactNode
}

interface CompactChipRowProps {
  chips: CompactCardChip[]
  overflowMode?: 'count' | 'none'
  className?: string
  'data-testid'?: string
}

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
  /** Priority-ordered compact-card chips with canonical one-row overflow. */
  compactChips?: CompactCardChip[]
  /** Home recent shots render their full approved chip set instead of +N overflow. */
  compactChipOverflow?: 'count' | 'none'
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

export interface EntityButtonCardProps {
  title: string
  mediaTitle?: string
  eyebrow?: string
  imageUrl?: string
  media?: EntityCardMediaMode
  compactChips?: CompactCardChip[]
  compactChipOverflow?: 'count' | 'none'
  date?: ReactNode
  badge?: ReactNode
  className?: string
  onClick: MouseEventHandler<HTMLButtonElement>
  onMouseEnter?: MouseEventHandler<HTMLButtonElement>
  'data-testid'?: string
  'data-entity-id'?: string
  'data-hardware-id'?: string
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

function measuredWidth(element: Element | null): number {
  if (!(element instanceof HTMLElement)) return 0
  return element.offsetWidth || element.getBoundingClientRect().width
}

function flexGap(element: HTMLElement): number {
  const styles = window.getComputedStyle(element)
  const value = Number.parseFloat(styles.columnGap || styles.gap)
  return Number.isFinite(value) ? value : 0
}

export function CompactChipRow({ chips, overflowMode = 'count', className = '', 'data-testid': testId }: CompactChipRowProps) {
  const rowRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const moreMeasureRef = useRef<HTMLSpanElement>(null)
  const [visibleCount, setVisibleCount] = useState(chips.length)
  const canMeasure = typeof ResizeObserver !== 'undefined'
  const shouldMeasure = overflowMode === 'count' && canMeasure

  useLayoutEffect(() => {
    if (!shouldMeasure) return

    const updateVisibleCount = () => {
      const row = rowRef.current
      const measure = measureRef.current
      if (!row || !measure) return

      const containerWidth = row.clientWidth || row.getBoundingClientRect().width
      if (containerWidth <= 0) {
        setVisibleCount(chips.length)
        return
      }

      const chipWidths = Array.from(measure.querySelectorAll('[data-compact-chip-measure]'))
        .map((element) => measuredWidth(element))
      const nextVisibleCount = getFittingCompactChipCount(
        chipWidths,
        flexGap(row),
        containerWidth,
        measuredWidth(moreMeasureRef.current),
      )
      setVisibleCount(nextVisibleCount)
    }

    const frame = window.requestAnimationFrame(updateVisibleCount)

    if (!rowRef.current) {
      return () => window.cancelAnimationFrame(frame)
    }

    const observer = new ResizeObserver(updateVisibleCount)
    observer.observe(rowRef.current)
    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [shouldMeasure, chips])

  if (!chips.length) return null

  const visibleCountForRender = shouldMeasure ? visibleCount : chips.length
  const hiddenCount = Math.max(0, chips.length - visibleCountForRender)
  const visibleChips = chips.slice(0, visibleCountForRender)

  return (
    <div className="entity-card-chip-row-wrap">
      <div ref={rowRef} className={['entity-card-chip-slot', className].filter(Boolean).join(' ')} data-testid={testId}>
        {visibleChips.map((chip) => (
          <span key={chip.key} className="entity-card-chip">
            {chip.node}
          </span>
        ))}
        {hiddenCount > 0 ? (
          <Chip data-testid="compact-chip-overflow">+{hiddenCount} {COPY.expander.more}</Chip>
        ) : null}
      </div>
      {shouldMeasure ? (
        <div ref={measureRef} className="entity-card-chip-measure" aria-hidden="true">
          {chips.map((chip) => (
            <span key={chip.key} className="entity-card-chip" data-compact-chip-measure>
              {chip.node}
            </span>
          ))}
          <span ref={moreMeasureRef} className="entity-card-chip">
            <Chip>+{chips.length} {COPY.expander.more}</Chip>
          </span>
        </div>
      ) : null}
    </div>
  )
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
  if (media === 'none') return null

  return (
    <div className={['entity-card-figure', className].filter(Boolean).join(' ')}>
      {showImage ? (
        <img
          src={normalizedUrl}
          alt={title}
          className="entity-card-image"
          onError={() => setFailedSrc(normalizedUrl)}
        />
      ) : media === 'monogram' ? (
        <div className="entity-card-monogram-fill" aria-hidden="true">
          <span className="entity-card-monogram">{entityMonogram(title)}</span>
        </div>
      ) : (
        <div className="entity-card-image-placeholder" aria-hidden="true" />
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
  compactChips,
  compactChipOverflow = 'count',
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
      className={['entity-card', media === 'none' ? 'entity-card--no-media' : '', motionClassName, className].filter(Boolean).join(' ')}
    >
      {media !== 'none' && (
        <EntityCardMedia title={mediaTitle ?? title} imageUrl={imageUrl} media={media} badge={badge} />
      )}
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
        {compactChips?.length ? (
          <CompactChipRow chips={compactChips} overflowMode={compactChipOverflow} />
        ) : chip ? (
          <div className="entity-card-chip-slot">
            {chip}
          </div>
        ) : null}
        {meta && (
          <div className="entity-card__meta">
            {meta}
          </div>
        )}
      </div>
    </Link>
  )
}

export function EntityButtonCard({
  title,
  mediaTitle,
  eyebrow,
  imageUrl,
  media = 'image',
  compactChips,
  compactChipOverflow = 'count',
  date,
  badge,
  className = '',
  onClick,
  onMouseEnter,
  'data-testid': testId,
  'data-entity-id': entityId,
  'data-hardware-id': hardwareId,
}: EntityButtonCardProps) {
  return (
    <button
      type="button"
      data-testid={testId}
      data-entity-id={entityId}
      data-hardware-id={hardwareId}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={['entity-card', 'entity-card--button', 'kaapi-motion-card', className].filter(Boolean).join(' ')}
    >
      {media !== 'none' && (
        <EntityCardMedia title={mediaTitle ?? title} imageUrl={imageUrl} media={media} badge={badge} />
      )}
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
        {compactChips?.length ? (
          <CompactChipRow chips={compactChips} overflowMode={compactChipOverflow} />
        ) : null}
      </div>
    </button>
  )
}
