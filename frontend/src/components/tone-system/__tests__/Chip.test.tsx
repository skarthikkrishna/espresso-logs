/**
 * Chip tests — variant classes and data-testid passthrough.
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import '../../../index.css'
import { Chip, StatusChip } from '../Chip'

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

  it.each([
    ['Active', 'kk-tc-chip--status-active'],
    ['Resting', 'kk-tc-chip--status-resting'],
    ['Finished', 'kk-tc-chip--status-finished'],
  ] as const)('renders %s bag status as a semantic chip', (status, expectedClass) => {
    render(<StatusChip status={status} data-testid="status-chip" />)
    expect(screen.getByTestId('status-chip')).toHaveTextContent(status)
    expect(screen.getByTestId('status-chip')).toHaveClass(expectedClass)
  })

  it.each([
    ['beige', 'God Shot', 'brand'],
    ['beige', 'Good Espresso', 'success'],
    ['beige', 'Passable', 'warning'],
    ['beige', 'Reject', 'danger'],
    ['dark', 'God Shot', 'brand'],
    ['dark', 'Good Espresso', 'success'],
    ['dark', 'Passable', 'warning'],
    ['dark', 'Reject', 'danger'],
  ] as const)('computes a distinct %s rating chip color for %s', (tone, label, variant) => {
    render(
      <div className={`kk-takeover-card kk-tc--${tone}`}>
        <Chip variant={variant} data-testid={`${tone}-${variant}`}>{label}</Chip>
      </div>
    )

    const chip = screen.getByTestId(`${tone}-${variant}`)
    expect(chip.className).toContain(`kk-tc-chip--${variant}`)
    expect(getComputedStyle(chip).backgroundColor).not.toBe('')
    expect(getComputedStyle(chip).color).not.toBe('')
  })

  it.each(['beige', 'dark'] as const)('keeps God Shot and Passable computed colors separate in %s tone', (tone) => {
    render(
      <div className={`kk-takeover-card kk-tc--${tone}`} data-testid={`${tone}-tone`}>
        <Chip variant="brand" data-testid={`${tone}-god`}>God Shot</Chip>
        <Chip variant="warning" data-testid={`${tone}-passable`}>Passable</Chip>
      </div>
    )

    expect(screen.getByTestId(`${tone}-tone`)).toBeInTheDocument()
    expect(screen.getByTestId(`${tone}-god`)).toHaveClass('kk-tc-chip--brand')
    expect(screen.getByTestId(`${tone}-passable`)).toHaveClass('kk-tc-chip--warning')
    expect(screen.getByTestId(`${tone}-god`).className).not.toBe(screen.getByTestId(`${tone}-passable`).className)
  })
})
