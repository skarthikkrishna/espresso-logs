interface DashboardHeroFallbackProps {
  className?: string
  maxHeight?: number
  testId?: string
}

export default function DashboardHeroFallback({ className = '', maxHeight = 220, testId = 'dashboard-hero-3d-fallback' }: DashboardHeroFallbackProps) {
  return (
    <div
      data-testid={testId}
      aria-hidden="true"
      className={`relative flex items-center justify-center overflow-hidden rounded-[var(--bevel-radius)] border border-amber-400/15 bg-[radial-gradient(circle_at_50%_35%,rgba(245,158,11,0.20),rgba(26,18,9,0.18)_42%,rgba(8,5,3,0.62)_100%)] ${className}`}
      style={{ maxHeight, minHeight: Math.min(maxHeight, 180) }}
    >
      <svg viewBox="0 0 320 220" className="h-full w-full max-w-[22rem] opacity-95 drop-shadow-[0_0_28px_rgba(245,158,11,0.20)]" role="presentation">
        <path d="M145 30c-18 20-8 37 6 53 16 18 20 36 3 55" fill="none" stroke="#f5e6d3" strokeWidth="10" strokeLinecap="round" opacity="0.82" />
        <path d="M178 43c13 15 10 31-4 45" fill="none" stroke="#f5e6d3" strokeWidth="8" strokeLinecap="round" opacity="0.62" />
        <ellipse cx="160" cy="92" rx="50" ry="16" fill="none" stroke="#f5e6d3" strokeWidth="12" />
        <ellipse cx="160" cy="92" rx="34" ry="8" fill="none" stroke="#f59e0b" strokeWidth="7" opacity="0.9" />
        <path d="M110 98l22 72c6 20 22 33 28 33s22-13 28-33l22-72" fill="none" stroke="#f5e6d3" strokeWidth="12" strokeLinejoin="round" />
        <path d="M126 143c25 13 43 13 68 0" fill="none" stroke="#f59e0b" strokeWidth="8" strokeLinecap="round" opacity="0.75" />
        <ellipse cx="160" cy="178" rx="82" ry="24" fill="none" stroke="#f5e6d3" strokeWidth="12" />
        <path d="M87 184c31 31 115 31 146 0" fill="none" stroke="#b45309" strokeWidth="10" strokeLinecap="round" opacity="0.92" />
      </svg>
    </div>
  )
}
