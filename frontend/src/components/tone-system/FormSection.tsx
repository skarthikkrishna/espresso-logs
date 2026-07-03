/**
 * FormSection — grouped form fields within a tone context.
 *
 * Principle 2 (Single Surface): form fields sit directly on the glass —
 * no inset well, no nested card, just vertical spacing.
 * Principle 12 (No One-Offs): replaces per-page `<div className="space-y-3">`.
 */
import type { ReactNode } from 'react'

interface FormSectionProps {
  children: ReactNode
  className?: string
}

export function FormSection({ children, className = '' }: FormSectionProps) {
  return (
    <div className={['space-y-3', className].filter(Boolean).join(' ')}>
      {children}
    </div>
  )
}
