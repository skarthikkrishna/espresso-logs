/**
 * T016 — Unit tests for GlassCard.tsx
 *
 * Covers: glass-card + card-bevel classes present on any render (Note 5 — intent check),
 * all 4 padding variants, interactive prop behavior, forwardRef.
 */

import React, { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import GlassCard from '../GlassCard'

describe('GlassCard — core token classes (Note 5)', () => {
  it('always applies glass-card and card-bevel classes regardless of props', () => {
    // Note 5: this assertion fails if the token classes are accidentally removed — the AC intent
    const { container } = render(<GlassCard>content</GlassCard>)
    expect(container.firstChild).toHaveClass('glass-card')
    expect(container.firstChild).toHaveClass('card-bevel')
  })
})

describe('GlassCard — padding variants', () => {
  it('padding=none adds no padding class', () => {
    const { container } = render(<GlassCard padding="none">x</GlassCard>)
    const div = container.firstChild as HTMLElement
    expect(div).not.toHaveClass('p-3')
    expect(div).not.toHaveClass('p-4')
    expect(div).not.toHaveClass('p-5')
  })

  it('padding=sm adds p-3 class', () => {
    const { container } = render(<GlassCard padding="sm">x</GlassCard>)
    expect(container.firstChild).toHaveClass('p-3')
  })

  it('padding=md (default) adds p-4 class', () => {
    const { container } = render(<GlassCard>x</GlassCard>)
    expect(container.firstChild).toHaveClass('p-4')
  })

  it('padding=lg adds p-5 class', () => {
    const { container } = render(<GlassCard padding="lg">x</GlassCard>)
    expect(container.firstChild).toHaveClass('p-5')
  })
})

describe('GlassCard — interactive prop', () => {
  it('interactive=true adds cursor-pointer class', () => {
    const { container } = render(<GlassCard interactive>x</GlassCard>)
    expect(container.firstChild).toHaveClass('cursor-pointer')
  })

  it('interactive=false (default) does not add cursor-pointer', () => {
    const { container } = render(<GlassCard>x</GlassCard>)
    expect(container.firstChild).not.toHaveClass('cursor-pointer')
  })
})

describe('GlassCard — children and className', () => {
  it('renders children', () => {
    render(<GlassCard>My card content</GlassCard>)
    expect(screen.getByText('My card content')).toBeInTheDocument()
  })

  it('merges className prop with base classes', () => {
    const { container } = render(<GlassCard className="my-custom">x</GlassCard>)
    expect(container.firstChild).toHaveClass('glass-card')
    expect(container.firstChild).toHaveClass('my-custom')
  })
})

describe('GlassCard — forwardRef', () => {
  it('forwards ref to the underlying <div> DOM element', () => {
    const ref = createRef<HTMLDivElement>()
    render(<GlassCard ref={ref}>ref test</GlassCard>)
    expect(ref.current).not.toBeNull()
    expect(ref.current?.tagName).toBe('DIV')
  })
})
