import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ExtractionCompassPanel from './ExtractionCompassPanel'

describe('ExtractionCompassPanel', () => {
  it('falls back to the SVG compass without WebGL and keeps accessible readout content', () => {
    render(
      <ExtractionCompassPanel
        doseG={18}
        yieldG={48}
        timeSec={35}
        selectedTaste="Sweet & balanced"
        forceSvgFallback
      />,
    )

    expect(screen.getByText(/static compass/i)).toBeInTheDocument()
    expect(screen.getByText('Computed from recipe')).toBeInTheDocument()
    expect(screen.getByText('You tasted: Sweet & balanced')).toBeInTheDocument()
    expect(screen.getByText(/Your parameters suggest bitter & astringent/i)).toBeInTheDocument()
  })

  it('provides keyboard-reachable subjective taste controls in fallback mode', () => {
    const onSelectTaste = vi.fn()
    render(<ExtractionCompassPanel onSelectTaste={onSelectTaste} forceSvgFallback />)

    const sourButton = screen.getByRole('button', { name: 'Select tasted profile: Sour' })
    fireEvent.click(sourButton)
    expect(onSelectTaste).toHaveBeenCalledWith('Sour')

    fireEvent.keyDown(sourButton, { key: 'ArrowRight' })
    expect(screen.getByRole('button', { name: 'Select tasted profile: Astringent & sour' })).toHaveFocus()
  })

  it('exposes a clear action for the subjective taste note', () => {
    const onSelectTaste = vi.fn()
    render(
      <ExtractionCompassPanel
        selectedTaste="Sour"
        onSelectTaste={onSelectTaste}
        forceSvgFallback
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Clear taste note' }))
    expect(onSelectTaste).toHaveBeenCalledWith('')
  })
})
