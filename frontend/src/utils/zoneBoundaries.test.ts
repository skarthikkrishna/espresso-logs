import { describe, it, expect } from 'vitest'
import { deriveZoneBoundaries } from './zoneBoundaries'

describe('deriveZoneBoundaries', () => {
  it('Bambino Plus + light → Bambino Plus time profile and light ratio profile', () => {
    const result = deriveZoneBoundaries('Bambino Plus', 'light')
    expect(result).toEqual({
      timeMin: 15,
      timeMax: 55,
      ratioInnerThird: 1.8,
      ratioOuterThird: 2.8,
    })
  })

  it('null, null → default boundaries', () => {
    const result = deriveZoneBoundaries(null, null)
    expect(result).toEqual({
      timeMin: 15,
      timeMax: 60,
      ratioInnerThird: 1.67,
      ratioOuterThird: 2.33,
    })
  })

  it('unknown machine + dark → default time profile, dark ratio profile', () => {
    const result = deriveZoneBoundaries('Unknown Machine', 'dark')
    expect(result).toEqual({
      timeMin: 15,
      timeMax: 60,
      ratioInnerThird: 1.4,
      ratioOuterThird: 2.0,
    })
  })

  it('Bambino Plus + LIGHT (uppercase) → same as lowercase light (case-insensitive)', () => {
    const result = deriveZoneBoundaries('Bambino Plus', 'LIGHT')
    expect(result).toEqual({
      timeMin: 15,
      timeMax: 55,
      ratioInnerThird: 1.8,
      ratioOuterThird: 2.8,
    })
  })

  it('no args → default boundaries', () => {
    const result = deriveZoneBoundaries()
    expect(result).toEqual({
      timeMin: 15,
      timeMax: 60,
      ratioInnerThird: 1.67,
      ratioOuterThird: 2.33,
    })
  })

  it('Breville Dual Boiler → uses Breville time profile', () => {
    const result = deriveZoneBoundaries('Breville Dual Boiler', null)
    expect(result.timeMin).toBe(20)
    expect(result.timeMax).toBe(45)
  })

  it('Bambino + medium-dark → Bambino time + medium-dark ratio', () => {
    const result = deriveZoneBoundaries('Bambino', 'medium-dark')
    expect(result.timeMin).toBe(15)
    expect(result.timeMax).toBe(50)
    expect(result.ratioInnerThird).toBe(1.5)
    expect(result.ratioOuterThird).toBe(2.2)
  })
})
