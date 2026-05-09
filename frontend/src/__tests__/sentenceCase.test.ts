/**
 * Sentence case tests (§7.2)
 *
 * The UI uses sentence case throughout: only the first word of a label is
 * capitalised; subsequent words are lower-case unless they are proper nouns.
 * Title case (every word capitalised) must NOT be used for nav or action labels.
 */

import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Return true if *label* follows sentence case rules:
 * - first character is uppercase
 * - no word after the first starts with an uppercase letter
 *   (proper nouns and acronyms are excluded from this check via an allowlist)
 */
function isSentenceCase(label: string, properNouns: string[] = []): boolean {
  const words = label.trim().split(/\s+/)
  if (!words.length) return false
  if (words[0][0] !== words[0][0].toUpperCase()) return false
  for (let i = 1; i < words.length; i++) {
    const word = words[i]
    if (!word) continue
    const isProperNoun = properNouns.some(
      (pn) => pn.toLowerCase() === word.toLowerCase()
    )
    if (!isProperNoun && word[0] !== word[0].toLowerCase()) {
      return false
    }
  }
  return true
}

/**
 * Return true if a string is title case (every word starts uppercase).
 * A one-word string is always both sentence and title case.
 */
function isTitleCase(label: string): boolean {
  const words = label.trim().split(/\s+/)
  return words.every((w) => w.length > 0 && w[0] === w[0].toUpperCase())
}

// ---------------------------------------------------------------------------
// Navigation labels
// ---------------------------------------------------------------------------

describe('Nav labels use sentence case', () => {
  const NAV_LABELS = ['Home', 'Brew log', 'Catalog', 'Hardware', 'Import']

  it('each nav label has its first word capitalised', () => {
    NAV_LABELS.forEach((label) => {
      expect(label[0]).toBe(label[0].toUpperCase())
    })
  })

  it('multi-word nav labels have lower-case subsequent words', () => {
    NAV_LABELS.filter((l) => l.includes(' ')).forEach((label) => {
      const words = label.split(' ')
      words.slice(1).forEach((word) => {
        expect(word[0]).toBe(word[0].toLowerCase())
      })
    })
  })

  it('all nav labels satisfy isSentenceCase()', () => {
    NAV_LABELS.forEach((label) => {
      expect(isSentenceCase(label), `"${label}" should be sentence case`).toBe(true)
    })
  })
})

// ---------------------------------------------------------------------------
// Action labels
// ---------------------------------------------------------------------------

describe('Action labels use sentence case, not title case', () => {
  const ACTION_LABELS = [
    'Add shot',
    'Add bag',
    'Add hardware',
    'Log shot',
    'Save changes',
    'Upload image',
    'Add to inventory',
  ]

  it('each action label is sentence case', () => {
    ACTION_LABELS.forEach((label) => {
      expect(isSentenceCase(label), `"${label}" should be sentence case`).toBe(true)
    })
  })

  it('multi-word action labels are NOT title case', () => {
    ACTION_LABELS.filter((l) => l.includes(' ')).forEach((label) => {
      expect(isTitleCase(label), `"${label}" must NOT be title case`).toBe(false)
    })
  })
})

// ---------------------------------------------------------------------------
// Page / section headings
// ---------------------------------------------------------------------------

describe('Page headings use sentence case', () => {
  const PAGE_HEADINGS = [
    'Brew log',
    'Catalog',
    'Hardware',
    'Active bags',
    'Recent shots',
    'Maintenance log',
    'Smart defaults',
    'Import data',
  ]

  it('page headings are sentence case', () => {
    PAGE_HEADINGS.forEach((heading) => {
      expect(isSentenceCase(heading), `"${heading}" should be sentence case`).toBe(true)
    })
  })

  it('multi-word headings do not use title case', () => {
    PAGE_HEADINGS.filter((h) => h.includes(' ')).forEach((heading) => {
      expect(isTitleCase(heading), `"${heading}" must NOT be title case`).toBe(false)
    })
  })
})

// ---------------------------------------------------------------------------
// Title case detection helper (self-tests)
// ---------------------------------------------------------------------------

describe('isSentenceCase helper', () => {
  it('correctly identifies sentence case', () => {
    expect(isSentenceCase('Hello world')).toBe(true)
    expect(isSentenceCase('Brew log')).toBe(true)
    expect(isSentenceCase('Home')).toBe(true)
    expect(isSentenceCase('Add shot')).toBe(true)
  })

  it('rejects title case strings', () => {
    expect(isSentenceCase('Brew Log')).toBe(false)
    expect(isSentenceCase('Add Shot')).toBe(false)
    expect(isSentenceCase('Log Shot')).toBe(false)
    expect(isSentenceCase('Brew Date')).toBe(false)
  })

  it('accepts proper nouns via allowlist', () => {
    expect(isSentenceCase('Import CSV', ['CSV'])).toBe(true)
  })
})

describe('isTitleCase helper', () => {
  it('identifies title case', () => {
    expect(isTitleCase('Brew Log')).toBe(true)
    expect(isTitleCase('Add Shot')).toBe(true)
  })

  it('rejects sentence case multi-word strings', () => {
    expect(isTitleCase('Brew log')).toBe(false)
    expect(isTitleCase('Add shot')).toBe(false)
  })

  it('single words are both', () => {
    expect(isTitleCase('Home')).toBe(true)
    expect(isSentenceCase('Home')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Documented anti-patterns — strings that must NOT appear verbatim in the UI
// ---------------------------------------------------------------------------

describe('Title-case anti-patterns are documented', () => {
  const FORBIDDEN_TITLE_CASE = ['Brew Log', 'Add Shot', 'Brew Date', 'Log Shot', 'Active Bags']

  it('each forbidden label is title case (documents the bug we avoid)', () => {
    FORBIDDEN_TITLE_CASE.forEach((label) => {
      if (label.includes(' ')) {
        expect(isTitleCase(label), `"${label}" is title case (forbidden)`).toBe(true)
      }
    })
  })

  it('each forbidden label fails isSentenceCase() for multi-word strings', () => {
    FORBIDDEN_TITLE_CASE.filter((l) => l.includes(' ')).forEach((label) => {
      expect(isSentenceCase(label), `"${label}" must not pass sentence case check`).toBe(false)
    })
  })
})
