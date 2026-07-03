/**
 * T005 — Unit tests for ActionExpander.tsx
 *
 * Covers: aria-expanded/aria-controls wiring, More/Fewer label toggle from the copy
 * registry, toggle callback, and 44×44 minimum target.
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ActionExpander from '../ActionExpander'
import { COPY } from '../../../copy'

describe('ActionExpander — disclosure semantics', () => {
  it('wires aria-expanded and aria-controls', () => {
    render(<ActionExpander expanded={false} onToggle={() => {}} controlsId="extra-fields" />)
    const trigger = screen.getByRole('button')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveAttribute('aria-controls', 'extra-fields')
  })

  it('reflects the expanded state', () => {
    render(<ActionExpander expanded onToggle={() => {}} controlsId="extra-fields" />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true')
  })
})

describe('ActionExpander — labels from registry', () => {
  it('shows the "show more" label when collapsed', () => {
    render(<ActionExpander expanded={false} onToggle={() => {}} controlsId="x" />)
    expect(screen.getByRole('button')).toHaveTextContent(COPY.expander.showMore)
  })

  it('shows the "show fewer" label when expanded', () => {
    render(<ActionExpander expanded onToggle={() => {}} controlsId="x" />)
    expect(screen.getByRole('button')).toHaveTextContent(COPY.expander.showFewer)
  })
})

describe('ActionExpander — interaction and targets', () => {
  it('calls onToggle when activated', () => {
    const onToggle = vi.fn()
    render(<ActionExpander expanded={false} onToggle={onToggle} controlsId="x" />)
    fireEvent.click(screen.getByRole('button'))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('applies 44×44 minimum target classes', () => {
    render(<ActionExpander expanded={false} onToggle={() => {}} controlsId="x" />)
    const trigger = screen.getByRole('button')
    expect(trigger).toHaveClass('min-h-[2.75rem]')
    expect(trigger).toHaveClass('min-w-[2.75rem]')
  })
})
