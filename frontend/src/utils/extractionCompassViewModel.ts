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
  ratioText: string | null
  timeSec: number | null
  computedTaste: CompassZoneTaste | null
  selectedTaste: CompassZoneTaste | ''
  guidanceText: string
  primaryGuidanceText: string
  actionText: string | null
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

function formatRatio(ratio: number | null): string | null {
  return ratio == null ? null : `1:${ratio.toFixed(1)}`
}

function nextShotActionFromGuidance(guidance: string | null): string | null {
  if (!guidance) return null
  const lower = guidance.toLowerCase()
  if (lower.includes('keep these parameters')) return 'keep these parameters'
  if (lower.includes('finer')) return 'grind finer'
  if (lower.includes('coarser') || lower.includes('coarsen')) return 'grind coarser'
  if (lower.includes('reduce yield') || lower.includes('lower your brew ratio') || lower.includes('less yield')) {
    return 'reduce yield'
  }
  if (lower.includes('check distribution') || lower.includes('distribution')) return 'check distribution'
  if (lower.includes('adjust dose')) return 'adjust dose or distribution'
  return guidance.split('—').at(-1)?.trim().replace(/\.$/, '') ?? null
}

function buildPrimaryGuidance({
  ratioText,
  computedTaste,
  selected,
  computedGuidance,
  selectedGuidance,
  missingInputState,
}: {
  ratioText: string | null
  computedTaste: CompassZoneTaste | null
  selected: CompassZoneTaste | ''
  computedGuidance: string | null
  selectedGuidance: string | null
  missingInputState: ExtractionCompassViewModel['missingInputState']
}): { text: string; action: string | null } {
  const selectedAction = nextShotActionFromGuidance(selectedGuidance)
  const computedAction = nextShotActionFromGuidance(computedGuidance)
  const action = selectedAction ?? computedAction
  const correction = action ? `${action} for the next shot` : 'review the next shot'

  if (!computedTaste && selected) {
    return {
      text: `You tasted ${selected} — ${correction}.`,
      action,
    }
  }

  if (missingInputState === 'dose') {
    return { text: COPY.compass.nullDose, action: null }
  }
  if (missingInputState === 'doseYield') {
    return { text: COPY.compass.promptDoseYield, action: null }
  }
  if (ratioText && missingInputState === 'time') {
    return { text: `At ${ratioText}, add shot time to place the recipe on the compass.`, action: null }
  }

  if (ratioText && computedTaste && selected && computedTaste === selected) {
    return {
      text: `At ${ratioText}, recipe and taste agree on ${computedTaste} — ${correction}.`,
      action,
    }
  }
  if (ratioText && computedTaste && selected) {
    return {
      text: `At ${ratioText}, the recipe lands in ${computedTaste} and your taste is ${selected} — ${correction}.`,
      action,
    }
  }
  if (ratioText && computedTaste) {
    return {
      text: `At ${ratioText}, the recipe lands in ${computedTaste} — ${correction}.`,
      action,
    }
  }

  return { text: COPY.compass.promptDoseYield, action: null }
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
  const ratioText = formatRatio(ratio)
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

  const primaryGuidance = buildPrimaryGuidance({
    ratioText,
    computedTaste,
    selected,
    computedGuidance,
    selectedGuidance,
    missingInputState,
  })

  return {
    ratio,
    ratioText,
    timeSec: timeSec ?? null,
    computedTaste,
    selectedTaste: selected,
    guidanceText,
    primaryGuidanceText: primaryGuidance.text,
    actionText: primaryGuidance.action,
    personalNote: computedTaste && selected && computedTaste !== selected
      ? COPY.compass.personalNote(computedTaste.toLowerCase(), selected.toLowerCase())
      : null,
    missingInputState,
    timeOutOfRange,
    timeMin,
    timeMax,
  }
}
