import { useRef, type HTMLAttributes, type ReactNode } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { kaapiGrammarEase, kaapiMotionGrammar } from '../../lib/motion/tokens'
import { usePrefersReducedMotion } from '../../lib/motion'

gsap.registerPlugin(useGSAP)

type LayerVariant = 'route' | 'modal' | 'section' | 'side'

interface LayerTransitionProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  variant?: LayerVariant
  transitionKey?: string | number
  focusOnEnter?: boolean
}

/**
 * spec-043 T005 — LayerTransition.
 *
 * One place that owns GSAP enter choreography and its cleanup for route, modal, section, and
 * side layers. Built on `useGSAP`, so the gsap.context is reverted automatically
 * on unmount and re-run when `transitionKey` changes — this is what prevents stale
 * tweens across route/layer/modal/section changes and makes it safe under React
 * StrictMode's double-invoke (mount → revert → mount). When `focusOnEnter` is set the
 * layer receives programmatic focus once mounted (accessible focus handoff on route
 * change). Under `prefers-reduced-motion` the final state is applied instantly with
 * no movement, preserving hierarchy, read order, and the focus handoff.
 */
const enterVars: Record<LayerVariant, { from: gsap.TweenVars; duration: number; ease: string }> = {
  route: { from: { opacity: 0, y: 10 }, duration: kaapiMotionGrammar.route, ease: kaapiGrammarEase.emphasized },
  modal: { from: { opacity: 0, y: 8, scale: 0.97 }, duration: kaapiMotionGrammar.enter, ease: kaapiGrammarEase.emphasized },
  section: { from: { opacity: 0, y: 12 }, duration: kaapiMotionGrammar.enter, ease: kaapiGrammarEase.standard },
  side: { from: { opacity: 0, x: 24 }, duration: kaapiMotionGrammar.route, ease: kaapiGrammarEase.emphasized },
}

export default function LayerTransition({
  children,
  variant = 'route',
  transitionKey,
  focusOnEnter = false,
  className = '',
  ...props
}: LayerTransitionProps) {
  const scope = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = usePrefersReducedMotion()

  useGSAP(
    () => {
      const node = scope.current
      if (!node) return

      const { from, duration, ease } = enterVars[variant]
      const settled = Object.keys(from).reduce<gsap.TweenVars>((acc, key) => {
        acc[key] = key === 'scale' ? 1 : key === 'opacity' ? 1 : 0
        return acc
      }, {})

      if (prefersReducedMotion) {
        gsap.set(node, { ...settled, clearProps: 'transform' })
      } else {
        gsap.fromTo(node, from, { ...settled, duration, ease, clearProps: 'transform' })
      }

      if (focusOnEnter) {
        node.focus({ preventScroll: true })
      }
    },
    { scope, dependencies: [transitionKey, variant, prefersReducedMotion] },
  )

  return (
    <div
      ref={scope}
      className={`outline-none ${className}`}
      tabIndex={focusOnEnter ? -1 : undefined}
      {...props}
    >
      {children}
    </div>
  )
}
