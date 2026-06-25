import { getBrewRatio, getCompassZoneTaste } from '../utils/extractionCompass'
import { getZoneGuidance } from '../utils/zoneGuidance'
import type { ZoneBoundaries } from '../utils/zoneBoundaries'
import { COPY } from '../copy'

interface ExtractionReadoutProps {
  doseG?: number | null
  yieldG?: number | null
  timeSec?: number | null
  selectedTaste?: string
  zoneBoundaries?: ZoneBoundaries
}

function zoneFamily(zone: string | null): 'under' | 'balanced' | 'over' | 'neutral' {
  if (!zone) return 'neutral'
  if (zone.includes('sour') || zone === 'Weak & sweet') return 'under'
  if (zone === 'Sweet & balanced') return 'balanced'
  return 'over'
}

function formatRatio(ratio: number | null): string | null {
  return ratio == null ? null : `1:${ratio.toFixed(1)}`
}

export default function ExtractionReadout({ doseG, yieldG, timeSec, selectedTaste, zoneBoundaries }: ExtractionReadoutProps) {
  const ratio = getBrewRatio(doseG, yieldG)
  const ratioText = formatRatio(ratio)
  const zone = ratioText && timeSec != null ? getCompassZoneTaste(doseG, yieldG, timeSec, zoneBoundaries) : null
  const guidance = zone ? getZoneGuidance(zone) : null
  const selectedGuidance = selectedTaste ? getZoneGuidance(selectedTaste) : null
  const nullDoseFallback = (doseG == null || doseG === 0) && yieldG != null
  const helper =
    guidance ??
    selectedGuidance ??
    (nullDoseFallback
      ? COPY.compass.nullDose
      : ratioText
        ? COPY.compass.promptTime
        : COPY.compass.promptDoseYield)
  const family = zoneFamily(zone)

  return (
    <div className="kk-extraction-readout" data-testid="extraction-readout" aria-live="polite">
      <div className="kk-extraction-readout__metric">
        <span className="kk-extraction-readout__eyebrow">{COPY.brewLogDetail.extractionReadout.ratioLabel}</span>
        <span className="kk-extraction-readout__value">{ratioText ?? '—'}</span>
      </div>
      <div className="kk-extraction-readout__zone">
        <span className="kk-extraction-readout__eyebrow">{COPY.compass.computedDiagnosisLabel}</span>
        <span className={`kk-zone-chip kk-zone-chip--${family}`}>
          {zone ?? (timeSec == null ? COPY.brewLogDetail.extractionReadout.timeNeeded : COPY.brewLogDetail.extractionReadout.unavailable)}
        </span>
        <span className="kk-extraction-readout__guidance">{helper}</span>
        {selectedTaste && (
          <span className="kk-extraction-readout__note">
            {COPY.compass.subjectiveTasteReadout(selectedTaste)}
          </span>
        )}
        {zone && selectedTaste && zone !== selectedTaste && (
          <span className="kk-extraction-readout__note">
            {COPY.compass.personalNote(zone.toLowerCase(), selectedTaste.toLowerCase())}
          </span>
        )}
      </div>
    </div>
  )
}
