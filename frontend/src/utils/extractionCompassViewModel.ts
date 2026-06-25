import {
  COMPASS_ZONE_TASTES,
  DEFAULT_COMPASS_BOUNDARIES,
  getBrewRatio,
  getCompassZoneTaste,
  type CompassZoneTaste,
} from './extractionCompass'
import { getZoneGuidance } from './zoneGuidance'
import type { ZoneBoundaries } from './zoneBoundaries'
import { COPY } from '../copy'

export interface ExtractionCompassZone {
  id: string
  taste: CompassZoneTaste
  row: 0 | 1 | 2
  col: 0 | 1 | 2
}

export interface ExtractionCompassViewModel {
  ratio: number | null
  timeSec: number | null
  computedTaste: CompassZoneTaste | null
  selectedTaste: CompassZoneTaste | ''
  guidanceText: string
  personalNote: string | null
  missingInputState: 'doseYield' | 'time' | 'dose' | null
  timeOutOfRange: 'fast' | 'slow' | null
  timeMin: number
  timeMax: number
}

export const EXTRACTION_COMPASS_ZONES: readonly ExtractionCompassZone[] = COMPASS_ZONE_TASTES.flatMap((row, rowIndex) =>
  row.map((taste, colIndex) => ({
    id: taste.toLowerCase().replaceAll(' & ', '-').replaceAll(' ', '-'),
    taste,
    row: rowIndex as 0 | 1 | 2,
    col: colIndex as 0 | 1 | 2,
  })),
)

export function isCompassZoneTaste(value: string | null | undefined): value is CompassZoneTaste {
  return EXTRACTION_COMPASS_ZONES.some((zone) => zone.taste === value)
}

export function buildExtractionCompassViewModel({
  doseG,
  yieldG,
  timeSec,
  selectedTaste,
  zoneBoundaries = DEFAULT_COMPASS_BOUNDARIES,
}: {
  doseG?: number | null
  yieldG?: number | null
  timeSec?: number | null
  selectedTaste?: string
  zoneBoundaries?: ZoneBoundaries
}): ExtractionCompassViewModel {
  const ratio = getBrewRatio(doseG, yieldG)
  const selected = isCompassZoneTaste(selectedTaste) ? selectedTaste : ''
  const computedTaste = ratio != null && timeSec != null
    ? getCompassZoneTaste(doseG, yieldG, timeSec, zoneBoundaries)
    : null
  const computedGuidance = computedTaste ? getZoneGuidance(computedTaste) : null
  const selectedGuidance = selected ? getZoneGuidance(selected) : null
  const nullDoseFallback = (doseG == null || doseG === 0) && yieldG != null
  const missingInputState =
    nullDoseFallback
      ? 'dose'
      : ratio == null
        ? 'doseYield'
        : timeSec == null
          ? 'time'
          : null
  const { timeMin, timeMax } = zoneBoundaries
  const timeOutOfRange =
    timeSec == null
      ? null
      : timeSec < timeMin
        ? 'fast'
        : timeSec > timeMax
          ? 'slow'
          : null
  const guidanceText =
    computedGuidance ??
    selectedGuidance ??
    (missingInputState === 'dose'
      ? COPY.compass.nullDose
      : missingInputState === 'time'
        ? COPY.compass.promptTime
        : COPY.compass.promptDoseYield)

  return {
    ratio,
    timeSec: timeSec ?? null,
    computedTaste,
    selectedTaste: selected,
    guidanceText,
    personalNote: computedTaste && selected && computedTaste !== selected
      ? COPY.compass.personalNote(computedTaste.toLowerCase(), selected.toLowerCase())
      : null,
    missingInputState,
    timeOutOfRange,
    timeMin,
    timeMax,
  }
}
