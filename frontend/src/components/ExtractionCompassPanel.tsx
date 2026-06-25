import { useEffect, useMemo, useState } from 'react'
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
import { useTone } from '../contexts/ToneContext'
import { COPY } from '../copy'

interface ExtractionCompassPanelProps {
  doseG?: number | null
  yieldG?: number | null
  timeSec?: number | null
  selectedTaste?: string
  onSelectTaste?: (taste: string) => void
  zoneBoundaries?: ZoneBoundaries
  forceSvgFallback?: boolean
  visualMode?: 'svg' | '3d'
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
  visualMode = 'svg',
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
  const { tone } = useTone()
  const [contextLost, setContextLost] = useState(false)
  const lowPower = prefersSvgForDevice()
  const reason = fallbackReason(webGLSupport.supported, contextLost, lowPower, forceSvgFallback)
  const use3DInstrument = visualMode === '3d' && !reason
  const showSvgFallbackNote = visualMode === '3d' || forceSvgFallback

  const selectTaste = (taste: CompassZoneTaste | string) => {
    onSelectTaste?.(taste)
  }

  return (
    <div className="kk-compass-panel" role="group" aria-labelledby="extraction-compass-label">
      <div className="kk-compass-panel__header">
        <div>
          <p className="kk-compass-panel__eyebrow">Add shot helper</p>
          <h2 id="extraction-compass-label" className="kk-compass-panel__title">{COPY.brewLogAdd.extractionCompass}</h2>
        </div>
        <ul className="kk-compass-panel__legend" aria-label="Marker legend">
          <li><span className="kk-compass-panel__legend-symbol kk-compass-panel__legend-symbol--recipe" aria-hidden="true" /> Recipe diagnosis</li>
          <li><span className="kk-compass-panel__legend-symbol kk-compass-panel__legend-symbol--taste" aria-hidden="true" /> Your taste</li>
        </ul>
      </div>
      <div className="kk-compass-panel__body">
        <div className="kk-compass-panel__instrument">
          {!use3DInstrument ? (
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
              {showSvgFallbackNote && reason && (
                <p className="kk-compass-panel__fallback-note" role="status">{reason}</p>
              )}
            </>
          ) : (
            <CompassInstrument3D
              key={tone}
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
        </div>
      </div>
    </div>
  )
}
