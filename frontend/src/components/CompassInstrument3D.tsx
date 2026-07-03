import { useCallback, useMemo, useRef, type KeyboardEvent } from 'react'
import type { Group, Mesh, OrthographicCamera, Scene } from 'three'
import { useThreeSurface, type ThreeSurfaceContext } from '../lib/motion/useThreeSurface'
import type { ExtractionCompassViewModel, ExtractionCompassZone } from '../utils/extractionCompassViewModel'
import type { CompassZoneTaste } from '../utils/extractionCompass'
import { COPY } from '../copy'

interface CompassInstrument3DProps {
  model: ExtractionCompassViewModel
  zones: readonly ExtractionCompassZone[]
  reducedMotion: boolean
  onSelectTaste: (taste: CompassZoneTaste) => void
  onContextLost: () => void
}

interface InstrumentRefs {
  scene?: Scene
  camera?: OrthographicCamera
  liveDot?: Mesh
  liveShadow?: Mesh
  tasteRing?: Mesh
  planeGroup?: Group
}

const PLANE_WIDTH = 3.6
const PLANE_HEIGHT = 2.28
const CELL_WIDTH = PLANE_WIDTH / 3
const CELL_HEIGHT = PLANE_HEIGHT / 3

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function cssColor(context: ThreeSurfaceContext, variableName: string) {
  const raw = getComputedStyle(context.container).getPropertyValue(variableName).trim()
  return new context.three.Color(raw || 'white')
}

function zonePosition(zone: Pick<ExtractionCompassZone, 'row' | 'col'>) {
  return {
    x: -PLANE_WIDTH / 2 + CELL_WIDTH * (zone.col + 0.5),
    y: PLANE_HEIGHT / 2 - CELL_HEIGHT * (zone.row + 0.5),
  }
}

function markerPositionForTaste(zones: readonly ExtractionCompassZone[], taste: CompassZoneTaste | null | '') {
  const zone = zones.find((candidate) => candidate.taste === taste)
  return zone ? zonePosition(zone) : null
}

function markerPositionForRecipe(model: ExtractionCompassViewModel) {
  if (model.ratio == null || model.timeSec == null) return null
  const timeRange = model.timeMax - model.timeMin
  return {
    x: -PLANE_WIDTH / 2 + ((clamp(model.ratio, 1, 3) - 1) / 2) * PLANE_WIDTH,
    y: PLANE_HEIGHT / 2 - ((clamp(model.timeSec, model.timeMin, model.timeMax) - model.timeMin) / timeRange) * PLANE_HEIGHT,
  }
}

export default function CompassInstrument3D({ model, zones, reducedMotion, onSelectTaste, onContextLost }: CompassInstrument3DProps) {
  const refs = useRef<InstrumentRefs>({})
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([])
  const computedPosition = useMemo(() => markerPositionForRecipe(model), [model])
  const selectedPosition = useMemo(() => markerPositionForTaste(zones, model.selectedTaste), [model.selectedTaste, zones])

  const onInit = useCallback((context: ThreeSurfaceContext) => {
    const { renderer, resourceTracker, three } = context
    const scene = resourceTracker.track(new three.Scene())
    const camera = new three.OrthographicCamera(-2.35, 2.35, 1.75, -1.75, 0.1, 20)
    camera.position.set(0, 0.35, 5.3)
    camera.lookAt(0, 0, 0)

    const planeGroup = resourceTracker.track(new three.Group())
    planeGroup.rotation.x = -0.16
    planeGroup.rotation.y = 0.08
    scene.add(planeGroup)

    zones.forEach((zone) => {
      const position = zonePosition(zone)
      const material = resourceTracker.track(new three.MeshStandardMaterial({
        color: cssColor(context, `--kk-compass-zone-${zone.row}-${zone.col}`),
        roughness: 0.64,
        metalness: 0.04,
        transparent: true,
        opacity: 0.74,
      }))
      const cell = resourceTracker.track(new three.Mesh(resourceTracker.track(new three.PlaneGeometry(CELL_WIDTH - 0.035, CELL_HEIGHT - 0.035)), material))
      cell.position.set(position.x, position.y, 0)
      planeGroup.add(cell)
    })

    const grooveMaterial = resourceTracker.track(new three.MeshBasicMaterial({
      color: cssColor(context, '--kk-compass-groove'),
      transparent: true,
      opacity: 0.72,
    }))
    for (const x of [-CELL_WIDTH / 2, CELL_WIDTH / 2]) {
      const groove = resourceTracker.track(new three.Mesh(resourceTracker.track(new three.BoxGeometry(0.01, PLANE_HEIGHT, 0.015)), grooveMaterial))
      groove.position.set(x, 0, 0.012)
      planeGroup.add(groove)
    }
    for (const y of [-CELL_HEIGHT / 2, CELL_HEIGHT / 2]) {
      const groove = resourceTracker.track(new three.Mesh(resourceTracker.track(new three.BoxGeometry(PLANE_WIDTH, 0.01, 0.015)), grooveMaterial))
      groove.position.set(0, y, 0.012)
      planeGroup.add(groove)
    }

    const liveDot = resourceTracker.track(new three.Mesh(
      resourceTracker.track(new three.SphereGeometry(0.095, 32, 24)),
      resourceTracker.track(new three.MeshStandardMaterial({
        color: cssColor(context, '--kk-compass-live-dot'),
        roughness: 0.28,
        metalness: 0.05,
      })),
    ))
    liveDot.position.set(0, 0, 0.2)
    liveDot.visible = false
    planeGroup.add(liveDot)

    const liveShadow = resourceTracker.track(new three.Mesh(
      resourceTracker.track(new three.CircleGeometry(0.14, 32)),
      resourceTracker.track(new three.MeshBasicMaterial({
        color: cssColor(context, '--kk-compass-contact-shadow'),
        transparent: true,
        opacity: 0.34,
      })),
    ))
    liveShadow.position.set(0, 0, 0.03)
    liveShadow.visible = false
    planeGroup.add(liveShadow)

    const tasteRing = resourceTracker.track(new three.Mesh(
      resourceTracker.track(new three.TorusGeometry(0.15, 0.018, 12, 48)),
      resourceTracker.track(new three.MeshStandardMaterial({
        color: cssColor(context, '--kk-compass-taste-ring'),
        roughness: 0.38,
        metalness: 0.72,
      })),
    ))
    tasteRing.position.set(0, 0, 0.16)
    tasteRing.visible = false
    planeGroup.add(tasteRing)

    const key = resourceTracker.track(new three.PointLight(cssColor(context, '--kk-compass-key-light'), 1.15, 8))
    key.position.set(-2.2, 2.8, 3.6)
    scene.add(key)
    const rim = resourceTracker.track(new three.PointLight(cssColor(context, '--kk-compass-rim-light'), 0.72, 7))
    rim.position.set(2.6, -2.2, 2.8)
    scene.add(rim)
    scene.add(resourceTracker.track(new three.AmbientLight(cssColor(context, '--kk-compass-ambient-light'), 1.25)))

    renderer.setClearColor(0, 0)
    refs.current = { scene, camera, liveDot, liveShadow, tasteRing, planeGroup }
  }, [zones])

  const onFrame = useCallback(({ renderer, container }: ThreeSurfaceContext, delta: number) => {
    const { scene, camera, liveDot, liveShadow, tasteRing } = refs.current
    if (!scene || !camera || !liveDot || !liveShadow || !tasteRing) return
    const rect = container.getBoundingClientRect()
    const aspect = Math.max(1, rect.width) / Math.max(1, rect.height)
    camera.left = -2.1 * aspect
    camera.right = 2.1 * aspect
    camera.top = 1.65
    camera.bottom = -1.65
    camera.updateProjectionMatrix()

    if (computedPosition) {
      liveDot.visible = true
      liveShadow.visible = true
      const speed = reducedMotion ? 1 : Math.min(1, delta * 8)
      liveDot.position.x += (computedPosition.x - liveDot.position.x) * speed
      liveDot.position.y += (computedPosition.y - liveDot.position.y) * speed
      liveShadow.position.x = liveDot.position.x
      liveShadow.position.y = liveDot.position.y
    } else {
      liveDot.visible = false
      liveShadow.visible = false
    }

    if (selectedPosition) {
      tasteRing.visible = true
      tasteRing.position.x = selectedPosition.x
      tasteRing.position.y = selectedPosition.y
    } else {
      tasteRing.visible = false
    }

    renderer.render(scene, camera)
  }, [computedPosition, reducedMotion, selectedPosition])

  const { containerRef, canvasRef } = useThreeSurface({
    animate: !reducedMotion,
    onInit,
    onFrame,
    onContextLost,
    onUnavailable: onContextLost,
  })

  const handleZoneKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const current = zones[index]
    let nextIndex = index
    if (!current) return
    if (event.key === 'ArrowRight') nextIndex = current.row * 3 + ((current.col + 1) % 3)
    if (event.key === 'ArrowLeft') nextIndex = current.row * 3 + ((current.col + 2) % 3)
    if (event.key === 'ArrowDown') nextIndex = ((current.row + 1) % 3) * 3 + current.col
    if (event.key === 'ArrowUp') nextIndex = ((current.row + 2) % 3) * 3 + current.col
    if (nextIndex !== index) {
      event.preventDefault()
      buttonRefs.current[nextIndex]?.focus()
    }
  }

  return (
    <div ref={containerRef} className="kk-compass-3d" data-testid="compass-3d-instrument">
      <canvas ref={canvasRef} className="kk-compass-3d__canvas" aria-hidden="true" tabIndex={-1} />
      <div className="kk-compass-3d__labels" aria-label={COPY.compass.subjectiveSelectorLabel}>
        {zones.map((zone, index) => {
          const isComputed = zone.taste === model.computedTaste
          const isSelected = zone.taste === model.selectedTaste
          return (
            <button
              key={zone.id}
              ref={(node) => { buttonRefs.current[index] = node }}
              type="button"
              className="kk-compass-3d__zone-button"
              data-computed={isComputed ? 'true' : undefined}
              data-selected={isSelected ? 'true' : undefined}
              onClick={() => onSelectTaste(zone.taste)}
              onKeyDown={(event) => handleZoneKeyDown(event, index)}
              aria-label={COPY.compass.selectTasteProfile(zone.taste)}
              aria-pressed={isSelected}
            >
              <span className="kk-compass-3d__zone-label">{zone.taste}</span>
              {isComputed && <span className="kk-compass-3d__marker-label">{COPY.compass.computedDiagnosisLabel}</span>}
              {isSelected && <span className="kk-compass-3d__marker-label">{COPY.compass.subjectiveTasteLabel}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
