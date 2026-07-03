/**
 * RoastChip tests — canonical casing (Principle 7) and class generation.
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { RoastChip } from '../RoastChip'

describe('RoastChip', () => {
  it('renders canonical casing — "Light" not "LIGHT"', () => {
    render(<RoastChip level="Light" />)
    expect(screen.getByText('Light')).toBeInTheDocument()
  })

  it('renders "Light / Medium" with forward-slash spacing intact', () => {
    render(<RoastChip level="Light / Medium" />)
    expect(screen.getByText('Light / Medium')).toBeInTheDocument()
  })

  it('applies roast-specific gradient class for known levels', () => {
    const { container } = render(<RoastChip level="Dark" />)
    const chip = container.firstChild as HTMLElement
    expect(chip.className).toContain('kk-tc-chip--roast')
    expect(chip.className).toContain('kk-tc-chip--roast-dark')
  })

  it('applies only kk-tc-chip for unrecognised level', () => {
    const { container } = render(<RoastChip level="Ultra-light" />)
    const chip = container.firstChild as HTMLElement
    expect(chip.className).toBe('kk-tc-chip')
    expect(chip.className).not.toContain('kk-tc-chip--roast')
  })

  it('renders null when level is null', () => {
    const { container } = render(<RoastChip level={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders null when level is undefined', () => {
    const { container } = render(<RoastChip />)
    expect(container.firstChild).toBeNull()
  })

  it('renders null when level is empty string', () => {
    const { container } = render(<RoastChip level="" />)
    expect(container.firstChild).toBeNull()
  })

  it('does NOT apply text-transform uppercase via class (Principle 7)', () => {
    // The CSS .kk-tc-chip--roast used to have text-transform:uppercase — it was removed.
    // This test ensures the chip element does NOT carry an inline uppercase style.
    const { container } = render(<RoastChip level="Medium" />)
    const chip = container.firstChild as HTMLElement
    expect(chip.style.textTransform).not.toBe('uppercase')
  })
})
