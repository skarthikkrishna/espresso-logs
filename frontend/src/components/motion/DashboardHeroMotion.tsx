import { lazy, Suspense } from 'react'
import DashboardHeroFallback from './DashboardHeroFallback'
import { usePrefersReducedMotion, useWebGLSupport } from '../../lib/motion'

const LazyDashboardHero3D = lazy(() => import('./DashboardHero3D'))

interface DashboardHeroMotionProps {
  className?: string
  maxHeight?: number
}

export default function DashboardHeroMotion({ className = '', maxHeight = 240 }: DashboardHeroMotionProps) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const webGLSupport = useWebGLSupport()
  const canUse3D = !prefersReducedMotion && webGLSupport.supported

  return (
    <div data-testid="dashboard-hero-3d-boundary" className="min-h-[180px] md:min-h-[220px]">
      {canUse3D ? (
        <Suspense fallback={<DashboardHeroFallback className={className} maxHeight={maxHeight} />}>
          <LazyDashboardHero3D className={className} maxHeight={maxHeight} />
        </Suspense>
      ) : (
        <DashboardHeroFallback className={className} maxHeight={maxHeight} />
      )}
    </div>
  )
}
