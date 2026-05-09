/**
 * Canonical roast-level enum, mirroring backend `_ROAST_LEVELS` in
 * `app/routers/api_catalog.py`. Single source of truth — UI dropdowns
 * and validation should import from here so they cannot drift.
 */
export const ROAST_LEVELS = [
  'Light',
  'Light / Medium',
  'Medium',
  'Medium / Dark',
  'Dark',
] as const

export type RoastLevel = (typeof ROAST_LEVELS)[number]
