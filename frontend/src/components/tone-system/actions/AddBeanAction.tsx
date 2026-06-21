import { forwardRef } from 'react'
import { COPY } from '../../../copy'
import { ImmersiveFab } from '../ImmersiveFab'
import { ToneButton } from '../ToneButton'

export type AddBeanActionVariant = 'fab' | 'empty'

interface AddBeanActionProps {
  variant: AddBeanActionVariant
  onAdd: () => void
  className?: string
  onMouseDown?: () => void
  'data-testid'?: string
}

const plusIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
)

export const AddBeanAction = forwardRef<HTMLButtonElement, AddBeanActionProps>(
  ({ variant, onAdd, className = '', onMouseDown, 'data-testid': testId }, ref) => {
    if (variant === 'fab') {
      return (
        <ImmersiveFab
          ref={ref}
          data-testid={testId}
          className={className}
          label={COPY.catalog.addCoffee}
          onClick={onAdd}
          onMouseDown={onMouseDown}
          icon={plusIcon}
        />
      )
    }

    return (
      <ToneButton variant="primary" className={className} data-testid={testId} onClick={onAdd}>
        {COPY.catalog.addCoffee}
      </ToneButton>
    )
  },
)

AddBeanAction.displayName = 'AddBeanAction'
