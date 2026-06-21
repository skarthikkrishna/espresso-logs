/**
 * T006 — KaapiAmbientLayer: shared, non-interactive, always-painted ambient.
 *
 * The animated WebGL canvas is disabled for energy/battery efficiency (Safari
 * flagged the always-on rAF loop as a significant drain). The layer now renders
 * ONLY the static token-gradient — the designed fallback for reduced-motion /
 * no-WebGL — as the permanent ambient visual.
 *
 * Contract: aria-hidden, non-interactive, deepest layer, static gradient always
 * painted, animated canvas never mounted.
 */

import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import KaapiAmbientLayer from '../KaapiAmbientLayer'

describe('KaapiAmbientLayer', () => {
  it('is aria-hidden and non-interactive', () => {
    render(<KaapiAmbientLayer />)
    const layer = screen.getByTestId('kaapi-ambient')
    expect(layer).toHaveAttribute('aria-hidden', 'true')
    expect(layer.className).toContain('pointer-events-none')
    expect(layer.className).toContain('fixed')
    expect(layer.className).toContain('inset-0')
  })

  it('always paints the static token gradient fallback', () => {
    render(<KaapiAmbientLayer />)
    const layer = screen.getByTestId('kaapi-ambient')
    const fallback = layer.firstElementChild as HTMLElement
    expect(fallback).not.toBeNull()
    expect(fallback.style.background).toContain('--kaapi-ambient-static-gradient')
  })

  it('never mounts the animated WebGL canvas (disabled for battery/energy)', () => {
    render(<KaapiAmbientLayer />)
    const layer = screen.getByTestId('kaapi-ambient')
    expect(layer.querySelector('canvas')).toBeNull()
  })
})
