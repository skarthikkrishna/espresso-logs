import { forwardRef, type SelectHTMLAttributes, type ReactNode } from 'react'

type SelectSize = 'sm' | 'md'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  selectSize?: SelectSize
  error?: boolean
  children: ReactNode
}

const sizeClasses: Record<SelectSize, string> = {
  sm: 'select-sm',
  md: '',
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(({
  selectSize = 'md',
  error = false,
  className = '',
  children,
  ...props
}, ref) => {
  const classes = [
    'select select-bordered input-styled w-full',
    sizeClasses[selectSize],
    error ? 'input-error' : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <select ref={ref} className={classes} {...props}>
      {children}
    </select>
  )
})

Select.displayName = 'Select'

export default Select
