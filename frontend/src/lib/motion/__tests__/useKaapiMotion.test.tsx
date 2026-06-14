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
import { describe, it, expect } from 'vitest'
import { useKaapiMotion } from '../useKaapiMotion'

function RevealHarness() {
  const scope = useRef<HTMLDivElement>(null)
  const target = useRef<HTMLDivElement>(null)
  const motion = useKaapiMotion({ scope })

  useEffect(() => {
    if (!target.current) return
    motion.clipReveal(target.current)
    motion.textReveal(target.current)
    motion.sectionStagger(target.current)
  }, [])

  return (
    <div ref={scope}>
      <div ref={target}>revealed</div>
    </div>
  )
}

describe('useKaapiMotion — named-grammar reveals', () => {
  it('runs clipReveal/textReveal/sectionStagger without error and keeps the target', () => {
    render(<RevealHarness />)
    expect(screen.getByText('revealed')).toBeInTheDocument()
  })
})
