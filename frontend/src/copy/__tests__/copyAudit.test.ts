/**
 * spec-043 T002 — copy allowlist audit tests.
 *
 * Quinn carry-forward note 2 requires both true-positive fixtures (unapproved
 * copy is flagged) and false-positive-exemption fixtures (class names, routes,
 * query keys, enum values, test ids, and data values are never flagged).
 */

import { describe, it, expect } from 'vitest'
import { auditCopySource, isMeaningfulCopy } from '../audit'
import { APPROVED_COPY } from '../registry'

const audit = (source: string) => auditCopySource('fixture.tsx', source, APPROVED_COPY)
const texts = (source: string) => audit(source).map((violation) => violation.text)

describe('auditCopySource — true positives (render sinks must be flagged)', () => {
  it('flags unapproved visible JSX text', () => {
    const result = audit('export const A = () => <p>Brew with intention.</p>')
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ kind: 'jsx-text', text: 'Brew with intention.' })
  })

  it('flags unapproved CTA / button label text', () => {
    // "Save preferences" is intentionally absent from the registry; "Save changes"
    // is now approved copy (EditHardwareModal submit label, spec-043 T018).
    expect(texts('export const A = () => <button>Save preferences</button>')).toContain('Save preferences')
  })

  it('flags unapproved aria-label copy', () => {
    const result = audit('export const A = () => <button aria-label="Dismiss notice" />')
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ kind: 'jsx-attribute', attribute: 'aria-label', text: 'Dismiss notice' })
  })

  it('flags unapproved alt, placeholder, and title copy', () => {
    expect(texts('export const A = () => <img alt="A roasted bean bag" />')).toContain('A roasted bean bag')
    expect(texts('export const A = () => <input placeholder="Search beans" />')).toContain('Search beans')
    expect(texts('export const A = () => <span title="Sourced from roaster" />')).toContain('Sourced from roaster')
  })

  it('flags toast / helper / modal body text rendered as children', () => {
    const source = `export const A = () => (
      <div>
        <p>Bean saved successfully.</p>
        <small>Choose a JPG or PNG file.</small>
      </div>
    )`
    const flagged = texts(source)
    expect(flagged).toContain('Bean saved successfully.')
    expect(flagged).toContain('Choose a JPG or PNG file.')
  })
})

describe('auditCopySource — approved copy passes', () => {
  it('does not flag locked labels or approved registry copy', () => {
    const source = `export const A = () => (
      <nav>
        <a>Home</a>
        <button>Log a shot</button>
        <button>Delete</button>
        <button>Cancel</button>
        <span>Household</span>
      </nav>
    )`
    expect(audit(source)).toHaveLength(0)
  })

  it('does not flag approved aria-label copy', () => {
    expect(audit('export const A = () => <span aria-label="Active household" />')).toHaveLength(0)
  })
})

describe('auditCopySource — false-positive exemptions (Quinn note 2)', () => {
  it('does not flag class names', () => {
    const source = 'export const A = () => <div className="btn btn-primary btn-bevel flex items-center" />'
    expect(audit(source)).toHaveLength(0)
  })

  it('does not flag routes and link targets', () => {
    const source = `export const A = () => (
      <a href="/household/settings"><Link to="/brew-log/add" /></a>
    )`
    expect(audit(source)).toHaveLength(0)
  })

  it('does not flag query keys and enum values in expressions', () => {
    const source = `export const A = () => {
      const queryKey = ['brewLog', 'dashboard', householdId]
      const eligibility = status === 'god_shot' ? 'God Shot' : 'reject'
      return <ul data-keys={queryKey} data-eligibility={eligibility} />
    }`
    expect(audit(source)).toHaveLength(0)
  })

  it('does not flag test ids, ids, htmlFor, role, type, or name attributes', () => {
    const source = `export const A = () => (
      <form>
        <label htmlFor="manual-roaster" />
        <input id="manual-roaster" type="text" name="roaster" role="textbox" data-testid="roaster-input" />
      </form>
    )`
    expect(audit(source)).toHaveLength(0)
  })

  it('does not flag interpolated data values or unit suffixes', () => {
    const source = `export const A = ({ shot }: { shot: Shot }) => (
      <p>{shot.dose_in_g}g → {shot.yield_out_g}g</p>
    )`
    expect(audit(source)).toHaveLength(0)
  })

  it('does not flag attribute values written as expressions', () => {
    const source = 'export const A = ({ label }: { label: string }) => <button aria-label={label} />'
    expect(audit(source)).toHaveLength(0)
  })
})

describe('isMeaningfulCopy', () => {
  it('treats words of two or more letters as copy', () => {
    expect(isMeaningfulCopy('Home')).toBe(true)
    expect(isMeaningfulCopy('Last shot:')).toBe(true)
  })

  it('exempts whitespace, symbols, and bare unit suffixes', () => {
    expect(isMeaningfulCopy('   ')).toBe(false)
    expect(isMeaningfulCopy('g →')).toBe(false)
    expect(isMeaningfulCopy('→')).toBe(false)
    expect(isMeaningfulCopy('18')).toBe(false)
  })
})

describe('production sources carry no unapproved user-facing copy (spec-043 T019)', () => {
  // Render sinks + a11y props in shipped .tsx must resolve through COPY / LOCKED_LABELS.
  // Enum values, routes, query keys, class names, test ids, and data values stay exempt
  // (Quinn carry-forward note 2) — they are verified by the fixtures above.
  // Sources are loaded via Vite's raw glob so the guard needs no Node typings.
  const sources = import.meta.glob('/src/**/*.tsx', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>

  const productionFiles = Object.entries(sources).filter(
    ([path]) => !path.endsWith('.test.tsx') && !path.includes('/__tests__/') && !path.includes('/test/'),
  )

  it('covers the shipped component + page surface', () => {
    expect(productionFiles.length).toBeGreaterThan(40)
  })

  it('flags zero inline literals across shipped .tsx', () => {
    const offenders = productionFiles
      .sort(([a], [b]) => a.localeCompare(b))
      .flatMap(([path, source]) =>
        auditCopySource(path, source, APPROVED_COPY).map(
          (v) => `${path}:${v.line}:${v.column} [${v.kind}${v.attribute ? ' ' + v.attribute : ''}] ${JSON.stringify(v.text)}`,
        ),
      )
    expect(offenders, `Unapproved user-facing copy found:\n${offenders.join('\n')}`).toEqual([])
  })
})
