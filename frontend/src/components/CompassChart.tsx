import { useMemo, useState, useRef, useEffect } from 'react'
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

export default function CompassChart({ doseG, yieldG, timeSec, selectedTaste, onSelectZone, zoneBoundaries, showGuidance = true }: CompassChartProps) {
  const W = 300, H = 220
  const PADDING = { top: 20, right: 20, bottom: 52, left: 45 }
  const chartW = W - PADDING.left - PADDING.right   // 235
  const chartH = H - PADDING.top - PADDING.bottom   // 148

  const { timeMin, timeMax } = zoneBoundaries ?? DEFAULT_COMPASS_BOUNDARIES

  // Brew ratio X-axis — the correct espresso extraction metric (yield ÷ dose)
  const RATIO_MIN = 1.0
  const RATIO_MAX = 3.0
  const ratio = getBrewRatio(doseG, yieldG)
  const xScale = (r: number) => PADDING.left + ((r - RATIO_MIN) / (RATIO_MAX - RATIO_MIN)) * chartW
  // timeMax → top (slow), timeMin → bottom (fast)
  const yScale = (s: number) => PADDING.top + ((timeMax - s) / (timeMax - timeMin)) * chartH

  // Equal-thirds grid — visually uniform cells, equidistant label spacing.
  // X thirds: RATIO_MIN + n*(RATIO_MAX-RATIO_MIN)/3 = 1.667 / 2.333 — matches default ratioInnerThird/ratioOuterThird exactly.
  // Y thirds: equal thirds of the time range — consistent with visual grid regardless of timeMin/timeMax profile.
  const cellW = chartW / 3
  const cellH = chartH / 3
  const x1 = PADDING.left + cellW
  const x2 = PADDING.left + 2 * cellW
  const y1 = PADDING.top  + cellH
  const y2 = PADDING.top  + 2 * cellH
  // Ratio values at the x1/x2 gridlines — derived from the equal-thirds grid, not from zoneBoundaries
  const ratioAtX1 = RATIO_MIN + (RATIO_MAX - RATIO_MIN) / 3
  const ratioAtX2 = RATIO_MIN + 2 * (RATIO_MAX - RATIO_MIN) / 3

  const zones: Array<{ id: string; taste: string; x: number; y: number; w: number; h: number; tspan?: boolean }> = [
    // Row 0 — slow (SVG top, upper third of time range)
    { id: 'weak-bitter-slow',  taste: 'Weak & bitter',       x: PADDING.left, y: PADDING.top, w: x1 - PADDING.left,      h: y1 - PADDING.top,        tspan: true },
    { id: 'bitter-slow',       taste: 'Bitter',               x: x1,           y: PADDING.top, w: x2 - x1,                h: y1 - PADDING.top               },
    { id: 'harsh-bitter',      taste: 'Harsh & bitter',       x: x2,           y: PADDING.top, w: W - PADDING.right - x2, h: y1 - PADDING.top,        tspan: true },
    // Row 1 — ideal time (middle third of time range)
    { id: 'weak-sweet',        taste: 'Weak & sweet',         x: PADDING.left, y: y1,          w: x1 - PADDING.left,      h: y2 - y1,                 tspan: true },
    { id: 'sweet-balanced',    taste: 'Sweet & balanced',     x: x1,           y: y1,          w: x2 - x1,                h: y2 - y1,                 tspan: true },
    { id: 'bitter-astringent', taste: 'Bitter & astringent',  x: x2,           y: y1,          w: W - PADDING.right - x2, h: y2 - y1,                 tspan: true },
    // Row 2 — fast (SVG bottom, lower third of time range)
    { id: 'weak-sour',         taste: 'Weak & sour',          x: PADDING.left, y: y2,          w: x1 - PADDING.left,      h: H - PADDING.bottom - y2, tspan: true },
    { id: 'sour',              taste: 'Sour',                 x: x1,           y: y2,          w: x2 - x1,                h: H - PADDING.bottom - y2             },
    { id: 'astringent-sour',   taste: 'Astringent & sour',    x: x2,           y: y2,          w: W - PADDING.right - x2, h: H - PADDING.bottom - y2, tspan: true },
  ]

  const zonePalette: Record<string, { fill: string; stroke: string }> = {
    'Weak & sour': { fill: 'var(--kk-compass-svg-zone-weak-sour-fill)', stroke: 'var(--kk-compass-svg-zone-weak-sour-stroke)' },
    'Sour': { fill: 'var(--kk-compass-svg-zone-sour-fill)', stroke: 'var(--kk-compass-svg-zone-sour-stroke)' },
    'Astringent & sour': { fill: 'var(--kk-compass-svg-zone-astringent-sour-fill)', stroke: 'var(--kk-compass-svg-zone-astringent-sour-stroke)' },
    'Weak & sweet': { fill: 'var(--kk-compass-svg-zone-weak-sweet-fill)', stroke: 'var(--kk-compass-svg-zone-weak-sweet-stroke)' },
    'Sweet & balanced': { fill: 'var(--kk-compass-svg-zone-sweet-balanced-fill)', stroke: 'var(--kk-compass-svg-zone-sweet-balanced-stroke)' },
    'Bitter & astringent': { fill: 'var(--kk-compass-svg-zone-bitter-astringent-fill)', stroke: 'var(--kk-compass-svg-zone-bitter-astringent-stroke)' },
    'Weak & bitter': { fill: 'var(--kk-compass-svg-zone-weak-bitter-fill)', stroke: 'var(--kk-compass-svg-zone-weak-bitter-stroke)' },
    'Bitter': { fill: 'var(--kk-compass-svg-zone-bitter-fill)', stroke: 'var(--kk-compass-svg-zone-bitter-stroke)' },
    'Harsh & bitter': { fill: 'var(--kk-compass-svg-zone-harsh-bitter-fill)', stroke: 'var(--kk-compass-svg-zone-harsh-bitter-stroke)' },
  }

  const dotX = ratio != null ? xScale(Math.min(RATIO_MAX, Math.max(RATIO_MIN, ratio))) : null
  const dotY = timeSec != null ? yScale(Math.min(timeMax, Math.max(timeMin, timeSec))) : null

  // Null-dose fallback: yieldG present but doseG null/zero — show callout, no dot
  const nullDoseFallback = (doseG == null || doseG === 0) && yieldG != null

  // Clamp-boundary indicator (P3): dot is at edge when time is out of range
  const timeOutOfRange = timeSec != null && (timeSec < timeMin || timeSec > timeMax)

  // Detect which zone the live dot falls in (pixel-coordinate boundary check)
  // zones is derived from constants so [dotX, dotY] deps are sufficient
  const activeZoneTaste = useMemo(() => {
    if (dotX == null || dotY == null) return null
    return zones.find(z =>
      dotX >= z.x && dotX < z.x + z.w &&
      dotY >= z.y && dotY < z.y + z.h
    )?.taste ?? null
  }, [dotX, dotY])

  // Show dot-zone guidance when we have live coordinates; fall back to
  // clicked-zone guidance so tapping a zone always surfaces actionable advice.
  const guidance =
    activeZoneTaste
      ? getZoneGuidance(activeZoneTaste)
      : selectedTaste
        ? getZoneGuidance(selectedTaste)
        : null
  const guidanceText =
    guidance ??
    (nullDoseFallback
      ? COPY.compass.nullDose
      : ratio != null && timeSec == null
        ? COPY.compass.promptTime
        : COPY.compass.promptDoseYield)

  // Smarter subtitle text (P2)
  const subtitle =
    dotX != null && dotY != null
      ? 'Extraction compass — dot shows your current extraction'
      : ratio != null && timeSec == null
        ? 'Enter shot time to see your extraction position'
        : doseG == null || yieldG == null
          ? 'Enter yield and dose for extraction diagnosis'
          : 'Enter shot time to see your extraction position'

  const [aurora, setAurora] = useState<{ cx: number; cy: number } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const rafRef = useRef<number>(0)

  // Cleanup rAF on unmount to prevent setState-on-unmounted warning
  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      if (!svgRef.current) return
      const rect = svgRef.current.getBoundingClientRect()
      const svgW = rect.width || W    // fallback for jsdom
      const svgH = rect.height || H
      const cx = (e.clientX - rect.left) * (W / svgW)
      const cy = (e.clientY - rect.top)  * (H / svgH)
      setAurora({ cx, cy })
    })
  }

  const handleMouseLeave = () => {
    cancelAnimationFrame(rafRef.current)
    setAurora(null)
  }

  return (
    <div className="kk-compass-chart">
      <p className="kk-compass-chart__subtitle">{subtitle}</p>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="kk-compass-chart__svg"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <defs>
          <radialGradient id="meshAmber" gradientUnits="userSpaceOnUse"
            cx={PADDING.left + chartW / 2} cy={PADDING.top + chartH / 2} r="90">
            <stop offset="0%"   stopColor="var(--kk-compass-svg-mesh-amber-start)" />
            <stop offset="100%" stopColor="var(--kk-compass-svg-mesh-amber-end)" />
          </radialGradient>
          <radialGradient id="meshRust" gradientUnits="userSpaceOnUse"
            cx={PADDING.left} cy={PADDING.top} r="100">
            <stop offset="0%"   stopColor="var(--kk-compass-svg-mesh-rust-start)" />
            <stop offset="100%" stopColor="var(--kk-compass-svg-mesh-rust-end)" />
          </radialGradient>
          <radialGradient id="meshCerulean" gradientUnits="userSpaceOnUse"
            cx={PADDING.left + chartW} cy={PADDING.top + chartH} r="100">
            <stop offset="0%"   stopColor="var(--kk-compass-svg-mesh-cerulean-start)" />
            <stop offset="100%" stopColor="var(--kk-compass-svg-mesh-cerulean-end)" />
          </radialGradient>
          <radialGradient id="meshSlate" gradientUnits="userSpaceOnUse"
            cx={PADDING.left + chartW} cy={PADDING.top + chartH / 2} r="80">
            <stop offset="0%"   stopColor="var(--kk-compass-svg-mesh-slate-start)" />
            <stop offset="100%" stopColor="var(--kk-compass-svg-mesh-slate-end)" />
          </radialGradient>

          {aurora && (
            <radialGradient id="auroraGrad" gradientUnits="userSpaceOnUse"
              cx={aurora.cx} cy={aurora.cy} r="80">
              <stop offset="0%"   stopColor="var(--kk-compass-svg-aurora-start)" />
              <stop offset="100%" stopColor="var(--kk-compass-svg-aurora-end)" />
            </radialGradient>
          )}

        </defs>

        {/* Pass 1 — Hit areas and state overlays (below gradient, captures clicks) */}
        {zones.map(z => {
          const sel = z.taste === selectedTaste
          const isDotZone = z.taste === activeZoneTaste
          const palette = zonePalette[z.taste]
          return (
            <g key={z.id} style={{ cursor: 'pointer' }} onClick={() => onSelectZone?.(z.taste)}>
              {/* Transparent hit target */}
              <rect x={z.x} y={z.y} width={z.w} height={z.h} fill="rgba(0,0,0,0)" />
              <rect x={z.x} y={z.y} width={z.w} height={z.h} fill={palette.fill} stroke={palette.stroke} strokeWidth="0.5" />

              {/* Agreement: dot zone AND selected */}
              {sel && isDotZone && (
                <>
                  <rect x={z.x}   y={z.y}   width={z.w}   height={z.h}
                        fill="var(--kk-compass-svg-agreement-fill)"
                        stroke="var(--kk-compass-svg-selection-outer)" strokeWidth="2.0" />
                  <rect x={z.x+2} y={z.y+2} width={z.w-4} height={z.h-4}
                        fill="rgba(0,0,0,0)"
                        stroke="var(--kk-compass-svg-selection-inner)" strokeWidth="1.5" opacity="0.9" />
                </>
              )}
              {/* Selected only */}
              {sel && !isDotZone && (
                <rect x={z.x} y={z.y} width={z.w} height={z.h}
                      fill="var(--kk-compass-svg-selected-fill)"
                      stroke="var(--kk-compass-svg-selection-outer)" strokeWidth="1.5" />
              )}
              {/* Dot zone only */}
              {!sel && isDotZone && (
                <rect x={z.x} y={z.y} width={z.w} height={z.h}
                      fill="rgba(0,0,0,0)"
                      stroke="var(--kk-compass-svg-selection-inner)" strokeWidth="1.5" opacity="0.9"
                      strokeDasharray="3 2" />
              )}
              {/* Baseline hairline grid */}
              {!sel && !isDotZone && (
                <rect data-testid="zone-cell" x={z.x} y={z.y} width={z.w} height={z.h}
                      fill="rgba(0,0,0,0)"
                      stroke="none" />
              )}
            </g>
          )
        })}

        {/* Mesh background — 4 radial overlays */}
        <rect x={PADDING.left} y={PADDING.top} width={chartW} height={chartH}
              fill="url(#meshAmber)" pointerEvents="none" />
        <rect x={PADDING.left} y={PADDING.top} width={chartW} height={chartH}
              fill="url(#meshRust)" pointerEvents="none" />
        <rect x={PADDING.left} y={PADDING.top} width={chartW} height={chartH}
              fill="url(#meshCerulean)" pointerEvents="none" />
        <rect x={PADDING.left} y={PADDING.top} width={chartW} height={chartH}
              fill="url(#meshSlate)" pointerEvents="none" />

        {aurora && (
          <rect data-testid="aurora-overlay"
                x={PADDING.left} y={PADDING.top} width={chartW} height={chartH}
                fill="url(#auroraGrad)" pointerEvents="none" />
        )}

        {/* Pass 3 — Zone labels (above gradient) */}
        {zones.map(z => {
          const cx = z.x + z.w / 2
          const cy = z.y + z.h / 2
          return z.tspan ? (() => {
            const parts = z.taste.split(' & ')
            return (
              <text key={z.id + '-label'} x={cx} y={cy}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize={9} fontFamily="Inter, sans-serif"
                    className="kk-compass-chart__zone-label-svg">
                <tspan x={cx} dy="-8">{parts[0]}</tspan>
                <tspan x={cx} dy="16">{'& ' + parts[1]}</tspan>
              </text>
            )
          })() : (
            <text key={z.id + '-label'} x={cx} y={cy}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={9} fontFamily="Inter, sans-serif"
                  className="kk-compass-chart__zone-label-svg">
              {z.taste}
            </text>
          )
        })}

        {/* Axes */}
        <line x1={PADDING.left} y1={PADDING.top} x2={PADDING.left} y2={PADDING.top + chartH}
              stroke="var(--kk-compass-svg-axis-stroke)" strokeWidth="1" />
        <line x1={PADDING.left} y1={PADDING.top + chartH} x2={PADDING.left + chartW} y2={PADDING.top + chartH}
              stroke="var(--kk-compass-svg-axis-stroke)" strokeWidth="1" />

        {/* Zone boundary labels annotating the x1 and x2 gridlines — derived from grid, not zoneBoundaries */}
        <text x={x1} y={PADDING.top + chartH + 12} textAnchor="middle" fontSize={9}
              className="kk-compass-chart__axis-value-svg">{ratioAtX1.toFixed(2)}</text>
        <text x={x2} y={PADDING.top + chartH + 12} textAnchor="middle" fontSize={9}
              className="kk-compass-chart__axis-value-svg">{ratioAtX2.toFixed(2)}</text>

        {/* Axis labels — directional, no tick marks */}
        <text x={PADDING.left + chartW / 2} y={H - 5} textAnchor="middle"
              fontSize={9} fontFamily="Inter, sans-serif"
              className="kk-compass-chart__axis-label-svg">{COPY.compass.axisRatio}</text>
        <text x={10} y={PADDING.top + chartH / 2} textAnchor="middle"
              fontSize={9} fontFamily="Inter, sans-serif"
              className="kk-compass-chart__axis-label-svg"
              transform={`rotate(-90, 10, ${PADDING.top + chartH / 2})`}>{COPY.compass.axisTime}</text>

        {/* Null-dose callout: show when yieldG present but doseG absent */}
        {nullDoseFallback && (
          <text x={PADDING.left + chartW / 2} y={PADDING.top + chartH / 2}
                textAnchor="middle" dominantBaseline="middle"
                className="kk-compass-chart__axis-label-svg" fontSize={9}>{COPY.compass.addDose}</text>
        )}

        {/* Live dot */}
        {dotX != null && dotY != null && (
          <g>
            <circle
              cx={dotX} cy={dotY} r="8"
              fill="none" stroke="var(--kk-compass-svg-live-ping)" strokeWidth="1"
              className="compass-ping"
              style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
            />
            <circle
              cx={dotX} cy={dotY} r="8"
              fill="none" stroke="var(--kk-compass-svg-live-ring)" strokeWidth="1.5" opacity="0.88"
            />
            <circle
              cx={dotX} cy={dotY} r="5"
              fill="var(--kk-compass-svg-live-dot)"
            />
            {timeOutOfRange && (
              <text x={dotX} y={timeSec! < timeMin ? dotY + 16 : dotY - 16}
                    textAnchor="middle" fontSize={9} className="kk-compass-chart__out-of-range-svg" opacity="0.9">
                {timeSec! < timeMin ? '▼ Fast shot' : '▲ Slow shot'}
              </text>
            )}
          </g>
        )}
      </svg>
      {showGuidance ? (
        <div className="kk-compass-guidance">
          <p
            aria-live="polite"
            className="kk-compass-guidance__advice"
          >
            {guidanceText}
          </p>
          {activeZoneTaste && selectedTaste && activeZoneTaste !== selectedTaste && (
            <p className="kk-compass-guidance__note">
              {COPY.compass.personalNote(activeZoneTaste.toLowerCase(), selectedTaste.toLowerCase())}
            </p>
          )}
          <p className="kk-compass-guidance__legend">
            {COPY.compass.legend}
          </p>
        </div>
      ) : null}
    </div>
  )
}
