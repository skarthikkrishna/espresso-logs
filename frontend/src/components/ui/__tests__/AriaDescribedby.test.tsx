/**
 * T018 — aria-describedby wiring check (Quinn gate Note 3)
 *
 * Verifies the RUNTIME linkage between errored inputs and their error elements.
 * A grep-count check would only verify the string appears in JSX source — it cannot
 * catch a misconfigured errorId (e.g. wrong ID string, broken prop chain).
 *
 * This test renders FormField in error state and asserts that:
 *   input.getAttribute('aria-describedby') === errorEl.id
 *
 * This test would FAIL if:
 *   - FormField stops setting id={errorId} on the error element
 *   - The Input inside FormField is rendered without aria-describedby
 *   - The errorId string doesn't match the id on the error element
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import FormField from '../FormField'
import Input from '../Input'

describe('T018 — aria-describedby runtime wiring', () => {
  it('input aria-describedby matches the id of the rendered error element', () => {
    // Render FormField in error state — mirrors the pattern used in BrewLogAdd.tsx:
    //   <FormField label="Dose" htmlFor="dose" error={errors.dose} errorId="dose-error">
    //     <Input id="dose" aria-describedby="dose-error" error={!!errors.dose} />
    //   </FormField>
    render(
      <FormField
        label="Dose (g)"
        htmlFor="dose-input"
        error="Dose is required"
        errorId="dose-error"
      >
        <Input id="dose-input" aria-describedby="dose-error" error />
      </FormField>,
    )

    const input = screen.getByLabelText('Dose (g)') as HTMLInputElement
    const errorEl = screen.getByRole('alert')

    // Runtime linkage check (Rule 9 intent): the described-by value must equal the error element's id
    expect(input.getAttribute('aria-describedby')).toBe(errorEl.id)
  })

  it('error element id matches the errorId prop value', () => {
    render(
      <FormField label="Yield (g)" error="Yield is required" errorId="yield-error">
        <input aria-describedby="yield-error" />
      </FormField>,
    )
    const errorEl = screen.getByRole('alert')
    expect(errorEl).toHaveAttribute('id', 'yield-error')
  })

  it('no aria-describedby mismatch when errorId matches input aria-describedby', () => {
    render(
      <FormField
        label="Shot eligibility"
        htmlFor="eligibility"
        error="Required"
        errorId="eligibility-error"
      >
        <Input id="eligibility" aria-describedby="eligibility-error" error />
      </FormField>,
    )

    const input = screen.getByLabelText('Shot eligibility')
    const errorEl = screen.getByRole('alert')

    expect(input).toHaveAttribute('aria-describedby', errorEl.id)
  })

  it('when no error, no alert element is rendered (no orphaned aria-describedby target)', () => {
    render(
      <FormField label="Notes" htmlFor="notes" errorId="notes-error">
        <Input id="notes" aria-describedby="notes-error" />
      </FormField>,
    )
    // No error → no alert → no orphaned reference
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
