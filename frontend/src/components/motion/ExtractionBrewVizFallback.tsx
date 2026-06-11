interface ExtractionBrewVizFallbackProps {
  doseGrams: number
  yieldGrams: number
  timeSeconds: number
  className?: string
  testId?: string
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export default function ExtractionBrewVizFallback({ doseGrams, yieldGrams, timeSeconds, className = '', testId = 'extraction-brew-viz-fallback' }: ExtractionBrewVizFallbackProps) {
  const doseHeight = clamp((doseGrams / 22) * 38, 18, 44)
  const yieldHeight = clamp((yieldGrams / 50) * 96, 24, 106)
  const arc = clamp((timeSeconds / 40) * 220, 70, 245)

  return (
    <div
      data-testid={testId}
      aria-hidden="true"
      className={`relative flex h-[220px] items-center justify-center overflow-hidden rounded-[var(--bevel-radius)] border border-amber-400/15 bg-[radial-gradient(circle_at_50%_40%,rgba(245,158,11,0.14),rgba(26,18,9,0.18)_46%,rgba(8,5,3,0.64)_100%)] ${className}`}
    >
      <svg viewBox="0 0 360 220" className="h-full w-full" role="presentation">
        <defs>
          <linearGradient id="brew-fallback-amber" x1="0" x2="0" y1="0" y2="1">
            <stop stopColor="#f59e0b" stopOpacity="0.96" />
            <stop offset="1" stopColor="#b45309" stopOpacity="0.68" />
          </linearGradient>
        </defs>
        <ellipse cx="180" cy="177" rx="86" ry="18" fill="#2d1f0e" stroke="#f5e6d3" strokeOpacity="0.24" strokeWidth="3" />
        <rect x="122" y={164 - doseHeight} width="116" height={doseHeight} rx="18" fill="#5b3412" opacity="0.78" />
        <rect x="155" y={146 - yieldHeight} width="50" height={yieldHeight} rx="20" fill="url(#brew-fallback-amber)" opacity="0.9" />
        <circle cx="180" cy="93" r="54" fill="none" stroke="#f5e6d3" strokeOpacity="0.10" strokeWidth="12" />
        <circle cx="180" cy="93" r="54" fill="none" stroke="#f59e0b" strokeDasharray={`${arc} 340`} strokeLinecap="round" strokeWidth="12" transform="rotate(-90 180 93)" />
      </svg>
    </div>
  )
}
