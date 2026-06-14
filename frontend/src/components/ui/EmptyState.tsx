import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="kaapi-content-surface p-8 flex flex-col items-center justify-center gap-3 text-center">
      {icon && <div className="text-[var(--kaapi-content-muted)]">{icon}</div>}
      <p className="text-[var(--kaapi-content-content)] font-medium">{title}</p>
      {description && <p className="text-[var(--kaapi-content-muted)] text-sm">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
