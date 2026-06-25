import { useRef } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import type { ZoneBoundaries } from '../utils/zoneBoundaries'
import { buildExtractionCompassViewModel } from '../utils/extractionCompassViewModel'
import { usePrefersReducedMotion } from '../lib/motion/usePrefersReducedMotion'
import { COPY } from '../copy'

gsap.registerPlugin(useGSAP)

interface ExtractionReadoutProps {
  doseG?: number | null
  yieldG?: number | null
  timeSec?: number | null
  selectedTaste?: string
  zoneBoundaries?: ZoneBoundaries
}

export default function ExtractionReadout({ doseG, yieldG, timeSec, selectedTaste, zoneBoundaries }: ExtractionReadoutProps) {
  const guidanceRef = useRef<HTMLParagraphElement>(null)
  const prefersReducedMotion = usePrefersReducedMotion()
  const model = buildExtractionCompassViewModel({ doseG, yieldG, timeSec, selectedTaste, zoneBoundaries })

  useGSAP(
    () => {
      const guidance = guidanceRef.current
      if (!guidance) return
      if (prefersReducedMotion) {
        gsap.set(guidance, { opacity: 1, y: 0 })
        return
      }
      gsap.fromTo(guidance, { opacity: 0.42, y: 4 }, { opacity: 1, y: 0, duration: 0.28, ease: 'power2.out' })
    },
    { dependencies: [model.primaryGuidanceText, prefersReducedMotion] },
  )

  return (
    <section id="extraction-compass-live-readout" className="kk-extraction-readout" data-testid="extraction-readout" aria-labelledby="extraction-readout-title">
      <p className="kk-extraction-readout__eyebrow" id="extraction-readout-title">Live guidance</p>
      <div className="kk-extraction-readout__metric-grid" aria-label="Current extraction state">
        <div className="kk-extraction-readout__metric">
          <span className="kk-extraction-readout__metric-label">{COPY.brewLogDetail.extractionReadout.ratioLabel}</span>
          <span className="kk-extraction-readout__metric-value">{model.ratioText ?? '—'}</span>
        </div>
        <div className="kk-extraction-readout__metric">
          <span className="kk-extraction-readout__metric-label">{COPY.compass.computedDiagnosisLabel}</span>
          <span className="kk-extraction-readout__metric-value">{model.computedTaste ?? (model.timeSec == null ? COPY.brewLogDetail.extractionReadout.timeNeeded : COPY.brewLogDetail.extractionReadout.unavailable)}</span>
        </div>
        <div className="kk-extraction-readout__metric">
          <span className="kk-extraction-readout__metric-label">{COPY.compass.subjectiveTasteLabel}</span>
          <span className="kk-extraction-readout__metric-value">{model.selectedTaste || COPY.compass.noTasteNote}</span>
        </div>
      </div>
      <p ref={guidanceRef} className="kk-extraction-readout__guidance" aria-live="polite">
        {model.primaryGuidanceText}
      </p>
      {model.actionText && (
        <span className="kk-extraction-readout__action-chip">Single next correction: {model.actionText}</span>
      )}
    </section>
  )
}
