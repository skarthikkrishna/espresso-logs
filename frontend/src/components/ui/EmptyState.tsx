import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="glass-card card-bevel p-8 flex flex-col items-center justify-center gap-3 text-center">
      {icon && <div className="text-amber-400/40">{icon}</div>}
      <p className="text-amber-200 font-medium">{title}</p>
      {description && <p className="text-amber-400/70 text-sm">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
