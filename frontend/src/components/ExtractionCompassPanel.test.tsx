import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import ExtractionCompassPanel from './ExtractionCompassPanel'
import { ToneProvider } from '../contexts/ToneContext'

function renderCompassPanel(ui: ReactElement) {
  return render(<ToneProvider>{ui}</ToneProvider>)
}

describe('ExtractionCompassPanel', () => {
  it('uses the GSAP-enhanced SVG compass by default and parks the 3D instrument', () => {
    renderCompassPanel(
      <ExtractionCompassPanel
        doseG={18}
        yieldG={36}
        timeSec={35}
      />,
    )

    expect(screen.queryByTestId('compass-3d-instrument')).not.toBeInTheDocument()
    expect(document.querySelector('.kk-compass-chart__svg')).not.toBeNull()
    expect(screen.getByTestId('extraction-readout')).toBeInTheDocument()
  })

  it('falls back to the SVG compass without WebGL and keeps accessible readout content', () => {
    renderCompassPanel(
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

  it('selects subjective taste directly on the compass grid by pointer and keyboard', () => {
    const onSelectTaste = vi.fn()
    renderCompassPanel(<ExtractionCompassPanel onSelectTaste={onSelectTaste} forceSvgFallback />)

    expect(document.querySelector('.kk-compass-zone-selector')).toBeNull()

    const sourButton = screen.getByRole('gridcell', { name: /^Sour, not selected as your taste/i })
    fireEvent.click(sourButton)
    expect(onSelectTaste).toHaveBeenCalledWith('Sour')

    fireEvent.keyDown(sourButton, { key: 'ArrowRight' })
    expect(screen.getByRole('gridcell', { name: /Astringent & sour/i })).toHaveFocus()
  })

  it('exposes a clear action for the subjective taste note', () => {
    const onSelectTaste = vi.fn()
    renderCompassPanel(
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
