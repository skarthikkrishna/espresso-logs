/**
 * T005 — Unit tests for HeroVisualFrame.tsx
 *
 * Covers: the five hero states (active/idle/loading/fallback/error), never-blank
 * guarantee, blur-free solid surface contract, and decorative-vs-labelled a11y.
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import HeroVisualFrame from '../HeroVisualFrame'

describe('HeroVisualFrame — state rendering', () => {
  it('renders the active node when state="active"', () => {
    render(
      <HeroVisualFrame state="active" active={<canvas data-testid="webgl" />} fallback={<div data-testid="fb" />} />,
    )
    expect(screen.getByTestId('webgl')).toBeInTheDocument()
    expect(screen.queryByTestId('fb')).toBeNull()
  })

  it('renders the loading node when state="loading"', () => {
    render(<HeroVisualFrame state="loading" loading={<div data-testid="ld" />} />)
    expect(screen.getByTestId('ld')).toBeInTheDocument()
  })

  it.each(['idle', 'fallback', 'error'] as const)('renders the fallback for state="%s"', (state) => {
    render(<HeroVisualFrame state={state} active={<div data-testid="webgl" />} fallback={<div data-testid="fb" />} />)
    expect(screen.getByTestId('fb')).toBeInTheDocument()
    expect(screen.queryByTestId('webgl')).toBeNull()
  })

  it('never renders blank: active state without an active node falls back to static art', () => {
    const { container } = render(<HeroVisualFrame state="active" />)
    // The default token-gradient fallback layer is present.
    expect(container.querySelector('.hero-visual-frame__fallback')).not.toBeNull()
  })

  it('exposes the current state via data-hero-state', () => {
    const { container } = render(<HeroVisualFrame state="error" />)
    expect(container.querySelector('.hero-visual-frame')).toHaveAttribute('data-hero-state', 'error')
  })
})

describe('HeroVisualFrame — surface contract', () => {
  it('always carries the solid .hero-visual-frame class and no blur utility', () => {
    const { container } = render(<HeroVisualFrame state="idle" />)
    const frame = container.querySelector('.hero-visual-frame') as HTMLElement
    expect(frame).not.toBeNull()
    // Contract: the hero frame never receives progressive blur.
    expect(frame.className).not.toMatch(/backdrop-blur|backdrop-filter/)
  })
})

describe('HeroVisualFrame — accessibility', () => {
  it('is decorative (aria-hidden) by default', () => {
    const { container } = render(<HeroVisualFrame state="fallback" />)
    const frame = container.querySelector('.hero-visual-frame') as HTMLElement
    expect(frame).toHaveAttribute('aria-hidden', 'true')
    expect(frame).toHaveAttribute('role', 'presentation')
  })

  it('becomes a labelled image when a label is supplied', () => {
    render(<HeroVisualFrame state="active" active={<div />} label="Espresso pour" />)
    const img = screen.getByRole('img', { name: 'Espresso pour' })
    expect(img).toHaveClass('hero-visual-frame')
    expect(img).not.toHaveAttribute('aria-hidden')
  })
})
