import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { useWebGLSupport } from './useWebGLSupport'

type Disposable = { dispose: () => void }
type Trackable = Disposable | THREE.Object3D | THREE.Material | THREE.Texture | THREE.BufferGeometry

export class ResourceTracker {
  private readonly resources = new Set<Trackable>()

  track<T extends Trackable | null | undefined>(resource: T): T {
    if (resource) {
      this.resources.add(resource)
    }
    return resource
  }

  untrack<T extends Trackable | null | undefined>(resource: T): T {
    if (resource) {
      this.resources.delete(resource)
    }
    return resource
  }

  dispose() {
    this.resources.forEach((resource) => {
      if (resource instanceof THREE.Object3D && resource.parent) {
        resource.parent.remove(resource)
      }
      if ('dispose' in resource && typeof resource.dispose === 'function') {
        resource.dispose()
      }
    })
    this.resources.clear()
  }
}

export interface ThreeSurfaceContext {
  canvas: HTMLCanvasElement
  container: HTMLElement
  renderer: THREE.WebGLRenderer
  resourceTracker: ResourceTracker
  clock: THREE.Clock
  three: typeof THREE
}

export interface UseThreeSurfaceOptions {
  enabled?: boolean
  onInit?: (context: ThreeSurfaceContext) => void | (() => void)
  onFrame?: (context: ThreeSurfaceContext, delta: number, elapsed: number) => void
}

export function useThreeSurface({ enabled = true, onInit, onFrame }: UseThreeSurfaceOptions = {}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const support = useWebGLSupport()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!enabled || !support.supported || !container || !canvas) {
      setReady(false)
      return undefined
    }

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))

    const resourceTracker = new ResourceTracker()
    const clock = new THREE.Clock()
    const context: ThreeSurfaceContext = { canvas, container, renderer, resourceTracker, clock, three: THREE }
    let frameId = 0
    let visible = document.visibilityState === 'visible'
    let onscreen = true
    let disposed = false

    const resize = () => {
      const rect = container.getBoundingClientRect()
      renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false)
    }

    const tick = () => {
      if (disposed) return
      if (visible && onscreen) {
        const delta = clock.getDelta()
        onFrame?.(context, delta, clock.elapsedTime)
      }
      frameId = window.requestAnimationFrame(tick)
    }

    const handleVisibility = () => {
      visible = document.visibilityState === 'visible'
      if (visible) {
        clock.getDelta()
      }
    }

    const resizeObserver = new ResizeObserver(resize)
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      onscreen = entry?.isIntersecting ?? true
      if (onscreen) {
        clock.getDelta()
      }
    })

    resizeObserver.observe(container)
    intersectionObserver.observe(container)
    document.addEventListener('visibilitychange', handleVisibility)
    resize()
    const cleanupInit = onInit?.(context)
    setReady(true)
    frameId = window.requestAnimationFrame(tick)

    return () => {
      disposed = true
      window.cancelAnimationFrame(frameId)
      document.removeEventListener('visibilitychange', handleVisibility)
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
      cleanupInit?.()
      resourceTracker.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      setReady(false)
    }
  }, [enabled, onFrame, onInit, support.supported])

  return { containerRef, canvasRef, ready, webGLSupport: support }
}
