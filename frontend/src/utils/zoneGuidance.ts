// Confirmed zone.taste strings from CompassChart.tsx zones array (lines 33–43):
// 'Weak & bitter'
// 'Bitter'
// 'Harsh & bitter'
// 'Weak & sweet'
// 'Sweet & balanced'
// 'Bitter & astringent'
// 'Weak & sour'
// 'Sour'
// 'Astringent & sour'
// All 9 keys below match these exact strings character-for-character (case, spacing, & symbol).

const ZONE_GUIDANCE: Readonly<Record<string, string>> = {
  'Sweet & balanced':    'Dialled in — ratio and time are in the ideal window. Keep these parameters.',
  'Bitter':              'Grind too fine for this ratio — go one step coarser to cut extraction.',
  'Harsh & bitter':      'Strongly over-extracted — coarsen the grind, then reduce yield if still harsh.',
  'Weak & bitter':       'Fast shot at high ratio — check for channeling. Improve distribution, then lower yield.',
  'Sour':                'Grind too coarse for this ratio — go one step finer to raise extraction.',
  'Weak & sour':         'Under-extracted and thin — grind finer: it raises both strength and extraction at once.',
  'Astringent & sour':   'Uneven extraction — improve puck distribution and tamp before touching the grind.',
  'Bitter & astringent': 'Over-extracted at high yield — reduce yield first, then coarsen if still bitter.',
  'Weak & sweet':        'Good flavour, under-strength — reduce yield on the next shot to concentrate it.',
} as const

/**
 * Returns the one-sentence guidance string for a zone taste, or null if unrecognised.
 * Keyed on z.taste values from CompassChart zone definitions.
 */
export function getZoneGuidance(taste: string): string | null {
  return ZONE_GUIDANCE[taste] ?? null
}
