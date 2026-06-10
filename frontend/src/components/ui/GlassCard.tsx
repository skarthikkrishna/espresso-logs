import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'

type CardPadding = 'none' | 'sm' | 'md' | 'lg'

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: CardPadding
  interactive?: boolean
  children: ReactNode
}

const paddingClasses: Record<CardPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4 md:p-5',
  lg: 'p-5 md:p-6',
}

const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(({
  padding = 'md',
  interactive = false,
  className = '',
  children,
  ...props
}, ref) => {
  const classes = [
    'glass-card card-bevel',
    paddingClasses[padding],
    interactive ? 'cursor-pointer hover:border-amber-500/40 transition-colors' : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <div ref={ref} className={classes} {...props}>
      {children}
    </div>
  )
})

GlassCard.displayName = 'GlassCard'

export default GlassCard
