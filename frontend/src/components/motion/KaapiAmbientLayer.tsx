import { lazy, Suspense } from 'react'
import { usePrefersReducedMotion, useWebGLSupport } from '../../lib/motion'

const LazyKaapiAmbientCanvas = lazy(() => import('./KaapiAmbientCanvas'))

/**
 * spec-043 T006 — KaapiAmbientLayer.
 *
 * The single, shared, persistent ambient depth layer. Mounted ONCE at app-shell
 * level (App.tsx, above the router) so it never remounts on route change — this is
 * what keeps the WebGL context count at one and avoids remount multiplication.
 *
 * It is fixed, `aria-hidden`, and non-interactive (`pointer-events: none`), and sits
 * at the deepest layer (z-index below `.app-bg`). The static token gradient
 * (`--kaapi-ambient-static-gradient`) is ALWAYS painted, so reduced-motion, no-WebGL,
 * preload, dynamic-import error, and context-loss all degrade to a non-empty calm
 * gradient — never a blank or dark box. The animated drift is layered on top only
 * when motion is allowed and WebGL is available, and is lazy-loaded so it never
 * blocks first paint.
 */
export default function KaapiAmbientLayer() {
  const prefersReducedMotion = usePrefersReducedMotion()
  const webGL = useWebGLSupport()
  const canAnimate = !prefersReducedMotion && webGL.supported

  return (
    <div
      aria-hidden="true"
      data-testid="kaapi-ambient"
      className="pointer-events-none fixed inset-0 -z-[2] overflow-hidden"
    >
      <div
        className="absolute inset-0"
        style={{ background: 'var(--kaapi-ambient-static-gradient)' }}
      />
      {canAnimate && (
        <Suspense fallback={null}>
          <LazyKaapiAmbientCanvas />
        </Suspense>
      )}
    </div>
  )
}
