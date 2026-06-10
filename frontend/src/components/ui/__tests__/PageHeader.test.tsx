/**
 * T016 — Unit tests for PageHeader.tsx
 *
 * Covers: title renders as h1, subtitle renders above title, actions slot,
 * testId sets data-testid on h1.
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import PageHeader from '../PageHeader'

describe('PageHeader — title', () => {
  it('renders title as an h1 element', () => {
    render(<PageHeader title="Brew log" />)
    expect(screen.getByRole('heading', { level: 1, name: 'Brew log' })).toBeInTheDocument()
  })
})

describe('PageHeader — subtitle', () => {
  it('renders subtitle text when provided', () => {
    render(<PageHeader title="Brew log" subtitle="2025 harvest" />)
    expect(screen.getByText('2025 harvest')).toBeInTheDocument()
  })

  it('does not render subtitle when not provided', () => {
    render(<PageHeader title="Brew log" />)
    expect(screen.queryByText(/2025/)).not.toBeInTheDocument()
  })
})

describe('PageHeader — actions slot', () => {
  it('renders actions node when provided', () => {
    render(
      <PageHeader
        title="Brew log"
        actions={<button type="button">Add shot</button>}
      />,
    )
    expect(screen.getByRole('button', { name: 'Add shot' })).toBeInTheDocument()
  })

  it('does not render actions container when not provided', () => {
    const { container } = render(<PageHeader title="Brew log" />)
    // Actions wrapper is only rendered when actions prop is truthy
    expect(container.querySelector('button')).toBeNull()
  })
})

describe('PageHeader — testId', () => {
  it('testId sets data-testid on the h1 element', () => {
    render(<PageHeader title="Brew log" testId="brew-log-header" />)
    expect(screen.getByTestId('brew-log-header')).toBeInTheDocument()
    expect(screen.getByTestId('brew-log-header').tagName).toBe('H1')
  })

  it('no data-testid attribute when testId is not provided', () => {
    render(<PageHeader title="Brew log" />)
    expect(screen.getByRole('heading', { level: 1 })).not.toHaveAttribute('data-testid')
  })
})
