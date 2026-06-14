import { useCallback, useEffect, useRef } from 'react'
import { kaapiMotionDepth } from './tokens'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

interface UseKaapiDepthOptions {
  /** Apply a small capped lift on pointer hover. Default true. */
  hover?: boolean
  /** Apply capped scroll-y parallax. Default false. */
  scroll?: boolean
  /** Use the tighter mobile caps (2px hover / 8px scroll). Default false. */
  mobile?: boolean
}

interface DepthHandlers {
  onPointerEnter?: () => void
  onPointerLeave?: () => void
}

/**
 * spec-043 T006 — pointer/scroll depth within the named grammar caps.
 *
 * Restrained, capped depth: hover lifts the element by at most the hover cap
 * (4px desktop / 2px mobile); scroll parallax is capped at 18px desktop / 8px
 * mobile. Under `prefers-reduced-motion` every transform is suppressed — no lift,
 * no parallax — preserving a static final state. Returns a `ref` to attach to the
 * target plus `depthProps` (pointer handlers) to spread onto it.
 */
export function useKaapiDepth<T extends HTMLElement = HTMLElement>(
  options: UseKaapiDepthOptions = {},
) {
  const { hover = true, scroll = false, mobile = false } = options
  const ref = useRef<T>(null)
  const prefersReducedMotion = usePrefersReducedMotion()

  const hoverCap = mobile ? kaapiMotionDepth.hoverMaxMobile : kaapiMotionDepth.hoverMaxDesktop
  const scrollCap = mobile ? kaapiMotionDepth.scrollMaxMobile : kaapiMotionDepth.scrollMaxDesktop

  const setLift = useCallback((px: number) => {
    const node = ref.current
    if (!node) return
    node.style.transition = 'transform var(--motion-duration-micro) var(--motion-ease-standard)'
    node.style.transform = px === 0 ? '' : `translate3d(0, ${-px}px, 0)`
  }, [])

  const onPointerEnter = useCallback(() => setLift(hoverCap), [hoverCap, setLift])
  const onPointerLeave = useCallback(() => setLift(0), [setLift])

  useEffect(() => {
    if (!scroll || prefersReducedMotion) return undefined
    if (typeof window === 'undefined') return undefined

    let frame = 0
    const update = () => {
      frame = 0
      const node = ref.current
      if (!node) return
      const rect = node.getBoundingClientRect()
      const viewportH = window.innerHeight || 1
      // -1 (below) … 0 (centered) … 1 (above); capped translate keeps it subtle.
      const progress = (viewportH / 2 - (rect.top + rect.height / 2)) / viewportH
      const offset = Math.max(-1, Math.min(1, progress)) * scrollCap
      node.style.transform = `translate3d(0, ${offset.toFixed(2)}px, 0)`
    }
    const onScroll = () => {
      if (frame) return
      frame = window.requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [scroll, scrollCap, prefersReducedMotion])

  const depthProps: DepthHandlers =
    hover && !prefersReducedMotion ? { onPointerEnter, onPointerLeave } : {}

  return { ref, depthProps, prefersReducedMotion }
}
