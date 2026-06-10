import type { ReactNode } from 'react'

interface SectionHeadingProps {
  title: string
  actions?: ReactNode
}

export default function SectionHeading({ title, actions }: SectionHeadingProps) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-lg font-display text-amber-200">{title}</h2>
      {actions}
    </div>
  )
}
