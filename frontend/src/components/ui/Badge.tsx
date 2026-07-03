import type { HTMLAttributes, ReactNode } from 'react'

type BadgeTone = 'brand' | 'neutral' | 'info' | 'success' | 'warning' | 'danger'
type BadgeEmphasis = 'soft' | 'solid'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
  emphasis?: BadgeEmphasis
  icon?: ReactNode
  children: ReactNode
}

/**
 * spec-043 T004 — restrained semantic Badge.
 *
 * `brand` + `soft` is the default and reproduces the original amber chip exactly,
 * so existing usages are unchanged. Other tones are sparse semantic accents
 * (restrained cool/status colour; amber stays the brand anchor). Method/identity
 * differentiation should lead with label/icon/structure — colour is the last cue,
 * which is why an optional `icon` slot sits before the label.
 */
const baseClasses =
  'inline-flex items-center gap-1.5 rounded-[var(--bevel-radius)] border px-2.5 py-1 text-xs font-medium uppercase tracking-[0.14em]'

const softToneClasses: Record<BadgeTone, string> = {
  brand: 'border-amber-400/25 bg-amber-500/10 text-amber-100',
  neutral: 'border-white/15 bg-white/5 text-stone-200',
  info: 'border-cyan-300/25 bg-cyan-400/10 text-cyan-100',
  success: 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100',
  warning: 'border-amber-300/30 bg-amber-400/10 text-amber-100',
  danger: 'border-rose-300/25 bg-rose-400/10 text-rose-100',
}

const solidToneClasses: Record<BadgeTone, string> = {
  brand: 'border-transparent bg-amber-700 text-white',
  neutral: 'border-transparent bg-stone-700 text-white',
  info: 'border-transparent bg-cyan-800 text-white',
  success: 'border-transparent bg-emerald-700 text-white',
  warning: 'border-transparent bg-amber-600 text-stone-950',
  danger: 'border-transparent bg-rose-700 text-white',
}

export default function Badge({
  tone = 'brand',
  emphasis = 'soft',
  icon,
  children,
  className = '',
  ...props
}: BadgeProps) {
  const toneClasses = emphasis === 'solid' ? solidToneClasses[tone] : softToneClasses[tone]

  return (
    <span className={`${baseClasses} ${toneClasses} ${className}`} {...props}>
      {icon != null && <span aria-hidden="true" className="inline-flex">{icon}</span>}
      {children}
    </span>
  )
}
