import type { RefObject } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { kaapiEase, kaapiGrammarEase, kaapiMotionDepth, kaapiMotionGrammar, kaapiMotionTokens } from './tokens'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

gsap.registerPlugin(useGSAP)

type MotionTarget = gsap.TweenTarget

interface UseKaapiMotionOptions {
  scope?: RefObject<Element | null>
}

const setFinal = (target: MotionTarget, vars: gsap.TweenVars) => {
  gsap.set(target, vars)
  return null
}

export function useKaapiMotion(options: UseKaapiMotionOptions = {}) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const { contextSafe } = useGSAP(() => undefined, { scope: options.scope })

  const routeEnter = contextSafe((target: MotionTarget) => {
    if (prefersReducedMotion) {
      return setFinal(target, { opacity: 1, y: 0, clearProps: 'transform' })
    }
    return gsap.fromTo(
      target,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: kaapiMotionTokens.fluid, ease: kaapiEase.out, clearProps: 'transform' },
    )
  })

  const staggerCards = contextSafe((target: MotionTarget, stagger: number = kaapiMotionTokens.staggerCard) => {
    if (prefersReducedMotion) {
      return setFinal(target, { opacity: 1, y: 0, scale: 1, clearProps: 'transform' })
    }
    return gsap.fromTo(
      target,
      { opacity: 0, y: 14, scale: 0.985 },
      { opacity: 1, y: 0, scale: 1, duration: kaapiMotionTokens.fluid, stagger, ease: kaapiEase.out, clearProps: 'transform' },
    )
  })

  const fabMount = contextSafe((target: MotionTarget) => {
    if (prefersReducedMotion) {
      return setFinal(target, { opacity: 1, y: 0, scale: 1, clearProps: 'transform' })
    }
    return gsap.fromTo(
      target,
      { opacity: 0, y: 12, scale: 0.92 },
      { opacity: 1, y: 0, scale: 1, duration: kaapiMotionTokens.modal, ease: kaapiEase.spring, clearProps: 'transform' },
    )
  })

  const modalOpen = contextSafe((surface: MotionTarget, backdrop?: MotionTarget) => {
    const timeline = gsap.timeline()
    if (prefersReducedMotion) {
      timeline.set(backdrop ?? [], { opacity: 1 })
      timeline.set(surface, { opacity: 1, y: 0, scale: 1, clearProps: 'transform' })
      return timeline
    }
    if (backdrop) {
      timeline.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: kaapiMotionTokens.base, ease: kaapiEase.out }, 0)
    }
    timeline.fromTo(
      surface,
      { opacity: 0, y: 8, scale: 0.97 },
      { opacity: 1, y: 0, scale: 1, duration: kaapiMotionTokens.modal, ease: kaapiEase.modalOpen, clearProps: 'transform' },
      0,
    )
    return timeline
  })

  const detailOnSelect = contextSafe((target: MotionTarget) => {
    if (prefersReducedMotion) {
      return setFinal(target, { opacity: 1, y: 0, clearProps: 'transform' })
    }
    return gsap.fromTo(
      target,
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.28, ease: kaapiEase.out, clearProps: 'transform' },
    )
  })

  const pressFeedback = contextSafe((target: MotionTarget) => {
    if (prefersReducedMotion) {
      return null
    }
    return gsap.to(target, { scale: 0.96, duration: kaapiMotionTokens.quick, ease: kaapiEase.out, yoyo: true, repeat: 1, clearProps: 'transform' })
  })

  // ── spec-043 T006: named-grammar reveals (clip/text) + section stagger ──────
  const clipDistance = `${kaapiMotionDepth.clipRevealDistanceEm}em`

  const clipReveal = contextSafe((target: MotionTarget) => {
    if (prefersReducedMotion) {
      return setFinal(target, { opacity: 1, y: 0, clipPath: 'inset(0 0 0% 0)', clearProps: 'transform,clipPath' })
    }
    return gsap.fromTo(
      target,
      { opacity: 0, y: clipDistance, clipPath: 'inset(0 0 100% 0)' },
      { opacity: 1, y: 0, clipPath: 'inset(0 0 0% 0)', duration: kaapiMotionGrammar.enter, ease: kaapiGrammarEase.emphasized, clearProps: 'transform,clipPath' },
    )
  })

  const textReveal = contextSafe((target: MotionTarget, stagger: number = kaapiMotionGrammar.staggerSection) => {
    if (prefersReducedMotion) {
      return setFinal(target, { opacity: 1, y: 0, clipPath: 'inset(0 0 0% 0)', clearProps: 'transform,clipPath' })
    }
    return gsap.fromTo(
      target,
      { opacity: 0, y: clipDistance, clipPath: 'inset(0 0 100% 0)' },
      { opacity: 1, y: 0, clipPath: 'inset(0 0 0% 0)', duration: kaapiMotionGrammar.enter, stagger, ease: kaapiGrammarEase.emphasized, clearProps: 'transform,clipPath' },
    )
  })

  const sectionStagger = contextSafe((target: MotionTarget) => {
    if (prefersReducedMotion) {
      return setFinal(target, { opacity: 1, y: 0, clearProps: 'transform' })
    }
    return gsap.fromTo(
      target,
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: kaapiMotionGrammar.enter, stagger: kaapiMotionGrammar.staggerSection, ease: kaapiGrammarEase.standard, clearProps: 'transform' },
    )
  })

  return {
    prefersReducedMotion,
    routeEnter,
    staggerCards,
    fabMount,
    modalOpen,
    detailOnSelect,
    pressFeedback,
    clipReveal,
    textReveal,
    sectionStagger,
  }
}
