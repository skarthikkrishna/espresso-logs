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
  'Sweet & balanced':    'Ideal extraction — ratio 1.7–2.3, time 25–35 s. Keep these parameters.',
  'Bitter':              'Over-extracted — try a coarser grind or reduce shot time by 3–5 s.',
  'Harsh & bitter':      'Strongly over-extracted — coarsen grind and pull a shorter, tighter ratio.',
  'Weak & bitter':       'High ratio + slow pull — the puck may be channelling. Adjust dose or distribution, then try a coarser grind.',
  'Sour':                'Under-extracted — try a finer grind or extend shot time by 3–5 s.',
  'Weak & sour':         'Under-extracted and diluted — grind finer and lower your brew ratio (less yield).',
  'Astringent & sour':   'Uneven extraction — check distribution and levelling, then grind slightly finer.',
  'Bitter & astringent': 'Over-extracted with high yield — coarsen grind and reduce your yield (lower ratio).',
  'Weak & sweet':        'Good taste but too diluted — reduce yield slightly (aim for ratio ≤ 2.3).',
} as const

/**
 * Returns the one-sentence guidance string for a zone taste, or null if unrecognised.
 * Keyed on z.taste values from CompassChart zone definitions.
 */
export function getZoneGuidance(taste: string): string | null {
  return ZONE_GUIDANCE[taste] ?? null
}
