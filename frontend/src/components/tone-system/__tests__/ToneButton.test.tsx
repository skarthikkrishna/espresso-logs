/**
 * ToneButton tests — variant classes, disabled state, ref forwarding.
 */
import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ToneButton } from '../ToneButton'

describe('ToneButton', () => {
  it('defaults to type="button" to prevent accidental form submission', () => {
    render(<ToneButton>Click</ToneButton>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })

  it('renders "edit" variant with kk-tc-btn--edit class', () => {
    render(<ToneButton variant="edit">Edit</ToneButton>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('kk-tc-btn')
    expect(btn.className).toContain('kk-tc-btn--edit')
  })

  it('renders "danger" variant with kk-tc-btn--danger class', () => {
    render(<ToneButton variant="danger">Delete</ToneButton>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('kk-tc-btn')
    expect(btn.className).toContain('kk-tc-btn--danger')
  })

  it('renders "primary" variant with kk-tc-primary-btn class', () => {
    render(<ToneButton variant="primary">Add</ToneButton>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('kk-tc-primary-btn')
  })

  it('renders "ghost" variant with kk-tc-btn--ghost class', () => {
    render(<ToneButton variant="ghost">Skip</ToneButton>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('kk-tc-btn')
    expect(btn.className).toContain('kk-tc-btn--ghost')
  })

  it('passes disabled state to the button element', () => {
    render(<ToneButton disabled>Disabled</ToneButton>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('forwards ref to the button element', () => {
    const ref = createRef<HTMLButtonElement>()
    render(<ToneButton ref={ref}>Ref test</ToneButton>)
    expect(ref.current).toBeInstanceOf(HTMLButtonElement)
  })

  it('passes additional className alongside variant class', () => {
    render(<ToneButton variant="edit" className="extra-class">Edit</ToneButton>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('kk-tc-btn--edit')
    expect(btn.className).toContain('extra-class')
  })

  it('passes data-testid through to the button', () => {
    render(<ToneButton data-testid="my-btn">Test</ToneButton>)
    expect(screen.getByTestId('my-btn')).toBeInTheDocument()
  })
})
