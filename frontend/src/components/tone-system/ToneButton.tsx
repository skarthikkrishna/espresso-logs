/**
 * ToneButton — tone-aware action button with four variants.
 *
 * Principle 8 (Button States — INTENSIFY, Never Invert): hover/active states
 * increase alpha/saturation, text stays in the same tonal family; no color flip.
 * Principle 4 (Warm Coherence): primary is warm amber (DARK) / espresso (BEIGE).
 * Principle 12 (No One-Offs): replaces per-page `.kk-tc-btn kk-tc-btn--edit`,
 * `.kk-tc-btn kk-tc-btn--danger`, `.kk-tc-primary-btn`, and ghost patterns.
 *
 * Button hierarchy (one primary per view max):
 *   primary — solid fill; highest contrast; main action ("Log a shot", "Save")
 *   edit    — outlined/secondary; supporting actions ("Manage catalog", "Edit")
 *   ghost   — text-only; low-priority tertiary ("Skip", "Learn more")
 *   danger  — red-tinted; destructive actions ("Delete", "Remove")
 *
 * DaisyUI btn/btn-primary/btn-ghost classes are NOT used here: native buttons
 * with kk-tc-* classes ensure no DaisyUI state re-introduces color inversion.
 */
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

type ToneButtonVariant = 'edit' | 'danger' | 'primary' | 'ghost'

interface ToneButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ToneButtonVariant
  children: ReactNode
}

const VARIANT_CLASSES: Record<ToneButtonVariant, string> = {
  edit: 'kk-tc-btn kk-tc-btn--edit',
  danger: 'kk-tc-btn kk-tc-btn--danger',
  primary: 'kk-tc-primary-btn',
  ghost: 'kk-tc-btn kk-tc-btn--ghost',
}

export const ToneButton = forwardRef<HTMLButtonElement, ToneButtonProps>(
  ({ variant = 'edit', children, className = '', type = 'button', ...rest }, ref) => (
    <button
      ref={ref}
      type={type}
      className={[VARIANT_CLASSES[variant], className].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </button>
  ),
)

ToneButton.displayName = 'ToneButton'
