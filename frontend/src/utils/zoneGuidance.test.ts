/**
 * T021 — Unit tests for frontend/src/utils/zoneGuidance.ts
 *
 * 12 tests:
 *   Tests 1–9:  Each of the 9 valid zone taste strings returns a non-null,
 *               non-empty guidance string.
 *   Test 10:    getZoneGuidance(null) returns null  (runtime safety, casted)
 *   Test 11:    getZoneGuidance("") returns null
 *   Test 12:    getZoneGuidance("Nonexistent Zone") returns null
 *
 * Zone taste strings are confirmed from CompassChart.tsx zones array (QA-7):
 *   'Weak & bitter', 'Bitter', 'Harsh & bitter',
 *   'Weak & sweet',  'Sweet & balanced', 'Bitter & astringent',
 *   'Weak & sour',   'Sour',  'Astringent & sour'
 */

import { describe, it, expect } from 'vitest'
import { getZoneGuidance } from './zoneGuidance'

// All 9 confirmed zone taste strings (character-for-character from CompassChart.tsx)
const ALL_ZONE_TASTES = [
  'Weak & bitter',
  'Bitter',
  'Harsh & bitter',
  'Weak & sweet',
  'Sweet & balanced',
  'Bitter & astringent',
  'Weak & sour',
  'Sour',
  'Astringent & sour',
] as const

describe('getZoneGuidance — valid zone tastes (tests 1–9)', () => {
  // ── Tests 1–9: each zone returns a non-null, non-empty guidance string ──
  ALL_ZONE_TASTES.forEach((taste, index) => {
    it(`test ${index + 1}: returns non-null non-empty string for "${taste}"`, () => {
      const result = getZoneGuidance(taste)
      expect(result).not.toBeNull()
      expect(typeof result).toBe('string')
      expect((result as string).length).toBeGreaterThan(0)
    })
  })
})

describe('getZoneGuidance — edge cases (tests 10–12)', () => {
  // ── Test 10: null input returns null (runtime guard) ────────────────────
  it('test 10: returns null for null input', () => {
    // @ts-expect-error — testing JS runtime behaviour with null
    const result = getZoneGuidance(null)
    expect(result).toBeNull()
  })

  // ── Test 11: empty string returns null ──────────────────────────────────
  it('test 11: returns null for empty string', () => {
    expect(getZoneGuidance('')).toBeNull()
  })

  // ── Test 12: unknown taste string returns null ───────────────────────────
  it('test 12: returns null for unrecognised zone taste', () => {
    expect(getZoneGuidance('Nonexistent Zone')).toBeNull()
    expect(getZoneGuidance('sweet & balanced')).toBeNull() // case-sensitive
    expect(getZoneGuidance('Sweet and balanced')).toBeNull() // '&' vs 'and'
  })
})

describe('getZoneGuidance — spot-check correct values', () => {
  it('Sweet & balanced returns the "ideal extraction" message', () => {
    const result = getZoneGuidance('Sweet & balanced')
    expect(result).toMatch(/ideal extraction/i)
  })

  it('Bitter returns an over-extracted message', () => {
    const result = getZoneGuidance('Bitter')
    expect(result).toMatch(/over-extracted/i)
  })

  it('Sour returns an under-extracted message', () => {
    const result = getZoneGuidance('Sour')
    expect(result).toMatch(/under-extracted/i)
  })
})

describe('getZoneGuidance — performance (advisory, T021)', () => {
  /**
   * Advisory test — ZONE_GUIDANCE is a plain object lookup (O(1)).
   * 10,000 calls should complete well within 50 ms even on a cold JIT.
   * Marked with a generous threshold to avoid CI flakiness.
   */
  it('10,000 calls complete in < 50 ms', () => {
    const start = performance.now()
    for (let i = 0; i < 10_000; i++) {
      getZoneGuidance('Sweet & balanced')
    }
    const elapsed = performance.now() - start
    expect(elapsed).toBeLessThan(50)
  })
})
