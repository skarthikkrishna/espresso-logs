import { describe, expect, it } from 'vitest'
import { buildExtractionCompassViewModel } from './extractionCompassViewModel'

describe('buildExtractionCompassViewModel', () => {
  it('keeps computed diagnosis separate from subjective taste', () => {
    const model = buildExtractionCompassViewModel({
      doseG: 18,
      yieldG: 48,
      timeSec: 35,
      selectedTaste: 'Sweet & balanced',
    })

    expect(model.computedTaste).toBe('Bitter & astringent')
    expect(model.selectedTaste).toBe('Sweet & balanced')
    expect(model.guidanceText).toMatch(/over-extracted/i)
    expect(model.personalNote).toMatch(/parameters suggest bitter & astringent/i)
  })

  it('uses selected taste guidance when recipe inputs are incomplete', () => {
    const model = buildExtractionCompassViewModel({
      selectedTaste: 'Sour',
    })

    expect(model.computedTaste).toBeNull()
    expect(model.selectedTaste).toBe('Sour')
    expect(model.guidanceText).toMatch(/under-extracted/i)
    expect(model.primaryGuidanceText).toMatch(/You tasted Sour — grind finer/i)
  })

  it('ignores unrecognized saved taste strings for zone semantics', () => {
    const model = buildExtractionCompassViewModel({
      selectedTaste: 'Sweet & Balanced',
    })

    expect(model.selectedTaste).toBe('')
  })
})
