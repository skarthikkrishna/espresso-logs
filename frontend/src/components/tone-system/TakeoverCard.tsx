/**
 * TakeoverCard — the single frosted-glass reading surface.
 *
 * Principle 1 (Dual-Tone Surface): reads tone from ToneContext and applies
 * `.kk-tc--dark` or `.kk-tc--beige` modifier; never mixes tokens.
 * Principle 3 (Intentional Translucence): backdrop-filter is on this element
 * only — no child elements duplicate the blur.
 * Principle 2 (Single Surface): all page content nests inside ONE instance.
 * Principle 9 (Bevel/Scrim): bevel shadow applied via `.kk-takeover-card` CSS.
 */
import type { ReactNode } from 'react'
import { useTone } from '../../contexts/ToneContext'

interface TakeoverCardProps {
  children: ReactNode
  className?: string
}

export function TakeoverCard({ children, className = '' }: TakeoverCardProps) {
  const { tone } = useTone()
  return (
    <div className={['kk-takeover-card', `kk-tc--${tone}`, className].filter(Boolean).join(' ')}>
      {children}
    </div>
  )
}
