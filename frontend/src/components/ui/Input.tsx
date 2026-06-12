import { forwardRef, type InputHTMLAttributes } from 'react'

type InputSize = 'sm' | 'md'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  inputSize?: InputSize
  error?: boolean
}

const sizeClasses: Record<InputSize, string> = {
  sm: 'input-sm',
  md: '',
}

const Input = forwardRef<HTMLInputElement, InputProps>(({
  inputSize = 'md',
  error = false,
  className = '',
  ...props
}, ref) => {
  const classes = [
    'input input-bordered input-styled w-full',
    sizeClasses[inputSize],
    error ? 'input-error' : '',
    className,
  ].filter(Boolean).join(' ')

  return <input ref={ref} className={classes} {...props} />
})

Input.displayName = 'Input'

export default Input
