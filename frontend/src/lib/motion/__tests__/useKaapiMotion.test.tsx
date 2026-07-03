/**
 * T006 — useKaapiMotion named-grammar reveals: callability in a real gsap context.
 *
 * Mirrors the LayerTransition convention: assert the DOM/contract (methods are
 * callable inside a useGSAP scope and the target survives) rather than animated
 * frame values, which are timing-dependent. The numeric grammar the methods consume
 * is locked separately in grammar.test.ts.
 */

import React, { useEffect, useRef } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useKaapiMotion } from '../useKaapiMotion'

function MotionHarness() {
  const scope = useRef<HTMLDivElement>(null)
  const target = useRef<HTMLDivElement>(null)
  const motion = useKaapiMotion({ scope })

  useEffect(() => {
    if (!target.current) return
    motion.routeEnter(target.current)
    motion.staggerCards(target.current)
    motion.fabMount(target.current)
    motion.pressFeedback(target.current)
    motion.modalOpen(target.current, scope.current)
    motion.clipReveal(target.current)
    motion.textReveal(target.current)
    motion.sectionStagger(target.current)
  }, [])

  return (
    <div ref={scope}>
      <div ref={target} data-testid="reveal-target">revealed</div>
    </div>
  )
}

describe('useKaapiMotion — named-grammar API', () => {
  it('runs the full route/stagger/fab/press/modal/clip/text/section API without error and keeps the target', () => {
    render(<MotionHarness />)
    expect(screen.getByText('revealed')).toBeInTheDocument()
  })
})

describe('useKaapiMotion — reduced-motion parity', () => {
  it('lands on the final visible state (opacity 1) instead of animating from a hidden frame', () => {
    const original = window.matchMedia
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as typeof window.matchMedia
    try {
      render(<MotionHarness />)
      const target = screen.getByTestId('reveal-target')
      expect(target.style.opacity).toBe('1')
    } finally {
      window.matchMedia = original
    }
  })
})
