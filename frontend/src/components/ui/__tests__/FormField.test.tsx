/**
 * T015 — Unit tests for FormField.tsx
 *
 * Covers: label rendering, error element (role=alert + aria-live), required asterisk
 * (aria-hidden), errorId prop, hint text, no error when error=null.
 *
 * Intent-verifying per Rule 9 — each assertion catches a specific AC regression.
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import FormField from '../FormField'

describe('FormField — label rendering', () => {
  it('renders the label text', () => {
    render(
      <FormField label="Dose (g)" htmlFor="dose">
        <input id="dose" />
      </FormField>,
    )
    expect(screen.getByText('Dose (g)')).toBeInTheDocument()
  })

  it('associates label with input via htmlFor', () => {
    render(
      <FormField label="Bag" htmlFor="bag-input">
        <input id="bag-input" />
      </FormField>,
    )
    expect(screen.getByLabelText('Bag')).toBeInTheDocument()
  })
})

describe('FormField — error element', () => {
  it('renders error message when error prop is set', () => {
    render(
      <FormField label="Dose" error="Dose is required">
        <input />
      </FormField>,
    )
    expect(screen.getByText('Dose is required')).toBeInTheDocument()
  })

  it('error element has role="alert" (US8 AC — screen-reader announcement)', () => {
    render(
      <FormField label="Dose" error="Dose is required">
        <input />
      </FormField>,
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('error element has aria-live="polite" (US8 AC — live-region)', () => {
    render(
      <FormField label="Dose" error="Dose is required">
        <input />
      </FormField>,
    )
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'polite')
  })

  it('error=null renders NO error element in the DOM', () => {
    render(
      <FormField label="Dose" error={null}>
        <input />
      </FormField>,
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('error=undefined renders NO error element in the DOM', () => {
    render(
      <FormField label="Dose">
        <input />
      </FormField>,
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('FormField — errorId prop', () => {
  it('errorId sets the id attribute on the error element (enables aria-describedby wiring)', () => {
    render(
      <FormField label="Dose" error="Dose is required" errorId="dose-error">
        <input />
      </FormField>,
    )
    const errorEl = screen.getByRole('alert')
    expect(errorEl).toHaveAttribute('id', 'dose-error')
  })
})

describe('FormField — required asterisk', () => {
  it('required=true renders an asterisk with aria-hidden="true" (hidden from screen readers)', () => {
    const { container } = render(
      <FormField label="Bag" required>
        <input />
      </FormField>,
    )
    const asterisk = container.querySelector('[aria-hidden="true"]')
    expect(asterisk).not.toBeNull()
    expect(asterisk).toHaveTextContent('*')
  })

  it('required=false (default) renders no asterisk', () => {
    const { container } = render(
      <FormField label="Bag">
        <input />
      </FormField>,
    )
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull()
  })
})

describe('FormField — hint text', () => {
  it('hint prop renders hint text when provided', () => {
    render(
      <FormField label="Dose" hint="in grams">
        <input />
      </FormField>,
    )
    expect(screen.getByText('(in grams)')).toBeInTheDocument()
  })

  it('no hint text when hint is not provided', () => {
    render(
      <FormField label="Dose">
        <input />
      </FormField>,
    )
    expect(screen.queryByText(/\(/)).not.toBeInTheDocument()
  })
})
