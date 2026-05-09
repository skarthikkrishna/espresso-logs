/**
 * T012 — Unit tests for frontend/src/utils/basketDefaults.ts
 *
 * 7 tests covering all branches of getBasketDefaults():
 *   - Known basket types (IMS, Single Shot, Crema) return correct profiles
 *   - Unknown basket type returns null
 *   - Priority order: IMS wins when name contains both 'IMS' and 'single shot'
 *
 * Basket profile values from basketDefaults.ts BASKET_PROFILES:
 *   IMS             → { dose_in_g: 18, yield_out_g: 37, grind_setting: 10.5 }
 *   single shot     → { dose_in_g: 9,  yield_out_g: 18, grind_setting: 13   }
 *   crema 54mm ...  → { dose_in_g: 17, yield_out_g: 36, grind_setting: 14   }
 */

import { describe, it, expect } from 'vitest'
import { getBasketDefaults } from './basketDefaults'

describe('getBasketDefaults', () => {
  // ── Test 1: returns a profile for a known IMS basket ────────────────────
  it('returns a non-null profile for an IMS basket name', () => {
    const result = getBasketDefaults('IMS Basket')
    expect(result).not.toBeNull()
  })

  // ── Test 2: correct dose_in_g for IMS ───────────────────────────────────
  it('returns dose_in_g = 18 for IMS basket', () => {
    const result = getBasketDefaults('IMS Basket')
    expect(result?.dose_in_g).toBe(18)
  })

  // ── Test 3: correct yield_out_g for IMS ─────────────────────────────────
  it('returns yield_out_g = 37 for IMS basket (case-insensitive substring)', () => {
    // 'VST IMS 20g' exercises case-insensitive substring matching
    const result = getBasketDefaults('VST IMS 20g')
    expect(result?.yield_out_g).toBe(37)
  })

  // ── Test 4: correct grind_setting for IMS ───────────────────────────────
  it('returns grind_setting = 10.5 for IMS basket', () => {
    const result = getBasketDefaults('IMS Precision Filter')
    expect(result?.grind_setting).toBe(10.5)
  })

  // ── Test 5: returns a profile for Single Shot basket ────────────────────
  it('returns correct profile for Single Shot basket', () => {
    const result = getBasketDefaults('Single Shot Basket')
    expect(result).toEqual({ dose_in_g: 9, yield_out_g: 18, grind_setting: 13 })
  })

  // ── Test 6: returns a profile for Crema basket ──────────────────────────
  it('returns correct profile for Crema 54mm Double Shot basket', () => {
    const result = getBasketDefaults('Crema 54mm Double Shot Basket')
    expect(result).toEqual({ dose_in_g: 17, yield_out_g: 36, grind_setting: 14 })
  })

  // ── Test 7: returns null for an unknown basket type ─────────────────────
  it('returns null for an unknown basket type', () => {
    expect(getBasketDefaults('Unknown Basket')).toBeNull()
    expect(getBasketDefaults('')).toBeNull()
  })
})

// ── Priority order test: IMS wins over single shot when both present ──────
describe('getBasketDefaults priority order', () => {
  it('IMS keyword wins when basket name contains both IMS and single shot', () => {
    // Demonstrates BASKET_PROFILES is checked in priority order (IMS first)
    const result = getBasketDefaults('IMS single shot filter')
    expect(result).not.toBeNull()
    expect(result?.dose_in_g).toBe(18)   // IMS value, not Single Shot (9)
    expect(result?.yield_out_g).toBe(37) // IMS value, not Single Shot (18)
  })
})
