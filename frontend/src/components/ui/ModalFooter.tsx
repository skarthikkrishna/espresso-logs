import type { ReactNode } from 'react'
import Button from './Button'

export type ModalFooterActionVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'

export interface ModalFooterAction {
  label: string
  onClick?: () => void
  type?: 'button' | 'submit'
  variant?: ModalFooterActionVariant
  loading?: boolean
  loadingText?: string
  disabled?: boolean
}

interface ModalFooterProps {
  /** Confirming action — full-width on mobile, right-most on desktop. Defaults to the `primary` variant. */
  primary?: ModalFooterAction
  /** Dismiss / cancel action. Defaults to the `ghost` variant. */
  secondary?: ModalFooterAction
  /** Optional destructive action. Defaults to the `danger` variant; pushed left on desktop. */
  destructive?: ModalFooterAction
  /** Inline status / validation message rendered above the actions (e.g. a save error). */
  status?: ReactNode
}

function ActionButton({
  action,
  fallback,
  className = '',
}: {
  action: ModalFooterAction
  fallback: ModalFooterActionVariant
  className?: string
}) {
  return (
    <Button
      type={action.type ?? 'button'}
      variant={action.variant ?? fallback}
      onClick={action.onClick}
      loading={action.loading}
      loadingText={action.loadingText}
      disabled={action.disabled}
      className={className}
    >
      {action.label}
    </Button>
  )
}

/**
 * spec-043 T007 — shared modal-footer pattern.
 *
 * The single footer treatment the four modals (AddBean / AddHardware / EditHardware /
 * LogMaintenance) adopt in Wave 2 (T018). Per design-language §Surface contract and the
 * Modal/dialog row of the component table, modal body and footer content sit on the
 * SOLID LIGHT content surface — only the backdrop/shell may blur. Actions are always
 * <Button> variants (never raw DaisyUI footer buttons), so every footer shares one
 * bevel/shape contract. Mobile-first: actions stack with a full-width primary on top;
 * at ≥640px they collapse to a right-aligned row (destructive pushed left). Default
 * Button size keeps every action ≥44×44 — the legacy `btn-sm` footers did not.
 */
export default function ModalFooter({ primary, secondary, destructive, status }: ModalFooterProps) {
  return (
    <div className="kaapi-modal-footer" data-testid="modal-footer">
      {status ? <div className="kaapi-modal-footer__status">{status}</div> : null}
      <div className="kaapi-modal-footer__actions">
        {destructive ? (
          <ActionButton action={destructive} fallback="danger" className="kaapi-modal-footer__destructive" />
        ) : null}
        {secondary ? <ActionButton action={secondary} fallback="ghost" /> : null}
        {primary ? <ActionButton action={primary} fallback="primary" /> : null}
      </div>
    </div>
  )
}
