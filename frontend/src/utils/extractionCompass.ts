import type { ZoneBoundaries } from './zoneBoundaries'

export const DEFAULT_COMPASS_BOUNDARIES: ZoneBoundaries = {
  timeMin: 15,
  timeMax: 60,
  ratioInnerThird: 1.67,
  ratioOuterThird: 2.33,
}

export const COMPASS_ZONE_TASTES = [
  ['Weak & bitter', 'Bitter', 'Harsh & bitter'],
  ['Weak & sweet', 'Sweet & balanced', 'Bitter & astringent'],
  ['Weak & sour', 'Sour', 'Astringent & sour'],
] as const

export type CompassZoneTaste = (typeof COMPASS_ZONE_TASTES)[number][number]

const RATIO_MIN = 1.0
const RATIO_MAX = 3.0

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function getBrewRatio(doseG?: number | null, yieldG?: number | null): number | null {
  return yieldG != null && doseG != null && doseG > 0 ? yieldG / doseG : null
}

export function getCompassZoneTaste(
  doseG?: number | null,
  yieldG?: number | null,
  timeSec?: number | null,
  zoneBoundaries: ZoneBoundaries = DEFAULT_COMPASS_BOUNDARIES,
): CompassZoneTaste | null {
  const ratio = getBrewRatio(doseG, yieldG)
  if (ratio == null || timeSec == null) return null

  const { timeMin, timeMax } = zoneBoundaries
  const clampedRatio = clamp(ratio, RATIO_MIN, RATIO_MAX)
  const clampedTime = clamp(timeSec, timeMin, timeMax)

  const column = Math.min(2, Math.floor(((clampedRatio - RATIO_MIN) / (RATIO_MAX - RATIO_MIN)) * 3))
  const row = Math.min(2, Math.floor(((timeMax - clampedTime) / (timeMax - timeMin)) * 3))

  return COMPASS_ZONE_TASTES[row]?.[column] ?? null
}
