import type { ReactNode } from 'react'

interface SectionHeadingProps {
  title: string
  actions?: ReactNode
  testId?: string
  className?: string
}

export default function SectionHeading({ title, actions, testId, className = '' }: SectionHeadingProps) {
  return (
    <div data-testid={testId} className={`mb-3 flex items-center justify-between gap-3 ${className}`}>
      <h2 className="flex items-center gap-3 font-display text-sm font-semibold uppercase tracking-[0.22em] text-amber-100">
        <span aria-hidden="true" className="h-[var(--kaapi-section-accent-height)] w-[var(--kaapi-section-accent-width)] rounded-full bg-[var(--color-accent)] shadow-[var(--kaapi-glow-amber)]" />
        {title}
      </h2>
      {actions}
    </div>
  )
}
