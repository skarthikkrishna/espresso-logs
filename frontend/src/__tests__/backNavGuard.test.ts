import { describe, it, expect } from 'vitest'

// Mirrors the guard logic in BrewLogDetail.tsx
function resolveBackTarget(backUrl: string | null | undefined, fallback = '/brew-log'): string {
  if (!backUrl) return fallback
  if (backUrl.startsWith('/') && !backUrl.startsWith('//')) return backUrl
  return fallback
}

describe('BrewLogDetail back-nav guard', () => {
  it('accepts a valid root-relative path', () => {
    expect(resolveBackTarget('/catalog/CAT001')).toBe('/catalog/CAT001')
  })
  it('uses fallback when param is null', () => {
    expect(resolveBackTarget(null)).toBe('/brew-log')
  })
  it('uses fallback for an absolute external URL', () => {
    expect(resolveBackTarget('https://evil.com')).toBe('/brew-log')
  })
  it('uses fallback for a protocol-relative URL (//evil.com bypass attempt)', () => {
    expect(resolveBackTarget('//evil.com')).toBe('/brew-log')
  })
  it('uses fallback for empty string', () => {
    expect(resolveBackTarget('')).toBe('/brew-log')
  })
  it('accepts a nested catalog path', () => {
    expect(resolveBackTarget('/catalog/abc-123')).toBe('/catalog/abc-123')
  })
})
