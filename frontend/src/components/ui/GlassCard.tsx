import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'

type CardPadding = 'none' | 'sm' | 'md' | 'lg'
type CardVariant = 'glass' | 'content'

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: CardPadding
  variant?: CardVariant
  interactive?: boolean
  children: ReactNode
}

const paddingClasses: Record<CardPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4 md:p-5',
  lg: 'p-5 md:p-6',
}

const variantClasses: Record<CardVariant, string> = {
  glass: '',
  content: 'glass-card--content',
}

const interactiveClasses: Record<CardVariant, string> = {
  glass: 'cursor-pointer hover:border-amber-500/40 transition-colors',
  content: 'cursor-pointer hover:border-amber-600/40 transition-colors',
}

const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(({
  padding = 'md',
  variant = 'glass',
  interactive = false,
  className = '',
  children,
  ...props
}, ref) => {
  const classes = [
    'glass-card card-bevel',
    variantClasses[variant],
    paddingClasses[padding],
    interactive ? interactiveClasses[variant] : '',
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
