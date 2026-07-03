/**
 * ToneInput tests — label association, error display, aria attributes.
 */
import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ToneInput } from '../ToneInput'

describe('ToneInput', () => {
  it('renders the label text', () => {
    render(<ToneInput id="test-input" label="Taste summary" />)
    expect(screen.getByText('Taste summary')).toBeInTheDocument()
  })

  it('associates label with input via htmlFor/id (getByLabelText)', () => {
    render(<ToneInput id="test-input" label="Taste summary" />)
    const input = screen.getByLabelText('Taste summary')
    expect(input).toBeInstanceOf(HTMLInputElement)
  })

  it('renders error message with role="alert"', () => {
    render(<ToneInput id="test-input" label="Taste summary" error="Field is required" errorId="test-error" />)
    const error = screen.getByRole('alert')
    expect(error).toHaveTextContent('Field is required')
  })

  it('renders no error element when error is null', () => {
    render(<ToneInput id="test-input" label="Taste summary" error={null} />)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('sets errorId on the error paragraph', () => {
    render(<ToneInput id="test-input" label="Taste summary" error="Required" errorId="my-error" />)
    expect(document.getElementById('my-error')).toHaveTextContent('Required')
  })

  it('forwards ref to the input element', () => {
    const ref = createRef<HTMLInputElement>()
    render(<ToneInput id="test-input" label="Taste summary" ref={ref} />)
    expect(ref.current).toBeInstanceOf(HTMLInputElement)
  })

  it('passes input HTML attributes through', () => {
    render(<ToneInput id="test-input" label="Taste summary" type="date" data-testid="date-input" />)
    const input = screen.getByTestId('date-input')
    expect(input).toHaveAttribute('type', 'date')
  })
})
