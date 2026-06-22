import type { MouseEventHandler } from 'react'
import { COPY } from '../../copy'
import type { BrewLogEntry } from '../../types/entities'
import { eligibilityBadgeTone } from '../../utils/eligibility'
import { Chip, MetricChip } from './Chip'
import { EntityCard, type EntityCardMediaMode } from './EntityCard'
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

function doseYield(shot: BrewLogEntry): string | undefined {
  return shot.dose_in_g != null && shot.yield_out_g != null
    ? `${shot.dose_in_g}g → ${shot.yield_out_g}g`
    : undefined
}

function beanMonogram(bagDisplay: string): string | undefined {
  const parts = bagDisplay.split(' — ')
  const beanName = parts.length > 1 ? parts[1] : parts[0]
  return beanName?.charAt(0)?.toUpperCase() || undefined
}

function splitRoasterBean(displayName: string): { roaster?: string; bean: string } {
  const [roaster, ...beanParts] = displayName.split(/\s+[—–-]\s+/)
  const bean = beanParts.join(' — ').trim()
  return bean ? { roaster: roaster.trim(), bean } : { bean: displayName }
}

function renderExtractionChips(shot: BrewLogEntry) {
  const shotDoseYield = doseYield(shot)
  return (
    <>
      {shot.shot_eligibility ? (
        <Chip variant={eligibilityBadgeTone(shot.shot_eligibility)}>{shot.shot_eligibility}</Chip>
      ) : null}
      {shotDoseYield ? <MetricChip mono>{shotDoseYield}</MetricChip> : null}
      {shot.time_sec != null ? <MetricChip>{shot.time_sec}s</MetricChip> : null}
      {shot.grind_setting ? <MetricChip>{COPY.brewLogList.grind} {shot.grind_setting}</MetricChip> : null}
    </>
  )
}

export function ShotCard({
  shot,
  variant,
  href,
  media = 'image',
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
          <TitleIcon monogram={beanMonogram(shot.bag_display)} />
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
      chip={renderExtractionChips(shot)}
      className={['shot-card-list', 'shot-card-summary', className].filter(Boolean).join(' ')}
      motionClassName="kaapi-motion-card"
      data-testid={testId}
      onMouseEnter={onMouseEnter}
    />
  )
}
