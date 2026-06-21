import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { ResourceTracker } from '../../lib/motion/useThreeSurface'
import { kaapiAmbientConstants } from '../../lib/motion/tokens'

/**
 * spec-043 T006 — KaapiAmbientCanvas (lazy WebGL drift field).
 *
 * The single shared ambient WebGL context (one of the allowed three contexts: two
 * foreground heroes + this). A restrained, token-driven gradient/drift field —
 * subtle calm depth ONLY, never fog/smoke/particle spectacle. Guardrails:
 *  - DPR capped at KAAPI_AMBIENT_DPR_MAX (1.5)
 *  - visible cadence ≤ KAAPI_AMBIENT_FPS_VISIBLE (30fps); after
 *    KAAPI_AMBIENT_IDLE_PAUSE_MS (4500ms) of no pointer/scroll input it drops to
 *    KAAPI_AMBIENT_FPS_IDLE (8fps)
 *  - hidden tab is fully paused
 *  - resources disposed + forceContextLoss on unmount
 *
 * Colours are read from the --kaapi-ambient-* CSS tokens with design-language
 * fallbacks, so the field stays token-driven. The exact visual is intentionally
 * restrained and FLAGGED for Aria's Stage-2 review (the ambient visual is
 * underspecified beyond tokens/guardrails — see commit/handoff).
 */
const VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const FRAG = `
  precision mediump float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec3 uClear;
  uniform vec3 uWarm;
  uniform vec3 uGold;
  uniform vec3 uCopper;

  float blob(vec2 uv, vec2 c, float r) {
    return smoothstep(r, 0.0, distance(uv, c));
  }

  void main() {
    vec2 uv = vUv;
    float t = uTime * 0.05;
    vec2 warmC = vec2(0.30 + 0.05 * sin(t * 0.7), 0.34 + 0.04 * cos(t * 0.5));
    vec2 goldC = vec2(0.74 + 0.04 * cos(t * 0.6), 0.24 + 0.05 * sin(t * 0.8));
    vec2 copperC = vec2(0.55 + 0.05 * sin(t * 0.4), 0.82 + 0.03 * cos(t * 0.6));

    vec3 col = uClear;
    col = mix(col, uWarm, blob(uv, warmC, 0.46) * 0.55);
    col = mix(col, uCopper, blob(uv, copperC, 0.50) * 0.38);
    col = mix(col, uGold, blob(uv, goldC, 0.34) * 0.22);

    float vig = smoothstep(1.15, 0.25, distance(uv, vec2(0.5)));
    col *= mix(0.80, 1.0, vig);
    gl_FragColor = vec4(col, 1.0);
  }
`

const FALLBACK_COLORS = {
  clear: '#120b06',
  warm: 'rgb(180, 83, 9)',
  gold: 'rgb(190, 151, 87)',
  copper: 'rgb(115, 74, 55)',
}

function readColor(styles: CSSStyleDeclaration, name: string, fallback: string): THREE.Color {
  const raw = styles.getPropertyValue(name).trim()
  // rgba(...) tokens: strip alpha so the colour mixes as a hue, not a blend weight.
  const rgba = raw.match(/rgba?\(([^)]+)\)/)
  if (rgba) {
    const [r, g, b] = rgba[1].split(',').map((n) => parseFloat(n.trim()))
    if ([r, g, b].every((n) => Number.isFinite(n))) {
      return new THREE.Color(r / 255, g / 255, b / 255)
    }
  }
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) {
    return new THREE.Color(raw)
  }
  return new THREE.Color(fallback)
}

export default function KaapiAmbientCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return undefined

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: false, powerPreference: 'low-power' })
    } catch {
      return undefined
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, kaapiAmbientConstants.dprMax))

    const tracker = new ResourceTracker()
    const scene = new THREE.Scene()
    const camera = new THREE.Camera()
    const geometry = tracker.track(new THREE.PlaneGeometry(2, 2))

    const rootStyles = getComputedStyle(document.documentElement)
    const material = tracker.track(
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uClear: { value: readColor(rootStyles, '--kaapi-ambient-clear', FALLBACK_COLORS.clear) },
          uWarm: { value: readColor(rootStyles, '--kaapi-ambient-warm-fog', FALLBACK_COLORS.warm) },
          uGold: { value: readColor(rootStyles, '--kaapi-ambient-cool-glint', FALLBACK_COLORS.gold) },
          uCopper: { value: readColor(rootStyles, '--kaapi-ambient-depth-teal', FALLBACK_COLORS.copper) },
        },
      }),
    )
    const mesh = tracker.track(new THREE.Mesh(geometry, material))
    scene.add(mesh)

    const resize = () => {
      const rect = container.getBoundingClientRect()
      renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false)
    }
    resize()

    const visibleInterval = 1000 / kaapiAmbientConstants.fpsVisible
    const idleInterval = 1000 / kaapiAmbientConstants.fpsIdle
    let frameId = 0
    let lastRender = 0
    let lastActivity = performance.now()
    const startTime = performance.now()
    let disposed = false

    const markActivity = () => {
      lastActivity = performance.now()
    }

    const tick = (now: number) => {
      frameId = window.requestAnimationFrame(tick)
      if (disposed || document.hidden) return
      const idle = now - lastActivity > kaapiAmbientConstants.idlePauseMs
      const interval = idle ? idleInterval : visibleInterval
      if (now - lastRender < interval) return
      lastRender = now
      material.uniforms.uTime.value = (now - startTime) / 1000
      renderer.render(scene, camera)
    }

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(container)
    window.addEventListener('pointermove', markActivity, { passive: true })
    window.addEventListener('scroll', markActivity, { passive: true })
    window.addEventListener('pointerdown', markActivity, { passive: true })
    window.addEventListener('keydown', markActivity)

    frameId = window.requestAnimationFrame(tick)

    return () => {
      disposed = true
      window.cancelAnimationFrame(frameId)
      resizeObserver.disconnect()
      window.removeEventListener('pointermove', markActivity)
      window.removeEventListener('scroll', markActivity)
      window.removeEventListener('pointerdown', markActivity)
      window.removeEventListener('keydown', markActivity)
      tracker.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
    }
  }, [])

  return (
    <div ref={containerRef} className="absolute inset-0">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  )
}
