import { useNavigate } from 'react-router-dom'
import { COPY } from '../../../copy'
import { ToneButton } from '../ToneButton'

export type AddBagActionVariant = 'hero' | 'empty'

interface AddBagActionProps {
  variant: AddBagActionVariant
  catalogId?: string
  onAdd?: () => void
  className?: string
  'data-testid'?: string
}

export function AddBagAction({ variant, catalogId, onAdd, className = '', 'data-testid': testId }: AddBagActionProps) {
  const navigate = useNavigate()
  const handleClick = () => {
    if (catalogId && onAdd) {
      onAdd()
      return
    }
    navigate('/catalog')
  }

  return (
    <ToneButton variant="primary" className={className} data-testid={testId} onClick={handleClick}>
      {variant === 'empty' && !catalogId ? COPY.dashboard.addFirstBag : COPY.catalog.addBag}
    </ToneButton>
  )
}
