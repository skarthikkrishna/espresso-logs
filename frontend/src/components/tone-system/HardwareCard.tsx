import type { HardwareItem } from '../../types/entities'
import { formatIsoDate } from '../../utils/dates'
import { Chip } from './Chip'
import { EntityButtonCard, type CompactCardChip } from './EntityCard'

interface HardwareCardProps {
  item: HardwareItem
  onSelect: (item: HardwareItem) => void
  onPress?: (element: HTMLElement) => void
  className?: string
  'data-testid'?: string
}

export function HardwareCard({
  item,
  onSelect,
  onPress,
  className = '',
  'data-testid': testId,
}: HardwareCardProps) {
  const purchaseDate = formatIsoDate(item.purchase_date)
  const compactChips: CompactCardChip[] = [
    { key: 'category', node: <Chip data-testid="hardware-category-chip">{item.category}</Chip> },
  ]
  const handleSelect = (element: HTMLElement) => {
    onPress?.(element)
    onSelect(item)
  }

  return (
    <EntityButtonCard
      data-testid={testId}
      data-entity-id={item.hardware_id}
      data-hardware-id={item.hardware_id}
      title={item.name}
      eyebrow={item.maker ?? undefined}
      imageUrl={item.image_path ?? undefined}
      date={purchaseDate ? <time dateTime={item.purchase_date ?? undefined}>{purchaseDate}</time> : undefined}
      compactChips={compactChips}
      className={['hardware-card', className].filter(Boolean).join(' ')}
      onClick={(event) => handleSelect(event.currentTarget)}
    />
  )
}
