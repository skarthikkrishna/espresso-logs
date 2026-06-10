import { forwardRef, type TextareaHTMLAttributes } from 'react'

type TextareaSize = 'sm' | 'md'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  textareaSize?: TextareaSize
  error?: boolean
}

const sizeClasses: Record<TextareaSize, string> = {
  sm: 'textarea-sm',
  md: '',
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({
  textareaSize = 'md',
  error = false,
  className = '',
  ...props
}, ref) => {
  const classes = [
    'textarea textarea-bordered input-styled w-full',
    sizeClasses[textareaSize],
    error ? 'input-error' : '',
    className,
  ].filter(Boolean).join(' ')

  return <textarea ref={ref} className={classes} {...props} />
})

Textarea.displayName = 'Textarea'

export default Textarea
