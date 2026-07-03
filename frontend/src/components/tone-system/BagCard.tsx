import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { DashboardBag, InventoryBag } from '../../types/entities'
import { StatusChip } from './Chip'
import { EntityCard, type CompactCardChip, type EntityCardMediaMode } from './EntityCard'
import { RoastChip } from './RoastChip'

export type BagCardVariant = 'card' | 'row' | 'reference'

type BagLike = InventoryBag | DashboardBag

interface BagCardProps {
  bag: BagLike
  variant: BagCardVariant
  action?: ReactNode
  href?: string
  media?: EntityCardMediaMode
  showRoast?: boolean
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

function bagImagePath(bag: BagLike): string | undefined {
  return 'image_path' in bag ? bag.image_path : undefined
}

function compactBagChips(bag: BagLike): CompactCardChip[] {
  const chips: CompactCardChip[] = []
  const status = 'status' in bag ? bag.status : undefined

  if (bag.roast_level) {
    chips.push({ key: 'roast', node: <RoastChip level={bag.roast_level} /> })
  }
  if (status) {
    chips.push({ key: 'status', node: <StatusChip status={status} data-testid="bag-status-chip" /> })
  }

  return chips
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
  media = 'none',
  showRoast = true,
  className = '',
  'data-testid': testId,
}: BagCardProps) {
  const destination = href ?? (variant === 'row'
    ? `/inventory/${encodeURIComponent(bag.bag_id)}`
    : `/brew-log/add?bag_id=${encodeURIComponent(bag.bag_id)}`)

  if (variant === 'card') {
    const date = formatBagDate(bag)
    const titleParts = splitRoasterBean(bag.display_name)
    const chips = compactBagChips(bag)

    return (
      <EntityCard
        href={destination}
        title={titleParts.bean}
        mediaTitle={bag.display_name}
        eyebrow={titleParts.roaster ?? 'Ready to brew'}
        imageUrl={bagImagePath(bag)}
        media={media}
        date={date ? <span>{date}</span> : undefined}
        compactChips={chips}
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
        </div>
        {(showRoast && bag.roast_level) || 'status' in bag ? (
          <div className="bag-card-row__chip-line">
            {showRoast && bag.roast_level ? <RoastChip level={bag.roast_level} /> : null}
            {'status' in bag ? <StatusChip status={bag.status} data-testid="bag-status" /> : null}
          </div>
        ) : null}
      </div>
      {action ? <div className="bag-card-row__action">{action}</div> : null}
    </div>
  )
}
