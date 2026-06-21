import type { MouseEventHandler } from 'react'
import { Link } from 'react-router-dom'
import { COPY } from '../../copy'
import type { BrewLogEntry } from '../../types/entities'
import { eligibilityBadgeTone } from '../../utils/eligibility'
import { Chip } from './Chip'
import { RoastChip } from './RoastChip'
import { Section } from './Section'
import { ShotRow } from './ShotRow'
import { TitleBlock } from './TitleBlock'
import { TitleIcon } from './TitleIcon'

export type ShotCardVariant = 'row' | 'list-card' | 'detail-header'

interface ShotCardProps {
  shot: BrewLogEntry
  variant: ShotCardVariant
  href?: string
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

export function ShotCard({
  shot,
  variant,
  href,
  onMouseEnter,
  className = '',
  'data-testid': testId,
}: ShotCardProps) {
  const destination = href ?? `/brew-log/${encodeURIComponent(shot.shot_id)}`

  if (variant === 'row') {
    return (
      <ShotRow
        href={destination}
        bagName={shot.bag_display}
        date={shot.date}
        doseYield={doseYield(shot)}
        className={className}
        data-testid={testId}
      />
    )
  }

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
    <Link
      to={destination}
      onMouseEnter={onMouseEnter}
      data-testid={testId}
      className={['shot-card-list', 'kaapi-motion-card', className].filter(Boolean).join(' ')}
    >
      <div className="shot-card-list__header">
        <div className="shot-card-list__identity">
          <p className="shot-card-list__eyebrow">{shot.date}</p>
          <p className="shot-card-list__title">{shot.bag_display}</p>
        </div>
        {shot.shot_eligibility ? (
          <Chip variant={eligibilityBadgeTone(shot.shot_eligibility)}>{shot.shot_eligibility}</Chip>
        ) : null}
      </div>

      <div className="shot-card-list__chips">
        {doseYield(shot) ? <span className="shot-card-list__chip shot-card-list__chip--mono">{doseYield(shot)}</span> : null}
        {shot.time_sec != null ? <span className="shot-card-list__chip">{shot.time_sec}s</span> : null}
        {shot.grind_setting ? <span className="shot-card-list__chip">{COPY.brewLogList.grind} {shot.grind_setting}</span> : null}
      </div>

      {(shot.machine_name || shot.grinder_name || shot.basket_name) ? (
        <div className="shot-card-list__hardware">
          {shot.machine_name ? <span>{COPY.brewLogList.machine} {shot.machine_name}</span> : null}
          {shot.grinder_name ? <span>{COPY.brewLogList.grinder} {shot.grinder_name}</span> : null}
          {shot.basket_name ? <span>{COPY.brewLogList.basket} {shot.basket_name}</span> : null}
        </div>
      ) : null}
    </Link>
  )
}
