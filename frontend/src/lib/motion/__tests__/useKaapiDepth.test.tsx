/**
 * T006 — useKaapiDepth: capped pointer lift + reduced-motion/hover opt-out.
 *
 * jsdom reports no reduced-motion preference, so the active path is exercised here;
 * the reduced-motion branch is covered by the `hover=false` opt-out (empty handlers).
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useKaapiDepth } from '../useKaapiDepth'

function HoverHarness({ mobile = false }: { mobile?: boolean }) {
  const { ref, depthProps } = useKaapiDepth<HTMLButtonElement>({ mobile })
  return (
    <button ref={ref} {...depthProps}>
      lift
    </button>
  )
}

function NoHoverHarness() {
  const { ref, depthProps } = useKaapiDepth<HTMLButtonElement>({ hover: false })
  return (
    <button ref={ref} {...depthProps} data-has-enter={String('onPointerEnter' in depthProps)}>
      flat
    </button>
  )
}

describe('useKaapiDepth — pointer lift within caps', () => {
  it('lifts by the desktop cap (4px) on pointer enter and resets on leave', () => {
    render(<HoverHarness />)
    const btn = screen.getByRole('button', { name: 'lift' })
    fireEvent.pointerEnter(btn)
    expect(btn.style.transform).toBe('translate3d(0, -4px, 0)')
    fireEvent.pointerLeave(btn)
    expect(btn.style.transform).toBe('')
  })

  it('uses the tighter mobile cap (2px)', () => {
    render(<HoverHarness mobile />)
    const btn = screen.getByRole('button', { name: 'lift' })
    fireEvent.pointerEnter(btn)
    expect(btn.style.transform).toBe('translate3d(0, -2px, 0)')
  })
})

describe('useKaapiDepth — opt-out', () => {
  it('returns no pointer handlers when hover is disabled', () => {
    render(<NoHoverHarness />)
    const btn = screen.getByRole('button', { name: 'flat' })
    expect(btn).toHaveAttribute('data-has-enter', 'false')
  })
})

describe('useKaapiDepth — reduced-motion parity', () => {
  it('suppresses the pointer lift entirely when reduced motion is preferred', () => {
    const original = window.matchMedia
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as typeof window.matchMedia
    try {
      render(<HoverHarness />)
      const btn = screen.getByRole('button', { name: 'lift' })
      fireEvent.pointerEnter(btn)
      expect(btn.style.transform).toBe('')
    } finally {
      window.matchMedia = original
    }
  })
})
