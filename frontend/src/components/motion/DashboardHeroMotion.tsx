import { Component, lazy, Suspense, type ReactNode } from 'react'
import DashboardHeroFallback from './DashboardHeroFallback'
import { HeroVisualFrame } from '../ui'
import { usePrefersReducedMotion, useWebGLSupport } from '../../lib/motion'

const LazyDashboardHero3D = lazy(() => import('./DashboardHero3D'))

interface DashboardHeroMotionProps {
  className?: string
  maxHeight?: number
}

/**
 * spec-043 T009 — the dashboard hero is the first of the two allowed foreground
 * WebGL contexts. It is rendered inside HeroVisualFrame so the solid, never-blurred
 * surface and the five hero states (active / loading / fallback / error) live in one
 * place. Reduced-motion or absent WebGL resolves to the static fallback poster; a
 * failed dynamic import resolves to the error poster. No new three.js context is
 * created here — the lazy chunk owns the single canvas.
 */
class HeroErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children
  }
}

export default function DashboardHeroMotion({ className = '', maxHeight = 240 }: DashboardHeroMotionProps) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const webGLSupport = useWebGLSupport()
  const canUse3D = !prefersReducedMotion && webGLSupport.supported

  const fallbackArt = <DashboardHeroFallback fill maxHeight={maxHeight} />

  if (!canUse3D) {
    return (
      <HeroVisualFrame
        data-testid="dashboard-hero-3d-boundary"
        state="fallback"
        maxHeight={maxHeight}
        className={className}
        fallback={fallbackArt}
      />
    )
  }

  const errorFrame = (
    <HeroVisualFrame
      data-testid="dashboard-hero-3d-boundary"
      state="error"
      maxHeight={maxHeight}
      className={className}
      fallback={fallbackArt}
    />
  )

  return (
    <HeroErrorBoundary fallback={errorFrame}>
      <HeroVisualFrame
        data-testid="dashboard-hero-3d-boundary"
        state="active"
        maxHeight={maxHeight}
        className={className}
        fallback={fallbackArt}
        loading={fallbackArt}
        active={
          <Suspense fallback={fallbackArt}>
            <LazyDashboardHero3D fill maxHeight={maxHeight} />
          </Suspense>
        }
      />
    </HeroErrorBoundary>
  )
}
