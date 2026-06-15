/**
 * Chip tests — variant classes and data-testid passthrough.
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Chip } from '../Chip'

describe('Chip', () => {
  it('renders children', () => {
    render(<Chip>Good Espresso</Chip>)
    expect(screen.getByText('Good Espresso')).toBeInTheDocument()
  })

  it('applies kk-tc-chip base class always', () => {
    const { container } = render(<Chip>test</Chip>)
    expect(container.firstChild).toHaveClass('kk-tc-chip')
  })

  it('renders "default" variant with no modifier class', () => {
    const { container } = render(<Chip variant="default">test</Chip>)
    const chip = container.firstChild as HTMLElement
    expect(chip.className).toBe('kk-tc-chip')
  })

  it('renders "neutral" variant with no modifier class', () => {
    const { container } = render(<Chip variant="neutral">test</Chip>)
    const chip = container.firstChild as HTMLElement
    expect(chip.className).toBe('kk-tc-chip')
  })

  it('renders "success" variant with correct modifier class', () => {
    const { container } = render(<Chip variant="success">Good Espresso</Chip>)
    const chip = container.firstChild as HTMLElement
    expect(chip.className).toContain('kk-tc-chip--success')
  })

  it('renders "brand" variant with correct modifier class', () => {
    const { container } = render(<Chip variant="brand">God Shot</Chip>)
    const chip = container.firstChild as HTMLElement
    expect(chip.className).toContain('kk-tc-chip--brand')
  })

  it('renders "warning" variant with correct modifier class', () => {
    const { container } = render(<Chip variant="warning">Passable</Chip>)
    const chip = container.firstChild as HTMLElement
    expect(chip.className).toContain('kk-tc-chip--warning')
  })

  it('renders "danger" variant with correct modifier class', () => {
    const { container } = render(<Chip variant="danger">Reject</Chip>)
    const chip = container.firstChild as HTMLElement
    expect(chip.className).toContain('kk-tc-chip--danger')
  })

  it('passes data-testid to the span element', () => {
    render(<Chip data-testid="my-chip">test</Chip>)
    expect(screen.getByTestId('my-chip')).toBeInTheDocument()
  })
})
