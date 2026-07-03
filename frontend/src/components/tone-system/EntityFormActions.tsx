import type { ReactNode } from 'react'
import { ToneButton } from './ToneButton'

export interface EntityFormActionsProps {
  primaryLabel: string
  primaryType?: 'submit' | 'button'
  onPrimary?: () => void
  secondaryLabel?: string
  onSecondary?: () => void
  destructiveLabel?: string
  onDestructive?: () => void
  isSubmitting?: boolean
  isDirty?: boolean
  disabled?: boolean
  statusMessage?: ReactNode
  errorMessage?: ReactNode
  className?: string
}

function fallbackStatus({
  disabled,
  isDirty,
  isSubmitting,
}: Pick<EntityFormActionsProps, 'disabled' | 'isDirty' | 'isSubmitting'>): string | undefined {
  if (isSubmitting) return 'Saving…'
  if (disabled) return undefined
  if (isDirty) return 'Unsaved changes.'
  return undefined
}

export function EntityFormActions({
  primaryLabel,
  primaryType = 'submit',
  onPrimary,
  secondaryLabel,
  onSecondary,
  destructiveLabel,
  onDestructive,
  isSubmitting = false,
  isDirty = false,
  disabled = false,
  statusMessage,
  errorMessage,
  className = '',
}: EntityFormActionsProps) {
  const actionsDisabled = disabled || isSubmitting
  const liveStatus = statusMessage ?? fallbackStatus({ disabled, isDirty, isSubmitting })

  return (
    <div
      className={['entity-form-actions', className].filter(Boolean).join(' ')}
      aria-busy={isSubmitting || undefined}
      data-dirty={isDirty ? 'true' : 'false'}
      data-submitting={isSubmitting ? 'true' : 'false'}
      data-disabled={actionsDisabled ? 'true' : 'false'}
    >
      {liveStatus ? (
        <p className="entity-form-actions__status" role="status" aria-live="polite">
          {liveStatus}
        </p>
      ) : null}
      {errorMessage ? (
        <p className="entity-form-actions__error" role="alert" aria-live="assertive">
          {errorMessage}
        </p>
      ) : null}

      <div className="entity-form-actions__buttons">
        <ToneButton
          variant="primary"
          type={primaryType}
          onClick={onPrimary}
          disabled={actionsDisabled}
          className="entity-form-actions__button"
        >
          {isSubmitting ? `Saving ${primaryLabel}` : primaryLabel}
        </ToneButton>

        {secondaryLabel ? (
          <ToneButton
            variant="edit"
            onClick={onSecondary}
            disabled={actionsDisabled}
            className="entity-form-actions__button"
          >
            {secondaryLabel}
          </ToneButton>
        ) : null}

        {destructiveLabel ? (
          <ToneButton
            variant="danger"
            onClick={onDestructive}
            disabled={actionsDisabled}
            className="entity-form-actions__button"
          >
            {destructiveLabel}
          </ToneButton>
        ) : null}
      </div>
    </div>
  )
}
