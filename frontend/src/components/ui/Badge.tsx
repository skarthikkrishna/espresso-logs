import type { HTMLAttributes, ReactNode } from 'react'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode
}

export default function Badge({ children, className = '', ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-[var(--bevel-radius)] border border-amber-400/25 bg-amber-500/10 px-2.5 py-1 text-xs font-medium uppercase tracking-[0.14em] text-amber-100 ${className}`}
      {...props}
    >
      {children}
    </span>
  )
}
