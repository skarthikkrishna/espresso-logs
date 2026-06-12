import { useCallback, useRef } from 'react'
import type { Mesh, PerspectiveCamera, Scene } from 'three'
import { useThreeSurface, type ThreeSurfaceContext } from '../../lib/motion/useThreeSurface'

interface ExtractionBrewViz3DProps {
  doseGrams: number
  yieldGrams: number
  timeSeconds: number
  className?: string
  testId?: string
}

interface BrewRefs {
  scene?: Scene
  camera?: PerspectiveCamera
  puck?: Mesh
  liquid?: Mesh
  ring?: Mesh
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export default function ExtractionBrewViz3D({ doseGrams, yieldGrams, timeSeconds, className = '', testId = 'extraction-brew-viz-canvas' }: ExtractionBrewViz3DProps) {
  const refs = useRef<BrewRefs>({})

  const onInit = useCallback(({ renderer, resourceTracker, three }: ThreeSurfaceContext) => {
    const scene = resourceTracker.track(new three.Scene())
    const camera = new three.PerspectiveCamera(38, 1, 0.1, 100)
    camera.position.set(0, 1.55, 6.2)

    const baseMaterial = resourceTracker.track(new three.MeshStandardMaterial({ color: '#5b3412', roughness: 0.82 }))
    const liquidMaterial = resourceTracker.track(new three.MeshStandardMaterial({ color: '#f59e0b', roughness: 0.5, metalness: 0.02, transparent: true, opacity: 0.82 }))
    const ringMaterial = resourceTracker.track(new three.MeshStandardMaterial({ color: '#f5e6d3', roughness: 0.6, transparent: true, opacity: 0.34 }))

    const puck = resourceTracker.track(new three.Mesh(resourceTracker.track(new three.CylinderGeometry(1.25, 1.45, 0.34, 64)), baseMaterial))
    puck.position.y = -0.92
    puck.scale.z = 0.42
    scene.add(puck)

    const liquid = resourceTracker.track(new three.Mesh(resourceTracker.track(new three.CylinderGeometry(0.36, 0.48, 1, 48)), liquidMaterial))
    liquid.position.y = -0.28
    liquid.scale.z = 0.46
    scene.add(liquid)

    const ring = resourceTracker.track(new three.Mesh(resourceTracker.track(new three.TorusGeometry(1.28, 0.045, 12, 96)), ringMaterial))
    ring.position.y = 0.45
    ring.rotation.x = Math.PI / 2
    ring.scale.z = 0.5
    scene.add(ring)

    const key = resourceTracker.track(new three.PointLight('#f59e0b', 1.05, 12))
    key.position.set(-2.7, 3.2, 3.4)
    scene.add(key)
    const fill = resourceTracker.track(new three.PointLight('#f5e6d3', 0.35, 10))
    fill.position.set(2.3, 1.6, 4.2)
    scene.add(fill)
    scene.add(resourceTracker.track(new three.AmbientLight('#1a1209', 1.55)))

    renderer.setClearColor(0x000000, 0)
    refs.current = { scene, camera, puck, liquid, ring }
  }, [])

  const onFrame = useCallback(({ renderer, container }: ThreeSurfaceContext, delta: number, elapsed: number) => {
    const { scene, camera, puck, liquid, ring } = refs.current
    if (!scene || !camera || !puck || !liquid || !ring) return
    const doseScale = clamp(doseGrams / 18, 0.75, 1.35)
    const yieldScale = clamp(yieldGrams / 36, 0.55, 1.55)
    const timeScale = clamp(timeSeconds / 28, 0.65, 1.5)
    puck.scale.y += ((0.65 * doseScale) - puck.scale.y) * Math.min(1, delta * 4)
    liquid.scale.y += ((1.18 * yieldScale) - liquid.scale.y) * Math.min(1, delta * 4)
    liquid.position.y = -0.72 + liquid.scale.y * 0.5
    ring.rotation.z += delta * clamp(0.18 * timeScale, 0.08, 0.28)
    ring.scale.x = 1 + Math.sin(elapsed * clamp(timeScale, 0.7, 1.4)) * 0.018
    const rect = container.getBoundingClientRect()
    camera.aspect = Math.max(1, rect.width) / Math.max(1, rect.height)
    camera.updateProjectionMatrix()
    renderer.render(scene, camera)
  }, [doseGrams, yieldGrams, timeSeconds])

  const { containerRef, canvasRef } = useThreeSurface({ onInit, onFrame })

  return (
    <div
      ref={containerRef}
      className={`relative h-[220px] overflow-hidden rounded-[var(--bevel-radius)] border border-amber-400/15 bg-[radial-gradient(circle_at_50%_40%,rgba(245,158,11,0.14),rgba(26,18,9,0.18)_46%,rgba(8,5,3,0.64)_100%)] ${className}`}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} data-testid={testId} aria-hidden="true" className="h-full w-full" />
    </div>
  )
}
