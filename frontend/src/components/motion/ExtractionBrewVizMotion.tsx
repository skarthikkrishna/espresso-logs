import { lazy, Suspense } from 'react'
import ExtractionBrewVizFallback from './ExtractionBrewVizFallback'
import { usePrefersReducedMotion, useWebGLSupport } from '../../lib/motion'

const LazyExtractionBrewViz3D = lazy(() => import('./ExtractionBrewViz3D'))

interface ExtractionBrewVizMotionProps {
  doseGrams: number
  yieldGrams: number
  timeSeconds: number
  className?: string
}

export default function ExtractionBrewVizMotion({ doseGrams, yieldGrams, timeSeconds, className = '' }: ExtractionBrewVizMotionProps) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const webGLSupport = useWebGLSupport()
  const canUse3D = !prefersReducedMotion && webGLSupport.supported

  return (
    <div data-testid="extraction-brew-viz-boundary" className="space-y-4">
      <div data-testid="extraction-brew-viz-summary" className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-[var(--bevel-radius)] border border-white/10 bg-black/10 p-3">
          <p className="text-2xl font-bold text-amber-100">{doseGrams}g</p>
          <p className="text-xs uppercase tracking-[0.16em] text-amber-200/55">Dose</p>
        </div>
        <div className="rounded-[var(--bevel-radius)] border border-white/10 bg-black/10 p-3">
          <p className="text-2xl font-bold text-amber-100">{yieldGrams}g</p>
          <p className="text-xs uppercase tracking-[0.16em] text-amber-200/55">Yield</p>
        </div>
        <div className="rounded-[var(--bevel-radius)] border border-white/10 bg-black/10 p-3">
          <p className="text-2xl font-bold text-amber-100">{timeSeconds}s</p>
          <p className="text-xs uppercase tracking-[0.16em] text-amber-200/55">Time</p>
        </div>
      </div>
      {canUse3D ? (
        <Suspense fallback={<ExtractionBrewVizFallback doseGrams={doseGrams} yieldGrams={yieldGrams} timeSeconds={timeSeconds} className={className} />}>
          <LazyExtractionBrewViz3D doseGrams={doseGrams} yieldGrams={yieldGrams} timeSeconds={timeSeconds} className={className} />
        </Suspense>
      ) : (
        <ExtractionBrewVizFallback doseGrams={doseGrams} yieldGrams={yieldGrams} timeSeconds={timeSeconds} className={className} />
      )}
    </div>
  )
}
