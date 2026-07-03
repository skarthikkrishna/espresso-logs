/**
 * T005 — Unit tests for LayerTransition.tsx
 *
 * Covers: children render, className passthrough, focus handoff (focusOnEnter sets a
 * focusable container and moves focus into it), and the no-focus default. The GSAP
 * enter runs through useGSAP; these tests assert the DOM/a11y contract rather than
 * animated values.
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import LayerTransition from '../LayerTransition'

describe('LayerTransition — rendering', () => {
  it('renders its children', () => {
    render(
      <LayerTransition>
        <p>Route content</p>
      </LayerTransition>,
    )
    expect(screen.getByText('Route content')).toBeInTheDocument()
  })

  it('merges a custom className onto the layer wrapper', () => {
    const { container } = render(<LayerTransition className="my-layer">x</LayerTransition>)
    expect(container.firstChild).toHaveClass('my-layer')
    expect(container.firstChild).toHaveClass('outline-none')
  })
})

describe('LayerTransition — focus handoff', () => {
  it('makes the layer focusable and moves focus into it when focusOnEnter is set', () => {
    const { container } = render(
      <LayerTransition focusOnEnter transitionKey="/brew-log">
        <h1>Brew log</h1>
      </LayerTransition>,
    )
    const layer = container.firstChild as HTMLElement
    expect(layer).toHaveAttribute('tabindex', '-1')
    expect(document.activeElement).toBe(layer)
  })

  it('does not steal focus or add a tabindex by default', () => {
    const { container } = render(<LayerTransition>x</LayerTransition>)
    const layer = container.firstChild as HTMLElement
    expect(layer).not.toHaveAttribute('tabindex')
    expect(document.activeElement).not.toBe(layer)
  })
})

describe('LayerTransition — variants', () => {
  it.each(['route', 'modal', 'section', 'side'] as const)('renders without error for the %s variant', (variant) => {
    render(
      <LayerTransition variant={variant}>
        <span>content</span>
      </LayerTransition>,
    )
    expect(screen.getByText('content')).toBeInTheDocument()
  })
})
