import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { DashboardBag, InventoryBag } from '../../types/entities'
import { RoastChip } from './RoastChip'

export type BagCardVariant = 'card' | 'row' | 'reference'

type BagLike = InventoryBag | DashboardBag

interface BagCardProps {
  bag: BagLike
  variant: BagCardVariant
  action?: ReactNode
  href?: string
  className?: string
  'data-testid'?: string
}

function isDashboardBag(bag: BagLike): bag is DashboardBag {
  return 'last_shot' in bag || 'days_since_last_shot' in bag
}

function formatBagMeta(bag: BagLike): ReactNode | undefined {
  if (!isDashboardBag(bag)) return undefined
  const parts: string[] = []
  if (bag.days_since_last_shot != null) {
    parts.push(bag.days_since_last_shot === 0 ? 'Today' : `${bag.days_since_last_shot}d ago`)
  }
  if (bag.last_shot?.dose_in_g != null && bag.last_shot?.yield_out_g != null) {
    parts.push(`${bag.last_shot.dose_in_g}g → ${bag.last_shot.yield_out_g}g`)
  }
  return parts.length ? <span>{parts.join(' · ')}</span> : undefined
}

function getBagMonogram(displayName: string): string {
  return displayName
    .replace(/[\u2013\u2014]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('')
}

export function BagCard({
  bag,
  variant,
  action,
  href,
  className = '',
  'data-testid': testId,
}: BagCardProps) {
  const destination = href ?? (variant === 'row'
    ? `/inventory/${encodeURIComponent(bag.bag_id)}`
    : `/brew-log/add?bag_id=${encodeURIComponent(bag.bag_id)}`)

  if (variant === 'card') {
    const meta = formatBagMeta(bag)

    return (
      <Link
        to={destination}
        className={['bag-card-compact', 'kaapi-motion-card', className].filter(Boolean).join(' ')}
        data-testid={testId}
      >
        <div className="bag-card-compact__body">
          <p className="bag-card-compact__eyebrow">Ready to brew</p>
          <p className="bag-card-compact__title" title={bag.display_name}>
            {bag.display_name}
          </p>
          <div className="bag-card-compact__details">
            {bag.roast_level ? (
              <div className="bag-card-compact__chip-line">
                <RoastChip level={bag.roast_level} />
              </div>
            ) : null}
            {meta ? <span className="bag-card-compact__meta">{meta}</span> : null}
          </div>
        </div>
        <div className="bag-card-compact__monogram" aria-hidden="true">
          {getBagMonogram(bag.display_name)}
        </div>
      </Link>
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
          {'status' in bag ? <span data-testid="bag-status" className="bag-card-row__status">{bag.status}</span> : null}
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
