/**
 * T004 — Unit tests for Badge.tsx (restrained semantic Badge).
 *
 * Covers: default (brand+soft) reproduces the original amber chip so existing
 * usages are unchanged; sparse semantic tones; soft vs solid emphasis; the
 * icon slot renders aria-hidden and before the label (method-before-colour).
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Badge from '../Badge'

describe('Badge — default (brand + soft) is unchanged', () => {
  it('renders the amber brand chip classes by default', () => {
    render(<Badge>Light</Badge>)
    const badge = screen.getByText('Light')
    // Original amber chip tokens — guards against an accidental default-tone change.
    expect(badge).toHaveClass('border-amber-400/25')
    expect(badge).toHaveClass('bg-amber-500/10')
    expect(badge).toHaveClass('text-amber-100')
    expect(badge).toHaveClass('uppercase')
    expect(badge).toHaveClass('rounded-[var(--bevel-radius)]')
  })

  it('merges a custom className (e.g. layout margin) onto the chip', () => {
    render(<Badge className="mt-3">Medium</Badge>)
    expect(screen.getByText('Medium')).toHaveClass('mt-3')
  })
})

describe('Badge — semantic tones (restrained)', () => {
  it('info tone uses cool cyan soft classes, not amber', () => {
    render(<Badge tone="info">Info</Badge>)
    const badge = screen.getByText('Info')
    expect(badge).toHaveClass('bg-cyan-400/10')
    expect(badge).not.toHaveClass('bg-amber-500/10')
  })

  it('danger tone uses rose soft classes', () => {
    render(<Badge tone="danger">Stale</Badge>)
    expect(screen.getByText('Stale')).toHaveClass('bg-rose-400/10')
  })
})

describe('Badge — emphasis', () => {
  it('solid emphasis switches to a filled, transparent-border chip', () => {
    render(<Badge tone="brand" emphasis="solid">Active</Badge>)
    const badge = screen.getByText('Active')
    expect(badge).toHaveClass('bg-amber-700')
    expect(badge).toHaveClass('border-transparent')
  })
})

describe('Badge — icon slot (method-before-colour)', () => {
  it('renders an aria-hidden icon wrapper before the label', () => {
    render(<Badge icon={<svg data-testid="ico" />}>Espresso</Badge>)
    const ico = screen.getByTestId('ico')
    expect(ico).toBeInTheDocument()
    // Wrapper carries aria-hidden so the icon is decorative, label carries meaning.
    expect(ico.parentElement).toHaveAttribute('aria-hidden', 'true')
  })

  it('omits the icon wrapper when no icon is provided', () => {
    const { container } = render(<Badge>No icon</Badge>)
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull()
  })
})
