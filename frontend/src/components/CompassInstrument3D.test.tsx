import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import CompassInstrument3D from './CompassInstrument3D'
import { EXTRACTION_COMPASS_ZONES, type ExtractionCompassViewModel } from '../utils/extractionCompassViewModel'

const useThreeSurfaceMock = vi.hoisted(() => vi.fn(() => ({
  containerRef: { current: null },
  canvasRef: { current: null },
  ready: true,
  webGLSupport: { supported: true, contextType: 'webgl2' },
})))

vi.mock('../lib/motion/useThreeSurface', () => ({
  useThreeSurface: useThreeSurfaceMock,
}))

const model: ExtractionCompassViewModel = {
  ratio: 2,
  ratioText: '1:2.0',
  timeSec: 30,
  computedTaste: 'Sweet & balanced',
  selectedTaste: 'Sour',
  guidanceText: 'Ideal extraction — ratio 1.7–2.3, time 25–35 s. Keep these parameters.',
  primaryGuidanceText: 'At 1:2.0, the recipe lands in Sweet & balanced and your taste is Sour — grind finer for the next shot.',
  actionText: 'grind finer',
  personalNote: null,
  missingInputState: null,
  timeOutOfRange: null,
  timeMin: 15,
  timeMax: 60,
}

describe('CompassInstrument3D', () => {
  it('marks the canvas decorative and mirrors zone semantics in DOM controls', () => {
    render(
      <CompassInstrument3D
        model={model}
        zones={EXTRACTION_COMPASS_ZONES}
        reducedMotion={false}
        onSelectTaste={() => undefined}
        onContextLost={() => undefined}
      />,
    )

    expect(screen.getByTestId('compass-3d-instrument').querySelector('canvas')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByRole('button', { name: 'Select tasted profile: Sweet & balanced' })).toHaveAttribute('data-computed', 'true')
    expect(screen.getByRole('button', { name: 'Select tasted profile: Sour' })).toHaveAttribute('data-selected', 'true')
  })

  it('disables the animation loop in reduced-motion mode', () => {
    useThreeSurfaceMock.mockClear()

    render(
      <CompassInstrument3D
        model={model}
        zones={EXTRACTION_COMPASS_ZONES}
        reducedMotion
        onSelectTaste={() => undefined}
        onContextLost={() => undefined}
      />,
    )

    expect(useThreeSurfaceMock).toHaveBeenCalledWith(expect.objectContaining({ animate: false }))
  })
})
