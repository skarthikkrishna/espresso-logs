/**
 * T006 — KaapiAmbientLayer: shared, non-interactive, always-painted ambient.
 *
 * jsdom has no WebGL, so `useWebGLSupport` reports unsupported and the layer
 * renders ONLY its static token-gradient fallback — exactly the degraded path that
 * must never be blank. This verifies the contract: aria-hidden, non-interactive,
 * deepest layer, non-empty static fallback, and no canvas when WebGL is absent.
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

  it('renders no WebGL canvas when WebGL is unavailable (jsdom)', () => {
    render(<KaapiAmbientLayer />)
    const layer = screen.getByTestId('kaapi-ambient')
    expect(layer.querySelector('canvas')).toBeNull()
  })
})
