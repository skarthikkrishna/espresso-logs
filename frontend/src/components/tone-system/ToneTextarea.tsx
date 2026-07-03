/**
 * ToneTextarea — tone-aware textarea with label and error display.
 *
 * Principle 5 (AA Legibility): textarea bg/border/text resolve via
 * `--kk-tc-input-*` tokens; amber focus ring on both tones.
 * Principle 12 (No One-Offs): replaces `<FormField>` + `<Textarea>` pairs.
 */
import { forwardRef, type TextareaHTMLAttributes } from 'react'

interface ToneTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  error?: string | null
  errorId?: string
  hint?: string
  required?: boolean
}

export const ToneTextarea = forwardRef<HTMLTextAreaElement, ToneTextareaProps>(
  ({ label, error, errorId, hint, required, id, className = '', ...textareaProps }, ref) => (
    <div className="w-full">
      <label htmlFor={id} className="kk-tc-field-label">
        {label}
        {required && <span aria-hidden="true"> *</span>}
        {hint && <span className="kk-tc-body-muted ml-1 font-normal">({hint})</span>}
      </label>
      <textarea
        ref={ref}
        id={id}
        className={['textarea textarea-bordered input-styled w-full textarea-sm', className]
          .filter(Boolean)
          .join(' ')}
        {...textareaProps}
      />
      {error && (
        <p id={errorId} role="alert" className="kk-tc-error mt-1">
          {error}
        </p>
      )}
    </div>
  ),
)

ToneTextarea.displayName = 'ToneTextarea'
