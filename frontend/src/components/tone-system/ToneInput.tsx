/**
 * ToneInput — tone-aware text input with label and error display.
 *
 * Principle 5 (AA Legibility): input bg/border/text resolve via
 * `--kk-tc-input-*` tokens set by the enclosing card tone class; the
 * amber focus ring is the brand affordance on both tones.
 * Principle 12 (No One-Offs): replaces `<FormField>` + `<Input>` pairs
 * with a single tone-aware atom.
 *
 * Label association: `<label htmlFor={id}>` + `<input id={id}>` so
 * `getByLabelText` works correctly in tests.
 */
import { forwardRef, type InputHTMLAttributes } from 'react'

interface ToneInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string | null
  errorId?: string
  hint?: string
  required?: boolean
}

export const ToneInput = forwardRef<HTMLInputElement, ToneInputProps>(
  ({ label, error, errorId, hint, required, id, className = '', ...inputProps }, ref) => (
    <div className="w-full">
      <label htmlFor={id} className="kk-tc-field-label">
        {label}
        {required && <span aria-hidden="true"> *</span>}
        {hint && <span className="kk-tc-body-muted ml-1 font-normal">({hint})</span>}
      </label>
      <input
        ref={ref}
        id={id}
        className={['input input-bordered input-styled w-full input-sm', className]
          .filter(Boolean)
          .join(' ')}
        {...inputProps}
      />
      {error && (
        <p id={errorId} role="alert" className="kk-tc-error mt-1">
          {error}
        </p>
      )}
    </div>
  ),
)

ToneInput.displayName = 'ToneInput'
