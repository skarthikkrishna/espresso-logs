/**
 * spec-043 T006 — KaapiAmbientLayer.
 *
 * The single, shared, persistent ambient depth layer. Mounted ONCE at app-shell
 * level (App.tsx, above the router) so it never remounts on route change — this is
 * what keeps the WebGL context count at one and avoids remount multiplication.
 *
 * It is fixed, `aria-hidden`, and non-interactive (`pointer-events: none`), and sits
 * at the deepest layer (z-index below `.app-bg`). The static token gradient
 * (`--kaapi-ambient-static-gradient`) is the sole ambient visual — it is always
 * painted and never blank.
 *
 * NOTE: The animated WebGL drift canvas (KaapiAmbientCanvas) is intentionally
 * disabled. Safari flagged it as a significant battery/energy drain due to the
 * always-on requestAnimationFrame render loop. The static gradient is the designed
 * reduced-motion / no-WebGL fallback and serves as the permanent ambient until a
 * cheaper animated redesign is implemented. KaapiAmbientCanvas / useThreeSurface
 * are retained dormant for future use.
 */
export default function KaapiAmbientLayer() {
  return (
    <div
      aria-hidden="true"
      data-testid="kaapi-ambient"
      className="pointer-events-none fixed inset-0 -z-[2] overflow-hidden"
    >
      <div
        className="absolute inset-0"
        style={{ background: 'var(--kaapi-ambient-static-gradient)' }}
      />
      {/* Animated WebGL ambient disabled for energy/battery — pending cheaper redesign. */}
    </div>
  )
}
