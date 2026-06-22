import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { DashboardBag, InventoryBag } from '../../types/entities'
import { MetricChip, StatusChip } from './Chip'
import { EntityCard, type EntityCardMediaMode } from './EntityCard'
import { RoastChip } from './RoastChip'

export type BagCardVariant = 'card' | 'row' | 'reference'

type BagLike = InventoryBag | DashboardBag

interface BagCardProps {
  bag: BagLike
  variant: BagCardVariant
  action?: ReactNode
  href?: string
  media?: EntityCardMediaMode
  className?: string
  'data-testid'?: string
}

function isDashboardBag(bag: BagLike): bag is DashboardBag {
  return 'last_shot' in bag || 'days_since_last_shot' in bag
}

function formatBagDate(bag: BagLike): ReactNode | undefined {
  if (isDashboardBag(bag)) {
    return bag.days_since_last_shot == null
      ? undefined
      : bag.days_since_last_shot === 0 ? 'Today' : `${bag.days_since_last_shot}d ago`
  }
  return bag.roast_date
}

function formatBagMetric(bag: BagLike): ReactNode | undefined {
  if (!isDashboardBag(bag)) return undefined
  const doseYield = bag.last_shot?.dose_in_g != null && bag.last_shot?.yield_out_g != null
    ? `${bag.last_shot.dose_in_g}g → ${bag.last_shot.yield_out_g}g`
    : undefined
  return doseYield ? <MetricChip mono>{doseYield}</MetricChip> : undefined
}

function bagImagePath(bag: BagLike): string | undefined {
  return 'image_path' in bag ? bag.image_path : undefined
}

function splitRoasterBean(displayName: string): { roaster?: string; bean: string } {
  const [roaster, ...beanParts] = displayName.split(/\s+[—–-]\s+/)
  const bean = beanParts.join(' — ').trim()
  return bean ? { roaster: roaster.trim(), bean } : { bean: displayName }
}

export function BagCard({
  bag,
  variant,
  action,
  href,
  media = 'image',
  className = '',
  'data-testid': testId,
}: BagCardProps) {
  const destination = href ?? (variant === 'row'
    ? `/inventory/${encodeURIComponent(bag.bag_id)}`
    : `/brew-log/add?bag_id=${encodeURIComponent(bag.bag_id)}`)

  if (variant === 'card') {
    const date = formatBagDate(bag)
    const metric = formatBagMetric(bag)
    const titleParts = splitRoasterBean(bag.display_name)
    const status = 'status' in bag ? bag.status : undefined
    const chips = (
      <>
        {bag.roast_level ? <RoastChip level={bag.roast_level} /> : null}
        {status ? <StatusChip status={status} /> : null}
        {metric}
      </>
    )

    return (
      <EntityCard
        href={destination}
        title={titleParts.bean}
        mediaTitle={bag.display_name}
        eyebrow={titleParts.roaster ?? 'Ready to brew'}
        imageUrl={bagImagePath(bag)}
        media={media}
        date={date ? <span>{date}</span> : undefined}
        chip={bag.roast_level || status || metric ? chips : undefined}
        className={['bag-card-compact', className].filter(Boolean).join(' ')}
        data-testid={testId}
      />
    )
  }

  if (variant === 'reference') {
    return (
      <Link to={destination} className={['bag-card-reference', className].filter(Boolean).join(' ')} data-testid={testId}>
        {bag.display_name}
      </Link>
    )
  }

  return (
    <div className={['bag-card-row', 'kaapi-motion-card', className].filter(Boolean).join(' ')} data-testid={testId}>
      <div className="bag-card-row__body">
        <p className="bag-card-row__title">{bag.display_name}</p>
        <div className="bag-card-row__meta">
          {'roast_date' in bag && bag.roast_date ? <span data-testid="bag-roast-date">{bag.roast_date}</span> : null}
          {'status' in bag ? <StatusChip status={bag.status} data-testid="bag-status" /> : null}
        </div>
        {bag.roast_level ? (
          <div className="bag-card-row__chip-line">
            <RoastChip level={bag.roast_level} />
          </div>
        ) : null}
      </div>
      {action ? <div className="bag-card-row__action">{action}</div> : null}
    </div>
  )
}
