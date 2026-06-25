import { render, fireEvent, act, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import CompassChart from './CompassChart'

describe('CompassChart', () => {
  it('renders 9 grid-select zones over a continuous gradient matrix', () => {
    render(<CompassChart />)
    expect(screen.getAllByRole('gridcell')).toHaveLength(9)
    expect(screen.getByTestId('compass-gradient-matrix')).toBeInTheDocument()
    expect(document.querySelector('svg')).toBeNull()
  })

  it('all 9 taste labels are present and clickable', () => {
    const handler = vi.fn()
    render(<CompassChart onSelectZone={handler} />)
    const expected = [
      'Weak & bitter', 'Bitter', 'Harsh & bitter',
      'Weak & sweet', 'Sweet & balanced', 'Bitter & astringent',
      'Weak & sour', 'Sour', 'Astringent & sour',
    ]

    expected.forEach(taste => {
      const cell = screen.getByRole('gridcell', { name: new RegExp(`^${taste.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')},`, 'i') })
      fireEvent.click(cell)
    })

    expect(handler).toHaveBeenCalledTimes(9)
    expected.forEach(taste => expect(handler).toHaveBeenCalledWith(taste))
  })

  it('keyboard moves and selects zones from the unified grid', () => {
    const handler = vi.fn()
    render(<CompassChart onSelectZone={handler} />)
    const centreCell = screen.getByRole('gridcell', { name: /Sweet & balanced/i })

    act(() => {
      centreCell.focus()
      fireEvent.keyDown(centreCell, { key: 'ArrowRight' })
    })
    const rightCell = screen.getByRole('gridcell', { name: /Bitter & astringent/i })
    expect(rightCell).toHaveFocus()

    act(() => {
      fireEvent.keyDown(rightCell, { key: 'Enter' })
    })
    expect(handler).toHaveBeenCalledWith('Bitter & astringent')
  })

  it('marks selected taste with a cyan badge and selected state', () => {
    render(<CompassChart selectedTaste="Bitter" />)
    const bitter = screen.getByRole('gridcell', { name: /^Bitter, selected as your taste/i })
    expect(bitter).toHaveAttribute('data-selected', 'true')
    expect(bitter).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Taste')).toBeInTheDocument()
  })

  it('positions the recipe marker for a 1:2 shot inside the centre column', () => {
    render(<CompassChart doseG={18} yieldG={36} timeSec={30} />)
    const marker = document.querySelector<HTMLElement>('.kk-compass-chart__recipe-marker-wrap')
    expect(marker).not.toBeNull()
    expect(marker!.style.left).toBe('50%')
    expect(screen.getByText('Recipe')).toBeInTheDocument()
  })

  it('single basket 1:2 shot also lands in centre column, not absolute-yield left', () => {
    render(<CompassChart doseG={9} yieldG={18} timeSec={30} />)
    const marker = document.querySelector<HTMLElement>('.kk-compass-chart__recipe-marker-wrap')
    expect(marker).not.toBeNull()
    expect(marker!.style.left).toBe('50%')
  })

  it('clamps recipe marker at axis boundary when ratio exceeds max', () => {
    render(<CompassChart doseG={18} yieldG={65} timeSec={30} />)
    const marker = document.querySelector<HTMLElement>('.kk-compass-chart__recipe-marker-wrap')
    expect(marker).not.toBeNull()
    expect(marker!.style.left).toBe('100%')
  })

  it('null-dose fallback renders without a recipe marker', () => {
    expect(() => render(<CompassChart yieldG={36} timeSec={30} />)).not.toThrow()
    expect(document.querySelector('.kk-compass-chart__recipe-marker-wrap')).toBeNull()
    expect(screen.getAllByText(/add dose/i).length).toBeGreaterThanOrEqual(1)
  })

  it('guidance helper prompts for dose and yield before enough data exists', () => {
    render(<CompassChart onSelectZone={() => {}} />)
    const liveRegion = document.querySelector('[aria-live="polite"]')
    expect(liveRegion).not.toBeNull()
    expect(liveRegion!.textContent).toMatch(/enter dose and yield/i)
  })

  it('guidance text is rendered when dot lands in Sweet & balanced zone', () => {
    render(<CompassChart doseG={18} yieldG={36} timeSec={35} onSelectZone={() => {}} />)
    const liveRegion = document.querySelector('[aria-live="polite"]')
    expect(liveRegion).not.toBeNull()
    expect(liveRegion!.textContent).toMatch(/ideal extraction/i)
  })

  it('guidance on selected taste works without a live recipe marker', () => {
    render(<CompassChart selectedTaste="Sour" />)
    const liveRegion = document.querySelector('[aria-live="polite"]')
    expect(liveRegion).not.toBeNull()
    expect(liveRegion!.textContent).toMatch(/under-extracted/i)
  })

  it('uses accessible cell labels for recipe and taste states', () => {
    render(<CompassChart doseG={18} yieldG={41.4} timeSec={20} selectedTaste="Weak & sour" />)
    expect(screen.getByRole('gridcell', { name: /Sour, not selected as your taste, recipe diagnosis yes/i })).toBeInTheDocument()
    expect(screen.getByRole('gridcell', { name: /Weak & sour, selected as your taste, recipe diagnosis no/i })).toBeInTheDocument()
  })
})
