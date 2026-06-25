import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import CompassChart from './CompassChart'
import CompassInstrument3D from './CompassInstrument3D'
import ExtractionReadout from './ExtractionReadout'
import type { ZoneBoundaries } from '../utils/zoneBoundaries'
import {
  buildExtractionCompassViewModel,
  EXTRACTION_COMPASS_ZONES,
  type ExtractionCompassViewModel,
} from '../utils/extractionCompassViewModel'
import type { CompassZoneTaste } from '../utils/extractionCompass'
import { useWebGLSupport } from '../lib/motion/useWebGLSupport'
import { COPY } from '../copy'

interface ExtractionCompassPanelProps {
  doseG?: number | null
  yieldG?: number | null
  timeSec?: number | null
  selectedTaste?: string
  onSelectTaste?: (taste: string) => void
  zoneBoundaries?: ZoneBoundaries
  forceSvgFallback?: boolean
}

type NavigatorWithConnection = Navigator & {
  connection?: { saveData?: boolean }
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handleChange = (event: MediaQueryListEvent) => setReduced(event.matches)
    query.addEventListener('change', handleChange)
    return () => query.removeEventListener('change', handleChange)
  }, [])

  return reduced
}

function prefersSvgForDevice(): boolean {
  if (typeof navigator === 'undefined') return true
  const nav = navigator as NavigatorWithConnection
  return Boolean(nav.connection?.saveData) || (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 2)
}

function fallbackReason(webGLAvailable: boolean, contextLost: boolean, lowPower: boolean, forced: boolean): string | null {
  if (forced) return COPY.compass.svgFallback
  if (contextLost) return COPY.compass.contextLostFallback
  if (!webGLAvailable) return COPY.compass.svgFallback
  if (lowPower) return COPY.compass.lowPowerFallback
  return null
}

export default function ExtractionCompassPanel({
  doseG,
  yieldG,
  timeSec,
  selectedTaste,
  onSelectTaste,
  zoneBoundaries,
  forceSvgFallback = false,
}: ExtractionCompassPanelProps) {
  const model: ExtractionCompassViewModel = useMemo(() => buildExtractionCompassViewModel({
    doseG,
    yieldG,
    timeSec,
    selectedTaste,
    zoneBoundaries,
  }), [doseG, selectedTaste, timeSec, yieldG, zoneBoundaries])
  const reducedMotion = usePrefersReducedMotion()
  const webGLSupport = useWebGLSupport()
  const [contextLost, setContextLost] = useState(false)
  const selectorRefs = useRef<Array<HTMLButtonElement | null>>([])
  const lowPower = prefersSvgForDevice()
  const reason = fallbackReason(webGLSupport.supported, contextLost, lowPower, forceSvgFallback)
  const useSvgFallback = Boolean(reason)

  const selectTaste = (taste: CompassZoneTaste | string) => {
    onSelectTaste?.(taste)
  }

  const handleSelectorKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const current = EXTRACTION_COMPASS_ZONES[index]
    if (!current) return
    let nextIndex = index
    if (event.key === 'ArrowRight') nextIndex = current.row * 3 + ((current.col + 1) % 3)
    if (event.key === 'ArrowLeft') nextIndex = current.row * 3 + ((current.col + 2) % 3)
    if (event.key === 'ArrowDown') nextIndex = ((current.row + 1) % 3) * 3 + current.col
    if (event.key === 'ArrowUp') nextIndex = ((current.row + 2) % 3) * 3 + current.col
    if (nextIndex !== index) {
      event.preventDefault()
      selectorRefs.current[nextIndex]?.focus()
    }
  }

  return (
    <div className="kk-compass-panel" role="group" aria-labelledby="extraction-compass-label">
      <span id="extraction-compass-label" className="sr-only">{COPY.brewLogAdd.extractionCompass}</span>
      <div className="kk-compass-panel__body">
        <div className="kk-compass-panel__instrument">
          {useSvgFallback ? (
            <>
              <CompassChart
                doseG={doseG}
                yieldG={yieldG}
                timeSec={timeSec}
                selectedTaste={selectedTaste}
                onSelectZone={selectTaste}
                zoneBoundaries={zoneBoundaries}
                showGuidance={false}
              />
              <p className="kk-compass-panel__fallback-note" role="status">{reason}</p>
            </>
          ) : (
            <CompassInstrument3D
              model={model}
              zones={EXTRACTION_COMPASS_ZONES}
              reducedMotion={reducedMotion}
              onSelectTaste={selectTaste}
              onContextLost={() => setContextLost(true)}
            />
          )}
        </div>
        <div className="kk-compass-panel__readout">
          <ExtractionReadout
            doseG={doseG}
            yieldG={yieldG}
            timeSec={timeSec}
            selectedTaste={selectedTaste}
            zoneBoundaries={zoneBoundaries}
          />
          <div className="kk-compass-taste-note" aria-label={COPY.compass.subjectiveSelectorLabel}>
            <p className="kk-compass-taste-note__summary">
              <span>{COPY.compass.subjectiveTasteLabel}:</span>{' '}
              <strong>{model.selectedTaste || COPY.compass.noTasteNote}</strong>
            </p>
            {model.selectedTaste && (
              <button type="button" className="kk-compass-taste-note__clear" onClick={() => selectTaste('')}>
                {COPY.compass.clearTasteNote}
              </button>
            )}
            {model.computedTaste && model.selectedTaste && model.computedTaste === model.selectedTaste && (
              <p className="kk-compass-taste-note__agreement">{COPY.compass.agreementNote}</p>
            )}
          </div>
          {useSvgFallback && (
            <div className="kk-compass-zone-selector" aria-label={COPY.compass.subjectiveSelectorLabel}>
              {EXTRACTION_COMPASS_ZONES.map((zone, index) => (
                <button
                  key={zone.id}
                  ref={(node) => { selectorRefs.current[index] = node }}
                  type="button"
                  className="kk-compass-zone-selector__button"
                  data-selected={zone.taste === model.selectedTaste ? 'true' : undefined}
                  onClick={() => selectTaste(zone.taste)}
                  onKeyDown={(event) => handleSelectorKeyDown(event, index)}
                  aria-label={COPY.compass.selectTasteProfile(zone.taste)}
                  aria-pressed={zone.taste === model.selectedTaste}
                >
                  {zone.taste}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
