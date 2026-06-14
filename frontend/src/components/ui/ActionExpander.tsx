import type { ReactNode } from 'react'
import Button from './Button'
import { COPY } from '../../copy'
import { usePrefersReducedMotion } from '../../lib/motion'

interface ActionExpanderProps {
  expanded: boolean
  onToggle: () => void
  controlsId: string
  showMoreLabel?: string
  showFewerLabel?: string
  variant?: 'ghost' | 'outline' | 'secondary'
  className?: string
  icon?: ReactNode
}

/**
 * spec-043 T005 — shared ActionExpander disclosure trigger.
 *
 * The trigger for a collapsible region (the region itself, identified by
 * `controlsId`, is owned by the consumer). Built from {@link Button}; exposes
 * `aria-expanded` and `aria-controls` so assistive tech announces the disclosure
 * relationship. The chevron rotates to signal state; under `prefers-reduced-motion`
 * the rotation is applied instantly with no transition (reduced-motion final state).
 * Default More/Fewer labels come from the operator copy registry.
 */
function Chevron() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  )
}

export default function ActionExpander({
  expanded,
  onToggle,
  controlsId,
  showMoreLabel = COPY.expander.showMore,
  showFewerLabel = COPY.expander.showFewer,
  variant = 'ghost',
  className = '',
  icon,
}: ActionExpanderProps) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const label = expanded ? showFewerLabel : showMoreLabel

  const chevronMotion = prefersReducedMotion ? '' : 'transition-transform duration-[var(--motion-duration-micro)] ease-[var(--motion-ease-standard)]'
  const chevronRotation = expanded ? 'rotate-180' : 'rotate-0'

  return (
    <Button
      type="button"
      variant={variant}
      onClick={onToggle}
      aria-expanded={expanded}
      aria-controls={controlsId}
      icon={icon}
      className={`min-h-[2.75rem] min-w-[2.75rem] gap-2 ${className}`}
    >
      {label}
      <span aria-hidden="true" className={`inline-flex ${chevronMotion} ${chevronRotation}`}>
        <Chevron />
      </span>
    </Button>
  )
}
