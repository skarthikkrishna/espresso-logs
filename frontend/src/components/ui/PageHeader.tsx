import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  testId?: string
}

export default function PageHeader({ title, subtitle, actions, testId }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between mb-6">
      <div>
        {subtitle && (
          <p className="text-xs uppercase tracking-[0.22em] text-amber-300/60">{subtitle}</p>
        )}
        <h1
          data-testid={testId}
          className="font-display text-3xl md:text-4xl font-bold text-white/80"
        >
          {title}
        </h1>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
