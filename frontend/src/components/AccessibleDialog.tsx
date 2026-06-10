import { useEffect, useRef, type ReactNode } from 'react'

type DialogSize = 'sm' | 'md' | 'lg' | 'bottom'

interface AccessibleDialogProps {
  open: boolean
  title: string
  description?: string
  size?: DialogSize
  onClose: () => void
  children: ReactNode
}

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export default function AccessibleDialog({ open, title, description, size = 'md', onClose, children }: AccessibleDialogProps) {
  const surfaceRef = useRef<HTMLDivElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const titleId = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-dialog-title`
  const descriptionId = description ? `${titleId}-description` : undefined

  useEffect(() => {
    if (!open) return undefined
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null

    const frame = window.requestAnimationFrame(() => {
      const focusable = surfaceRef.current?.querySelector<HTMLElement>(focusableSelector)
      ;(focusable ?? surfaceRef.current)?.focus()
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      const focusable = Array.from(surfaceRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [])
        .filter((element) => !element.hasAttribute('disabled') && element.tabIndex !== -1)
      if (focusable.length === 0) {
        event.preventDefault()
        surfaceRef.current?.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.classList.add('modal-open')
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.classList.remove('modal-open')
      returnFocusRef.current?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  const sizeClass = size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-3xl' : size === 'bottom' ? 'max-w-none sm:max-w-lg sm:modal-middle' : 'max-w-lg'

  return (
    <div
      className={`modal modal-open glass-modal-backdrop ${size === 'bottom' ? 'modal-bottom sm:modal-middle' : ''}`}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={surfaceRef}
        className={`modal-box glass-modal-surface bg-stone-950/95 border border-amber-900/30 ${sizeClass}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        <div className="mb-4 space-y-1">
          <h2 id={titleId} className="font-display text-xl text-amber-100">{title}</h2>
          {description ? <p id={descriptionId} className="text-sm text-base-content/70">{description}</p> : null}
        </div>
        {children}
      </div>
    </div>
  )
}
