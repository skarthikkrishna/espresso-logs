/**
 * spec-043 T002 — copy registry tests.
 *
 * Locks the operator-owned labels, asserts Option D (no dashboard subtitle), and
 * proves the forbidden dashboard narration strings are (a) not approved copy and
 * (b) caught by the audit when present in source — i.e. the negative fixtures.
 */

import { describe, it, expect } from 'vitest'
import {
  APPROVED_COPY,
  DASHBOARD_SUBTITLE,
  FORBIDDEN_DASHBOARD_COPY,
  LOCKED_LABELS,
  isApprovedCopy,
} from '../registry'
import { auditCopySource } from '../audit'

describe('LOCKED_LABELS', () => {
  it('locks Home, Log a shot, and Delete to their exact wording', () => {
    expect(LOCKED_LABELS.home).toBe('Home')
    expect(LOCKED_LABELS.logAShot).toBe('Log a shot')
    expect(LOCKED_LABELS.delete).toBe('Delete')
  })

  it('exposes locked labels through APPROVED_COPY', () => {
    expect(isApprovedCopy('Home')).toBe(true)
    expect(isApprovedCopy('Log a shot')).toBe(true)
    expect(isApprovedCopy('Delete')).toBe(true)
  })
})

describe('dashboard subtitle (Option D)', () => {
  it('has no approved subtitle string', () => {
    expect(DASHBOARD_SUBTITLE).toBeNull()
  })
})

describe('FORBIDDEN_DASHBOARD_COPY (negative fixtures)', () => {
  it('is never part of the approved allowlist', () => {
    for (const forbidden of FORBIDDEN_DASHBOARD_COPY) {
      expect(APPROVED_COPY.has(forbidden)).toBe(false)
    }
  })

  it('is flagged by the audit when present in source', () => {
    for (const forbidden of FORBIDDEN_DASHBOARD_COPY) {
      const source = `export const A = () => <p>${forbidden}</p>`
      const flagged = auditCopySource('forbidden.tsx', source, APPROVED_COPY).map((v) => v.text)
      expect(flagged).toContain(forbidden)
    }
  })
})
