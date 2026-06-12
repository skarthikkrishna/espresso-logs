/**
 * T016 — Unit tests for EmptyState.tsx
 *
 * Covers: title text, icon slot, action slot, description rendering.
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import EmptyState from '../EmptyState'

describe('EmptyState — title', () => {
  it('renders the title text', () => {
    render(<EmptyState title="No shots logged yet" />)
    expect(screen.getByText('No shots logged yet')).toBeInTheDocument()
  })
})

describe('EmptyState — description', () => {
  it('renders description when provided', () => {
    render(
      <EmptyState title="No shots" description="Add your first espresso shot to get started." />,
    )
    expect(
      screen.getByText('Add your first espresso shot to get started.'),
    ).toBeInTheDocument()
  })

  it('does not render description when not provided', () => {
    render(<EmptyState title="No shots" />)
    expect(
      screen.queryByText(/Add your first/),
    ).not.toBeInTheDocument()
  })
})

describe('EmptyState — icon slot', () => {
  it('renders icon node when provided', () => {
    render(
      <EmptyState
        title="No shots"
        icon={<span data-testid="coffee-icon">☕</span>}
      />,
    )
    expect(screen.getByTestId('coffee-icon')).toBeInTheDocument()
  })

  it('does not render icon container when icon not provided', () => {
    const { container } = render(<EmptyState title="No shots" />)
    // The icon wrapper div is only rendered when icon prop is truthy
    expect(container.querySelector('[data-testid]')).toBeNull()
  })
})

describe('EmptyState — action slot', () => {
  it('renders action node when provided', () => {
    render(
      <EmptyState
        title="No shots"
        action={<button type="button">Add shot</button>}
      />,
    )
    expect(screen.getByRole('button', { name: 'Add shot' })).toBeInTheDocument()
  })

  it('does not render action container when action not provided', () => {
    const { container } = render(<EmptyState title="No shots" />)
    expect(container.querySelector('button')).toBeNull()
  })
})
