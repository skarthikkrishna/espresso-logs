import { forwardRef, type AnchorHTMLAttributes, type ReactNode } from 'react'

interface ToneLinkActionProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  children: ReactNode
}

export const ToneLinkAction = forwardRef<HTMLAnchorElement, ToneLinkActionProps>(
  ({ children, className = '', ...rest }, ref) => (
    <a
      ref={ref}
      className={['kk-tc-btn kk-tc-btn--edit', className].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </a>
  ),
)

ToneLinkAction.displayName = 'ToneLinkAction'
