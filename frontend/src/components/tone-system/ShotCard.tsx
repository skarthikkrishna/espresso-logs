import type { MouseEventHandler } from 'react'
import type { BrewLogEntry } from '../../types/entities'
import { getBrewRatio, getCompassZoneTaste } from '../../utils/extractionCompass'
import { eligibilityBadgeTone } from '../../utils/eligibility'
import { Chip, ExtractionChip } from './Chip'
import { EntityCard, type CompactCardChip, type EntityCardMediaMode } from './EntityCard'
import { RoastChip } from './RoastChip'
import { Section } from './Section'
import { TitleBlock } from './TitleBlock'
import { TitleIcon } from './TitleIcon'

export type ShotCardVariant = 'summary' | 'row' | 'list-card' | 'detail-header'

interface ShotCardProps {
  shot: BrewLogEntry
  variant: ShotCardVariant
  href?: string
  media?: EntityCardMediaMode
  onMouseEnter?: MouseEventHandler<HTMLAnchorElement>
  className?: string
  'data-testid'?: string
}

function splitRoasterBean(displayName: string): { roaster?: string; bean: string } {
  const [roaster, ...beanParts] = displayName.split(/\s+[—–-]\s+/)
  const bean = beanParts.join(' — ').trim()
  return bean ? { roaster: roaster.trim(), bean } : { bean: displayName }
}

function compactShotChips(shot: BrewLogEntry, variant: ShotCardVariant): CompactCardChip[] {
  const chips: CompactCardChip[] = []
  const isHomeCompact = variant === 'summary'
  const isBrewLogCompact = variant === 'list-card' || variant === 'row'
  const ratio = getBrewRatio(shot.dose_in_g, shot.yield_out_g)
  const zone = ratio != null && shot.time_sec != null
    ? getCompassZoneTaste(shot.dose_in_g, shot.yield_out_g, shot.time_sec)
    : null

  if (shot.shot_eligibility) {
    chips.push({
      key: 'rating',
      node: <Chip variant={eligibilityBadgeTone(shot.shot_eligibility)} data-testid="shot-rating-chip">{shot.shot_eligibility}</Chip>,
    })
  }
  if ((isHomeCompact || isBrewLogCompact) && ratio != null) {
    chips.push({
      key: 'ratio',
      node: <ExtractionChip variant="brand" data-testid="shot-ratio-chip">1:{ratio.toFixed(1)}</ExtractionChip>,
    })
  }
  if ((isHomeCompact || isBrewLogCompact) && shot.time_sec != null) {
    chips.push({
      key: 'time',
      node: <ExtractionChip data-testid="shot-time-chip">{shot.time_sec}s</ExtractionChip>,
    })
  }
  if (isBrewLogCompact && shot.yield_out_g != null) {
    chips.push({
      key: 'yield',
      node: <ExtractionChip variant="brand" data-testid="shot-yield-chip">{shot.yield_out_g}g</ExtractionChip>,
    })
  }
  if (isBrewLogCompact && zone) {
    chips.push({ key: 'zone', node: <Chip data-testid="shot-zone-chip">{zone}</Chip> })
  }
  if (isBrewLogCompact && shot.roast_level) {
    chips.push({ key: 'roast', node: <RoastChip level={shot.roast_level} /> })
  }

  return chips
}

export function ShotCard({
  shot,
  variant,
  href,
  media = 'none',
  onMouseEnter,
  className = '',
  'data-testid': testId,
}: ShotCardProps) {
  const destination = href ?? `/brew-log/${encodeURIComponent(shot.shot_id)}`
  const titleParts = splitRoasterBean(shot.bag_display)

  if (variant === 'detail-header') {
    return (
      <>
        <Section isTitle>
          {shot.image_path ? <TitleIcon src={shot.image_path} alt={shot.bag_display} /> : null}
          <TitleBlock title={shot.bag_display} subtitle={shot.date} />
        </Section>
        <div className={['shot-card-detail-header__chips', className].filter(Boolean).join(' ')} data-testid={testId}>
          <RoastChip level={shot.roast_level} />
          {shot.shot_eligibility ? (
            <Chip variant={eligibilityBadgeTone(shot.shot_eligibility)} data-testid="eligibility-badge">
              {shot.shot_eligibility}
            </Chip>
          ) : null}
        </div>
      </>
    )
  }

  return (
    <EntityCard
      href={destination}
      title={titleParts.bean}
      mediaTitle={shot.bag_display}
      eyebrow={titleParts.roaster ?? 'Shot'}
      imageUrl={shot.image_path}
      media={media}
      date={<time dateTime={shot.date}>{shot.date}</time>}
      compactChips={compactShotChips(shot, variant)}
      compactChipOverflow={variant === 'summary' ? 'none' : 'count'}
      className={['shot-card-list', 'shot-card-summary', className].filter(Boolean).join(' ')}
      motionClassName="kaapi-motion-card"
      data-testid={testId}
      onMouseEnter={onMouseEnter}
    />
  )
}
