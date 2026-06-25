import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { getZoneGuidance } from '../utils/zoneGuidance'
import type { ZoneBoundaries } from '../utils/zoneBoundaries'
import { DEFAULT_COMPASS_BOUNDARIES, getBrewRatio } from '../utils/extractionCompass'
import { COPY } from '../copy'

export interface CompassChartProps {
  doseG?: number | null
  yieldG?: number | null
  timeSec?: number | null
  selectedTaste?: string
  onSelectZone?: (taste: string) => void
  zoneBoundaries?: ZoneBoundaries
  showGuidance?: boolean
}

const W = 300
const H = 220
const PADDING = { top: 20, right: 20, bottom: 52, left: 45 }
const RATIO_MIN = 1.0
const RATIO_MAX = 3.0
const chartW = W - PADDING.left - PADDING.right
const chartH = H - PADDING.top - PADDING.bottom
const defaultFocusTaste = 'Sweet & balanced'

const baseZones: Array<{ id: string; taste: string; row: 0 | 1 | 2; col: 0 | 1 | 2 }> = [
  { id: 'weak-bitter-slow', taste: 'Weak & bitter', row: 0, col: 0 },
  { id: 'bitter-slow', taste: 'Bitter', row: 0, col: 1 },
  { id: 'harsh-bitter', taste: 'Harsh & bitter', row: 0, col: 2 },
  { id: 'weak-sweet', taste: 'Weak & sweet', row: 1, col: 0 },
  { id: 'sweet-balanced', taste: 'Sweet & balanced', row: 1, col: 1 },
  { id: 'bitter-astringent', taste: 'Bitter & astringent', row: 1, col: 2 },
  { id: 'weak-sour', taste: 'Weak & sour', row: 2, col: 0 },
  { id: 'sour', taste: 'Sour', row: 2, col: 1 },
  { id: 'astringent-sour', taste: 'Astringent & sour', row: 2, col: 2 },
]

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function splitTasteLabel(taste: string) {
  return taste.split(' & ')
}

export default function CompassChart({ doseG, yieldG, timeSec, selectedTaste, onSelectZone, zoneBoundaries, showGuidance = true }: CompassChartProps) {
  const { timeMin, timeMax } = zoneBoundaries ?? DEFAULT_COMPASS_BOUNDARIES
  const ratio = getBrewRatio(doseG, yieldG)
  const xScale = (r: number) => PADDING.left + ((r - RATIO_MIN) / (RATIO_MAX - RATIO_MIN)) * chartW
  const yScale = (s: number) => PADDING.top + ((timeMax - s) / (timeMax - timeMin)) * chartH

  const targetDot = useMemo(() => {
    if (ratio == null || timeSec == null) return null
    const x = xScale(clamp(ratio, RATIO_MIN, RATIO_MAX))
    const y = yScale(clamp(timeSec, timeMin, timeMax))
    return {
      x,
      y,
      left: `${((x - PADDING.left) / chartW) * 100}%`,
      top: `${((y - PADDING.top) / chartH) * 100}%`,
    }
  }, [ratio, timeMax, timeMin, timeSec])

  const zones = useMemo(() => baseZones.map((zone) => ({
    ...zone,
    x: PADDING.left + zone.col * (chartW / 3),
    y: PADDING.top + zone.row * (chartH / 3),
    w: chartW / 3,
    h: chartH / 3,
  })), [])

  const nullDoseFallback = (doseG == null || doseG === 0) && yieldG != null
  const timeOutOfRange = timeSec != null && (timeSec < timeMin || timeSec > timeMax)
  const activeZoneTaste = useMemo(() => {
    if (targetDot == null) return null
    return zones.find(z =>
      targetDot.x >= z.x &&
      (targetDot.x < z.x + z.w || (z.col === 2 && targetDot.x <= z.x + z.w)) &&
      targetDot.y >= z.y &&
      (targetDot.y < z.y + z.h || (z.row === 2 && targetDot.y <= z.y + z.h)),
    )?.taste ?? null
  }, [targetDot, zones])
  const focusPriorityTaste = selectedTaste || activeZoneTaste || defaultFocusTaste
  const [focusedTaste, setFocusedTaste] = useState<string | null>(null)
  const rovingTaste = focusedTaste ?? focusPriorityTaste
  const gridButtonRefs = useRef<Array<HTMLButtonElement | null>>([])

  const focusZoneAt = (index: number) => {
    const next = zones[index]
    if (!next) return
    setFocusedTaste(next.taste)
    gridButtonRefs.current[index]?.focus()
  }

  const handleGridKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const current = zones[index]
    if (!current) return
    const row = Math.floor(index / 3)
    const col = index % 3
    let nextIndex = index

    if (event.key === 'ArrowRight') nextIndex = row * 3 + ((col + 1) % 3)
    if (event.key === 'ArrowLeft') nextIndex = row * 3 + ((col + 2) % 3)
    if (event.key === 'ArrowDown') nextIndex = ((row + 1) % 3) * 3 + col
    if (event.key === 'ArrowUp') nextIndex = ((row + 2) % 3) * 3 + col
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = zones.length - 1
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelectZone?.(current.taste)
      return
    }

    if (nextIndex !== index) {
      event.preventDefault()
      focusZoneAt(nextIndex)
    }
  }

  const getCellAriaLabel = (taste: string) => {
    const selectedState = taste === selectedTaste ? 'selected as your taste' : 'not selected as your taste'
    const recipeState = taste === activeZoneTaste ? 'recipe diagnosis yes' : 'recipe diagnosis no'
    return `${taste}, ${selectedState}, ${recipeState}.`
  }

  const guidance = activeZoneTaste ? getZoneGuidance(activeZoneTaste) : selectedTaste ? getZoneGuidance(selectedTaste) : null
  const guidanceText = guidance ?? (nullDoseFallback
    ? COPY.compass.nullDose
    : ratio != null && timeSec == null
      ? COPY.compass.promptTime
      : COPY.compass.promptDoseYield)

  return (
    <div className="kk-compass-chart">
      <div className="kk-compass-chart__axis-label-row">
        <span aria-hidden="true" />
        <span>Slower shot ↑</span>
      </div>
      <div className="kk-compass-chart__matrix-wrap">
        <div className="kk-compass-chart__y-axis" aria-hidden="true">Time</div>
        <div
          role="grid"
          aria-label="Extraction compass. Select tasted profile."
          aria-describedby="extraction-compass-live-readout"
          className="kk-compass-chart__matrix"
          data-testid="compass-gradient-matrix"
        >
          {zones.map((zone, index) => {
            const selected = zone.taste === selectedTaste
            const computed = zone.taste === activeZoneTaste
            const labelParts = splitTasteLabel(zone.taste)
            return (
              <button
                key={`${zone.id}-button`}
                ref={(node) => { gridButtonRefs.current[index] = node }}
                type="button"
                role="gridcell"
                className="kk-compass-chart__grid-cell"
                data-selected={selected ? 'true' : undefined}
                data-computed={computed ? 'true' : undefined}
                aria-pressed={selected}
                aria-label={getCellAriaLabel(zone.taste)}
                tabIndex={zone.taste === rovingTaste ? 0 : -1}
                onFocus={() => setFocusedTaste(zone.taste)}
                onClick={() => onSelectZone?.(zone.taste)}
                onKeyDown={(event) => handleGridKeyDown(event, index)}
              >
                {computed && targetDot && (
                  <div
                    className="kk-compass-chart__recipe-marker-wrap"
                    style={{ left: targetDot.left, top: targetDot.top }}
                    aria-hidden="true"
                  >
                    <span className="kk-compass-chart__recipe-tag">Recipe</span>
                    <span className="kk-compass-chart__recipe-marker" />
                    {timeOutOfRange && (
                      <span className="kk-compass-chart__out-of-range">
                        {timeSec! < timeMin ? 'Fast shot' : 'Slow shot'}
                      </span>
                    )}
                  </div>
                )}
                {selected && (
                  <>
                    <span className="kk-compass-chart__taste-tag">Taste</span>
                    <span className="kk-compass-chart__taste-marker" aria-hidden="true" />
                  </>
                )}
                <span className="kk-compass-chart__cell-label">
                  {labelParts.length === 2 ? <>{labelParts[0]} <span>&amp; {labelParts[1]}</span></> : zone.taste}
                </span>
              </button>
            )
          })}
          {nullDoseFallback && (
            <p className="kk-compass-chart__null-dose">{COPY.compass.addDose}</p>
          )}
        </div>
      </div>
      <div className="kk-compass-chart__x-axis">
        <span aria-hidden="true" />
        <div className="kk-compass-chart__x-axis-values" aria-hidden="true">
          <span>1:1.0</span><span>Brew ratio →</span><span>1:3.0</span>
        </div>
      </div>
      {showGuidance ? (
        <div className="kk-compass-guidance">
          <p id="extraction-compass-live-readout" aria-live="polite" className="kk-compass-guidance__advice">
            {guidanceText}
          </p>
        </div>
      ) : null}
    </div>
  )
}
