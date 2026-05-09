export interface ZoneBoundaries {
  timeMin: number
  timeMax: number
  ratioInnerThird: number   // left/middle column divider
  ratioOuterThird: number   // middle/right column divider
}

const MACHINE_TIME_PROFILES: Record<string, { min: number; max: number }> = {
  'Bambino Plus':           { min: 15, max: 55 },
  'Bambino':                { min: 15, max: 50 },
  'Breville Dual Boiler':   { min: 20, max: 45 },
  'default':                { min: 15, max: 60 },
}

const ROAST_RATIO_PROFILES: Record<string, { inner: number; outer: number }> = {
  light:        { inner: 1.8, outer: 2.8 },
  medium:       { inner: 1.6, outer: 2.4 },
  dark:         { inner: 1.4, outer: 2.0 },
  'medium-dark':{ inner: 1.5, outer: 2.2 },
  'medium-light':{ inner: 1.7, outer: 2.6 },
}

const DEFAULT_BOUNDARIES: ZoneBoundaries = {
  timeMin: 15,
  timeMax: 60,
  ratioInnerThird: 1.67,
  ratioOuterThird: 2.33,
}

export function deriveZoneBoundaries(
  machineName?: string | null,
  roastLevel?: string | null,
): ZoneBoundaries {
  const time = MACHINE_TIME_PROFILES[machineName ?? ''] ?? MACHINE_TIME_PROFILES['default']
  const roastKey = roastLevel?.toLowerCase()
  const ratio = roastKey && ROAST_RATIO_PROFILES[roastKey]
    ? ROAST_RATIO_PROFILES[roastKey]
    : { inner: DEFAULT_BOUNDARIES.ratioInnerThird, outer: DEFAULT_BOUNDARIES.ratioOuterThird }
  return {
    timeMin: time.min,
    timeMax: time.max,
    ratioInnerThird: ratio.inner,
    ratioOuterThird: ratio.outer,
  }
}
