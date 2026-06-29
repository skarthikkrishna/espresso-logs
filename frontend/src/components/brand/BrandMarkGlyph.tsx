import type { SVGProps } from 'react'

export function BrandMarkGlyph({ className = '', ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 200 200"
      aria-hidden="true"
      focusable="false"
      className={['kk-brand-mark-glyph', className].filter(Boolean).join(' ')}
      {...props}
    >
      <g fill="currentColor">
        <g fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth={6.5}>
          <path d="M90 44 q-9 -9 0 -18 q9 -9 0 -18" opacity={0.5} />
          <path d="M110 44 q9 -9 0 -18 q-9 -9 0 -16" opacity={0.32} />
        </g>
        <path d="M48 121 C46 150 54 177 64 181 L136 181 C146 177 154 150 152 121 Z" />
        <ellipse cx="100" cy="119" rx="68" ry="14" />
        <path d="M72 59 C70 82 80 112 86 119 L114 119 C120 112 130 82 128 59 Z" />
        <ellipse cx="100" cy="57" rx="36" ry="9.5" />
        <ellipse cx="100" cy="56" rx="23" ry="5.5" fill="#f59e0b" />
      </g>
    </svg>
  )
}
