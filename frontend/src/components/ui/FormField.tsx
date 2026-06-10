import type { ReactNode } from 'react'

interface FormFieldProps {
  label: string
  htmlFor?: string
  required?: boolean
  hint?: string
  error?: string | null
  errorId?: string
  children: ReactNode
}

export default function FormField({
  label,
  htmlFor,
  required = false,
  hint,
  error,
  errorId,
  children,
}: FormFieldProps) {
  return (
    <div className="form-control w-full">
      <label className="label" htmlFor={htmlFor}>
        <span className="label-text text-sm font-medium">
          {label}
          {required && <span className="text-error ml-0.5" aria-hidden="true">*</span>}
          {hint && <span className="text-base-content/50 font-normal ml-1">({hint})</span>}
        </span>
      </label>
      {children}
      {error && (
        <p
          id={errorId}
          className="text-error text-sm mt-1"
          role="alert"
          aria-live="polite"
        >
          {error}
        </p>
      )}
    </div>
  )
}
