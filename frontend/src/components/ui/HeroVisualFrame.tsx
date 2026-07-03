import type { HTMLAttributes, ReactNode } from 'react'

export type HeroVisualState = 'active' | 'idle' | 'loading' | 'fallback' | 'error'

interface HeroVisualFrameProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  state: HeroVisualState
  active?: ReactNode
  fallback?: ReactNode
  loading?: ReactNode
  maxHeight?: number
  minHeight?: number
  label?: string
}

/**
 * spec-043 T005 — HeroVisualFrame.
 *
 * A solid, elevated hero content surface (`--kaapi-content-surface` +
 * `--kaapi-content-shadow`) that owns the five hero visual states and NEVER receives
 * progressive blur — it is intentionally excluded from the chrome/overlay/sheet blur
 * allowlist (see index.css). The frame is the single home for these states so pages
 * don't re-implement them:
 *
 *  - `active`   — live foreground WebGL/motion node (one of the two allowed contexts)
 *  - `idle`     — pre-activation static poster
 *  - `loading`  — lazy-chunk/preload placeholder
 *  - `fallback` — reduced-motion / no-WebGL static art
 *  - `error`    — dynamic-import error / context-loss
 *
 * `active` renders the provided live node; every non-active state renders static
 * content. If no `fallback`/`active` node is supplied the frame still paints a warm
 * token gradient (`.hero-visual-frame__fallback`) so the hero is never a blank or
 * dark box. All visual layers are decorative (`aria-hidden`); pass `label` only if
 * the frame itself needs an accessible name.
 */
function DefaultFallback() {
  return <div className="hero-visual-frame__fallback absolute inset-0" />
}

function DefaultLoading() {
  return <div className="hero-visual-frame__fallback absolute inset-0 motion-safe:animate-pulse" />
}

export default function HeroVisualFrame({
  state,
  active,
  fallback,
  loading,
  maxHeight = 240,
  minHeight = 180,
  label,
  className = '',
  ...props
}: HeroVisualFrameProps) {
  const fallbackNode = fallback ?? <DefaultFallback />

  let body: ReactNode
  if (state === 'active' && active != null) {
    body = active
  } else if (state === 'loading') {
    body = loading ?? <DefaultLoading />
  } else {
    // idle / fallback / error / active-without-node → static, never blank
    body = fallbackNode
  }

  return (
    <div
      className={`hero-visual-frame ${className}`}
      data-hero-state={state}
      role={label ? 'img' : 'presentation'}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ maxHeight, minHeight: Math.min(minHeight, maxHeight) }}
      {...props}
    >
      {body}
    </div>
  )
}
