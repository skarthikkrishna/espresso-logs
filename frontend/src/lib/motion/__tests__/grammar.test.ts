/**
 * T006 — Named motion/fluidity grammar token values.
 *
 * Locks the grammar numbers to the spec so an accidental retune fails loudly.
 * Durations are seconds (gsap) mirroring the --motion-duration-* CSS vars (ms).
 */

import { describe, it, expect } from 'vitest'
import {
  kaapiMotionGrammar,
  kaapiMotionDepth,
  kaapiAmbientConstants,
} from '../tokens'

describe('kaapiMotionGrammar — durations (seconds)', () => {
  it('matches the spec grammar', () => {
    expect(kaapiMotionGrammar.instant).toBe(0.1) // 100ms
    expect(kaapiMotionGrammar.micro).toBe(0.16) // 160ms
    expect(kaapiMotionGrammar.enter).toBe(0.34) // 340ms
    expect(kaapiMotionGrammar.route).toBe(0.56) // 560ms
    expect(kaapiMotionGrammar.ambientSettle).toBe(0.9) // 900ms
    expect(kaapiMotionGrammar.staggerCard).toBe(0.036) // 36ms
    expect(kaapiMotionGrammar.staggerSection).toBe(0.07) // 70ms
  })
})

describe('kaapiMotionDepth — caps', () => {
  it('hover depth caps 4px desktop / 2px mobile', () => {
    expect(kaapiMotionDepth.hoverMaxDesktop).toBe(4)
    expect(kaapiMotionDepth.hoverMaxMobile).toBe(2)
  })

  it('scroll-y caps 18px desktop / 8px mobile', () => {
    expect(kaapiMotionDepth.scrollMaxDesktop).toBe(18)
    expect(kaapiMotionDepth.scrollMaxMobile).toBe(8)
  })

  it('clip reveal travel is 0.45em', () => {
    expect(kaapiMotionDepth.clipRevealDistanceEm).toBe(0.45)
  })
})

describe('kaapiAmbientConstants — performance caps', () => {
  it('matches the shared ambient constants', () => {
    expect(kaapiAmbientConstants.dprMax).toBe(1.5)
    expect(kaapiAmbientConstants.fpsVisible).toBe(30)
    expect(kaapiAmbientConstants.fpsIdle).toBe(8)
    expect(kaapiAmbientConstants.idlePauseMs).toBe(4500)
  })
})
