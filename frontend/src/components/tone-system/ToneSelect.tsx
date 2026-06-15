/**
 * ToneSelect — tone-aware select with label and error display.
 *
 * Principle 5 (AA Legibility): select bg/border/text resolve via
 * `--kk-tc-input-*` tokens; amber focus ring on both tones.
 * Principle 12 (No One-Offs): replaces `<FormField>` + `<Select>` pairs.
 */
import { forwardRef, type ReactNode, type SelectHTMLAttributes } from 'react'

interface ToneSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  error?: string | null
  errorId?: string
  hint?: string
  required?: boolean
  children: ReactNode
}

export const ToneSelect = forwardRef<HTMLSelectElement, ToneSelectProps>(
  ({ label, error, errorId, hint, required, id, className = '', children, ...selectProps }, ref) => (
    <div className="w-full">
      <label htmlFor={id} className="kk-tc-field-label">
        {label}
        {required && <span aria-hidden="true"> *</span>}
        {hint && <span className="kk-tc-body-muted ml-1 font-normal">({hint})</span>}
      </label>
      <select
        ref={ref}
        id={id}
        className={['select select-bordered input-styled w-full select-sm', className]
          .filter(Boolean)
          .join(' ')}
        {...selectProps}
      >
        {children}
      </select>
      {error && (
        <p id={errorId} role="alert" className="kk-tc-error mt-1">
          {error}
        </p>
      )}
    </div>
  ),
)

ToneSelect.displayName = 'ToneSelect'
