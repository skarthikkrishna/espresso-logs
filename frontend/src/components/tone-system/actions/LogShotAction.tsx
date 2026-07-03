import { forwardRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { LOCKED_LABELS } from '../../../copy/registry'
import { ImmersiveFab } from '../ImmersiveFab'
import { ToneButton } from '../ToneButton'

export type LogShotActionVariant = 'hero' | 'fab' | 'empty'

interface LogShotActionProps {
  variant: LogShotActionVariant
  bagId?: string
  className?: string
  onMouseDown?: () => void
  'data-testid'?: string
}

const plusIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
)

export const LogShotAction = forwardRef<HTMLButtonElement, LogShotActionProps>(
  ({ variant, bagId, className = '', onMouseDown, 'data-testid': testId }, ref) => {
    const navigate = useNavigate()
    const destination = bagId ? `/brew-log/add?bag_id=${encodeURIComponent(bagId)}` : '/brew-log/add'
    const onClick = () => navigate(destination)

    if (variant === 'fab') {
      return (
        <ImmersiveFab
          ref={ref}
          data-testid={testId}
          className={className}
          label={LOCKED_LABELS.logAShot}
          onClick={onClick}
          onMouseDown={onMouseDown}
          icon={plusIcon}
        />
      )
    }

    return (
      <ToneButton variant="primary" className={className} data-testid={testId} onClick={onClick}>
        {LOCKED_LABELS.logAShot}
      </ToneButton>
    )
  },
)

LogShotAction.displayName = 'LogShotAction'
