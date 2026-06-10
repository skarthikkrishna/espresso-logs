/**
 * T016 — Unit tests for Attribution.tsx
 *
 * Covers: correct Flaticon URL, target="_blank", rel="noopener noreferrer",
 * attribution text content.
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Attribution from '../Attribution'

describe('Attribution — link safety', () => {
  it('link href points to the correct Flaticon URL', () => {
    render(<Attribution />)
    const link = screen.getByRole('link', { name: /Coffee-shop icons created by Freepik/i })
    expect(link).toHaveAttribute('href', 'https://www.flaticon.com/free-icons/coffee-shop')
  })

  it('link has target="_blank" to open in a new tab', () => {
    render(<Attribution />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('link has rel="noopener noreferrer" for security', () => {
    render(<Attribution />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })
})

describe('Attribution — text content', () => {
  it('attribution text reads "Coffee-shop icons created by Freepik — Flaticon"', () => {
    render(<Attribution />)
    expect(
      screen.getByText(/Coffee-shop icons created by Freepik — Flaticon/i),
    ).toBeInTheDocument()
  })
})
