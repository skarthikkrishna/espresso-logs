import { useMemo, useState, useRef, useEffect } from 'react'
import { getZoneGuidance } from '../utils/zoneGuidance'
import type { ZoneBoundaries } from '../utils/zoneBoundaries'

const DEFAULT_BOUNDARIES: ZoneBoundaries = { timeMin: 15, timeMax: 60, ratioInnerThird: 1.67, ratioOuterThird: 2.33 }

export interface CompassChartProps {
  doseG?: number | null
  yieldG?: number | null
  timeSec?: number | null
  selectedTaste?: string
  onSelectZone?: (taste: string) => void
  zoneBoundaries?: ZoneBoundaries
}

export default function CompassChart({ doseG, yieldG, timeSec, selectedTaste, onSelectZone, zoneBoundaries }: CompassChartProps) {
  const W = 300, H = 220
  const PADDING = { top: 20, right: 20, bottom: 52, left: 45 }
  const chartW = W - PADDING.left - PADDING.right   // 235
  const chartH = H - PADDING.top - PADDING.bottom   // 148

  const { timeMin, timeMax, ratioInnerThird, ratioOuterThird } = zoneBoundaries ?? DEFAULT_BOUNDARIES

  // Brew ratio X-axis — the correct espresso extraction metric (yield ÷ dose)
  const RATIO_MIN = 1.0
  const RATIO_MAX = 3.0
  const ratio = (yieldG != null && doseG != null && doseG > 0) ? yieldG / doseG : null
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
    <div className="w-full">
      <p className="text-xs text-amber-200/50 mb-0 text-center">{subtitle}</p>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <defs>
          <radialGradient id="meshAmber" gradientUnits="userSpaceOnUse"
            cx={PADDING.left + chartW / 2} cy={PADDING.top + chartH / 2} r="90">
            <stop offset="0%"   stopColor="rgba(217,119,6,0.55)" />
            <stop offset="100%" stopColor="rgba(217,119,6,0)" />
          </radialGradient>
          <radialGradient id="meshRust" gradientUnits="userSpaceOnUse"
            cx={PADDING.left} cy={PADDING.top} r="100">
            <stop offset="0%"   stopColor="rgba(185,28,28,0.35)" />
            <stop offset="100%" stopColor="rgba(185,28,28,0)" />
          </radialGradient>
          <radialGradient id="meshCerulean" gradientUnits="userSpaceOnUse"
            cx={PADDING.left + chartW} cy={PADDING.top + chartH} r="100">
            <stop offset="0%"   stopColor="rgba(14,165,233,0.30)" />
            <stop offset="100%" stopColor="rgba(14,165,233,0)" />
          </radialGradient>
          <radialGradient id="meshSlate" gradientUnits="userSpaceOnUse"
            cx={PADDING.left + chartW} cy={PADDING.top + chartH / 2} r="80">
            <stop offset="0%"   stopColor="rgba(71,85,105,0.28)" />
            <stop offset="100%" stopColor="rgba(71,85,105,0)" />
          </radialGradient>

          {aurora && (
            <radialGradient id="auroraGrad" gradientUnits="userSpaceOnUse"
              cx={aurora.cx} cy={aurora.cy} r="80">
              <stop offset="0%"   stopColor="rgba(217,119,6,0.18)" />
              <stop offset="100%" stopColor="rgba(217,119,6,0)" />
            </radialGradient>
          )}

          <filter id="zoneLabelShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="0" stdDeviation="1.5"
              floodColor="rgb(0,0,0)" floodOpacity="0.75" />
          </filter>
        </defs>

        {/* Pass 1 — Hit areas and state overlays (below gradient, captures clicks) */}
        {zones.map(z => {
          const sel = z.taste === selectedTaste
          const isDotZone = z.taste === activeZoneTaste
          return (
            <g key={z.id} style={{ cursor: 'pointer' }} onClick={() => onSelectZone?.(z.taste)}>
              {/* Transparent hit target */}
              <rect x={z.x} y={z.y} width={z.w} height={z.h} fill="rgba(0,0,0,0)" />

              {/* Agreement: dot zone AND selected */}
              {sel && isDotZone && (
                <>
                  <rect x={z.x}   y={z.y}   width={z.w}   height={z.h}
                        fill="rgba(255,255,255,0.10)"
                        stroke="rgba(245,230,211,0.90)" strokeWidth="2.0" />
                  <rect x={z.x+2} y={z.y+2} width={z.w-4} height={z.h-4}
                        fill="rgba(0,0,0,0)"
                        stroke="#d97706" strokeWidth="1.5" opacity="0.9" />
                </>
              )}
              {/* Selected only */}
              {sel && !isDotZone && (
                <rect x={z.x} y={z.y} width={z.w} height={z.h}
                      fill="rgba(255,255,255,0.06)"
                      stroke="rgba(245,230,211,0.80)" strokeWidth="1.5" />
              )}
              {/* Dot zone only */}
              {!sel && isDotZone && (
                <rect x={z.x} y={z.y} width={z.w} height={z.h}
                      fill="rgba(0,0,0,0)"
                      stroke="#d97706" strokeWidth="1.5" opacity="0.9"
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

        {/* Outer boundary rect */}
        <rect data-testid="compass-boundary"
              x={PADDING.left} y={PADDING.top} width={chartW} height={chartH}
              fill="none" stroke="rgba(200,134,10,0.25)" strokeWidth="0.75"
              pointerEvents="none" />

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
                    fill="rgba(245,230,211,1.0)"
                    filter="url(#zoneLabelShadow)">
                <tspan x={cx} dy="-8">{parts[0]}</tspan>
                <tspan x={cx} dy="16">{'& ' + parts[1]}</tspan>
              </text>
            )
          })() : (
            <text key={z.id + '-label'} x={cx} y={cy}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={9} fontFamily="Inter, sans-serif"
                  fill="rgba(245,230,211,1.0)"
                  filter="url(#zoneLabelShadow)">
              {z.taste}
            </text>
          )
        })}

        {/* Axes */}
        <line x1={PADDING.left} y1={PADDING.top} x2={PADDING.left} y2={PADDING.top + chartH}
              stroke="rgba(200,134,10,0.3)" strokeWidth="1" />
        <line x1={PADDING.left} y1={PADDING.top + chartH} x2={PADDING.left + chartW} y2={PADDING.top + chartH}
              stroke="rgba(200,134,10,0.3)" strokeWidth="1" />

        {/* Zone boundary labels annotating the x1 and x2 gridlines — derived from grid, not zoneBoundaries */}
        <text x={x1} y={PADDING.top + chartH + 12} textAnchor="middle" fill="rgba(245,230,211,0.45)" fontSize={9}
              filter="url(#zoneLabelShadow)">{ratioAtX1.toFixed(2)}</text>
        <text x={x2} y={PADDING.top + chartH + 12} textAnchor="middle" fill="rgba(245,230,211,0.45)" fontSize={9}
              filter="url(#zoneLabelShadow)">{ratioAtX2.toFixed(2)}</text>

        {/* Axis labels — directional, no tick marks */}
        <text x={PADDING.left + chartW / 2} y={H - 5} textAnchor="middle"
              fill="rgba(245,230,211,0.65)" fontSize={9} fontFamily="Inter, sans-serif"
              filter="url(#zoneLabelShadow)">Sour  ←  Ratio  →  Bitter</text>
        <text x={10} y={PADDING.top + chartH / 2} textAnchor="middle"
              fill="rgba(245,230,211,0.65)" fontSize={9} fontFamily="Inter, sans-serif"
              filter="url(#zoneLabelShadow)"
              transform={`rotate(-90, 10, ${PADDING.top + chartH / 2})`}>Fast ↕ Slow</text>

        {/* Null-dose callout: show when yieldG present but doseG absent */}
        {nullDoseFallback && (
          <text x={PADDING.left + chartW / 2} y={PADDING.top + chartH / 2}
                textAnchor="middle" dominantBaseline="middle"
                fill="rgba(245,230,211,0.5)" fontSize={9}>Add dose →</text>
        )}

        {/* Live dot */}
        {dotX != null && dotY != null && (
          <g>
            <circle
              cx={dotX} cy={dotY} r="8"
              fill="none" stroke="#d97706" strokeWidth="1"
              className="compass-ping"
              style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
            />
            <circle
              cx={dotX} cy={dotY} r="8"
              fill="none" stroke="#d97706" strokeWidth="1.5" opacity="0.8"
            />
            <circle
              cx={dotX} cy={dotY} r="5"
              fill="rgba(255,255,255,0.88)"
            />
            {timeOutOfRange && (
              <text x={dotX} y={timeSec! < timeMin ? dotY + 16 : dotY - 16}
                    textAnchor="middle" fontSize={9} fill="#f59e0b" opacity="0.9">
                {timeSec! < timeMin ? '▼ Fast shot' : '▲ Slow shot'}
              </text>
            )}
          </g>
        )}
      </svg>
      <div className="flex flex-col gap-1 mt-1">
        <p
          aria-live="polite"
          className="text-xs text-amber-200/80 text-center min-h-[2.5rem] break-words"
        >
          {guidance ?? ''}
        </p>
        {activeZoneTaste && selectedTaste && activeZoneTaste !== selectedTaste && (
          <p className="text-xs text-amber-200/50 text-center">
            Your parameters suggest {activeZoneTaste.toLowerCase()},{' '}
            but you tasted {selectedTaste.toLowerCase()} — taste is personal!
          </p>
        )}
        <p className="text-xs text-amber-200/30 text-center">
          ⬤ Your shot &nbsp;·&nbsp; Zones = extraction outcome
        </p>
      </div>
    </div>
  )
}
