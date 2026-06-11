import { useCallback, useRef } from 'react'
import type { Group, Mesh, PerspectiveCamera, Scene } from 'three'
import { useThreeSurface, type ThreeSurfaceContext } from '../../lib/motion/useThreeSurface'

interface DashboardHero3DProps {
  className?: string
  maxHeight?: number
  testId?: string
}

interface HeroSceneRefs {
  scene?: Scene
  camera?: PerspectiveCamera
  group?: Group
  steamA?: Mesh
  steamB?: Mesh
}

export default function DashboardHero3D({ className = '', maxHeight = 240, testId = 'dashboard-hero-3d-canvas' }: DashboardHero3DProps) {
  const refs = useRef<HeroSceneRefs>({})

  const onInit = useCallback(({ renderer, resourceTracker, three }: ThreeSurfaceContext) => {
    const scene = resourceTracker.track(new three.Scene())
    const camera = new three.PerspectiveCamera(38, 1, 0.1, 100)
    camera.position.set(0, 1.35, 5.7)

    const group = resourceTracker.track(new three.Group())
    scene.add(group)

    const saucerMaterial = resourceTracker.track(new three.MeshStandardMaterial({ color: '#b45309', roughness: 0.72, metalness: 0.04 }))
    const creamMaterial = resourceTracker.track(new three.MeshStandardMaterial({ color: '#f5e6d3', roughness: 0.62, metalness: 0.02 }))
    const amberMaterial = resourceTracker.track(new three.MeshStandardMaterial({ color: '#f59e0b', roughness: 0.58, metalness: 0.02 }))
    const steamMaterial = resourceTracker.track(new three.MeshStandardMaterial({ color: '#f5e6d3', transparent: true, opacity: 0.34, roughness: 0.9 }))

    const saucer = resourceTracker.track(new three.Mesh(resourceTracker.track(new three.CylinderGeometry(1.75, 1.95, 0.16, 72)), saucerMaterial))
    saucer.position.y = -1.05
    saucer.scale.z = 0.36
    group.add(saucer)

    const cup = resourceTracker.track(new three.Mesh(resourceTracker.track(new three.CylinderGeometry(0.82, 1.05, 1.65, 64, 1, true)), creamMaterial))
    cup.position.y = -0.15
    group.add(cup)

    const rim = resourceTracker.track(new three.Mesh(resourceTracker.track(new three.TorusGeometry(0.84, 0.045, 12, 72)), creamMaterial))
    rim.position.y = 0.7
    rim.rotation.x = Math.PI / 2
    rim.scale.z = 0.64
    group.add(rim)

    const crema = resourceTracker.track(new three.Mesh(resourceTracker.track(new three.TorusGeometry(0.58, 0.035, 12, 72)), amberMaterial))
    crema.position.y = 0.72
    crema.rotation.x = Math.PI / 2
    crema.scale.z = 0.52
    group.add(crema)

    const steamA = resourceTracker.track(new three.Mesh(resourceTracker.track(new three.TorusKnotGeometry(0.24, 0.018, 72, 8, 2, 3)), steamMaterial))
    steamA.position.set(-0.25, 1.45, 0)
    steamA.scale.set(0.55, 1.75, 0.35)
    group.add(steamA)

    const steamB = resourceTracker.track(new three.Mesh(resourceTracker.track(new three.TorusKnotGeometry(0.18, 0.014, 64, 8, 2, 3)), steamMaterial.clone()))
    resourceTracker.track(steamB.material)
    steamB.position.set(0.34, 1.34, 0)
    steamB.scale.set(0.42, 1.35, 0.3)
    group.add(steamB)

    const key = resourceTracker.track(new three.PointLight('#f59e0b', 1.1, 12))
    key.position.set(-2.8, 3.4, 3.2)
    scene.add(key)
    const fill = resourceTracker.track(new three.PointLight('#f5e6d3', 0.35, 10))
    fill.position.set(2, 1.6, 4)
    scene.add(fill)
    scene.add(resourceTracker.track(new three.AmbientLight('#1a1209', 1.5)))

    renderer.setClearColor(0x000000, 0)
    refs.current = { scene, camera, group, steamA, steamB }
  }, [])

  const onFrame = useCallback(({ renderer, container }: ThreeSurfaceContext, delta: number, elapsed: number) => {
    const { scene, camera, group, steamA, steamB } = refs.current
    if (!scene || !camera || !group) return
    const rect = container.getBoundingClientRect()
    camera.aspect = Math.max(1, rect.width) / Math.max(1, rect.height)
    camera.updateProjectionMatrix()
    group.rotation.y += Math.min(delta * 0.72, 0.012)
    if (steamA && 'opacity' in steamA.material) steamA.material.opacity = 0.24 + Math.sin(elapsed * 0.9) * 0.08
    if (steamB && 'opacity' in steamB.material) steamB.material.opacity = 0.18 + Math.cos(elapsed * 0.75) * 0.07
    renderer.render(scene, camera)
  }, [])

  const { containerRef, canvasRef } = useThreeSurface({ onInit, onFrame })

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden rounded-[var(--bevel-radius)] border border-amber-400/15 bg-[radial-gradient(circle_at_50%_35%,rgba(245,158,11,0.16),rgba(26,18,9,0.20)_48%,rgba(8,5,3,0.58)_100%)] ${className}`}
      style={{ maxHeight, minHeight: Math.min(maxHeight, 180) }}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} data-testid={testId} aria-hidden="true" className="h-full w-full" />
    </div>
  )
}
