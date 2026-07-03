/**
 * ImmersiveEmptyState — empty state for the immersive list shell.
 *
 * Principle 2 (Single Surface): no wrapper card — text renders directly on
 * the frost layer; card-less is the intentional visual treatment.
 * Principle 5 (AA Legibility): text colors use --kk-il-* tokens verified
 * ≥4.5:1 against the frost tint on both tones.
 * Principle 12 (No One-Offs): replaces per-page <EmptyState> on list routes.
 */
import type { ReactNode } from 'react'

interface ImmersiveEmptyStateProps {
  /** Optional illustration or emoji icon above the title. */
  icon?: ReactNode
  /** Primary message — e.g. "No beans yet". */
  title: string
  /** Supporting description text. */
  description?: string
  /** Optional call-to-action (e.g. a ToneButton). */
  action?: ReactNode
}

export function ImmersiveEmptyState({
  icon,
  title,
  description,
  action,
}: ImmersiveEmptyStateProps) {
  return (
    <div className="immersive-empty-state">
      {icon && (
        <span className="immersive-empty-state-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <p className="immersive-empty-state-title">{title}</p>
      {description && (
        <p className="immersive-empty-state-description">{description}</p>
      )}
      {action}
    </div>
  )
}
