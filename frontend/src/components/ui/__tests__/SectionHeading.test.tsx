/**
 * T016 — Unit tests for SectionHeading.tsx
 *
 * Covers: title renders as h2, actions slot renders.
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import SectionHeading from '../SectionHeading'

describe('SectionHeading — title', () => {
  it('renders title as an h2 element', () => {
    render(<SectionHeading title="Advanced options" />)
    expect(screen.getByRole('heading', { level: 2, name: 'Advanced options' })).toBeInTheDocument()
  })
})

describe('SectionHeading — actions slot', () => {
  it('renders actions node when provided', () => {
    render(
      <SectionHeading
        title="Advanced options"
        actions={<button type="button">Reset</button>}
      />,
    )
    expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument()
  })

  it('does not render an extra element when actions not provided', () => {
    const { container } = render(<SectionHeading title="Advanced options" />)
    expect(container.querySelector('button')).toBeNull()
  })
})
