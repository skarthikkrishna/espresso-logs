export const kaapiMotionTokens = {
  instant: 0,
  quick: 0.12,
  base: 0.18,
  fluid: 0.32,
  modal: 0.26,
  hero: 0.7,
  staggerCard: 0.045,
  staggerList: 0.035,
} as const

export const kaapiEase = {
  out: 'power2.out',
  inOut: 'power2.inOut',
  spring: 'back.out(1.35)',
  modalOpen: 'power3.out',
  modalClose: 'power2.in',
} as const

/* ── spec-043 T006: named motion / fluidity grammar ───────────────────────────
   Durations are in SECONDS (gsap convention) and mirror the --motion-duration-*
   CSS custom properties in index.css (ms): instant 100 / micro 160 / enter 340 /
   route 560 / ambient-settle 900. Staggers: card 36ms, section 70ms. The exact
   cubic-bezier curves live in the --motion-ease-* CSS vars (used by CSS-driven
   transitions); gsap orchestration uses the closest named eases below. */
export const kaapiMotionGrammar = {
  instant: 0.1,
  micro: 0.16,
  enter: 0.34,
  route: 0.56,
  ambientSettle: 0.9,
  staggerCard: 0.036,
  staggerSection: 0.07,
} as const

export const kaapiGrammarEase = {
  standard: 'power2.out',
  emphasized: 'power3.out',
  exit: 'power2.in',
  press: 'power1.inOut',
} as const

/** Exact CSS cubic-bezier curves (source of truth for --motion-ease-* in index.css). */
export const kaapiGrammarBezier = {
  standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
  emphasized: 'cubic-bezier(0.2, 0, 0, 1)',
  exit: 'cubic-bezier(0.4, 0, 1, 1)',
  press: 'cubic-bezier(0.34, 0, 0.4, 1)',
} as const

/** Depth/reveal caps (px unless noted). Hover/scroll depth is capped to keep motion
   restrained; mobile caps are tighter. Clip reveal travel is in em. */
export const kaapiMotionDepth = {
  hoverMaxDesktop: 4,
  hoverMaxMobile: 2,
  scrollMaxDesktop: 18,
  scrollMaxMobile: 8,
  clipRevealDistanceEm: 0.45,
} as const

/** Shared KaapiAmbientLayer performance constants (mirror design-language §Ambient). */
export const kaapiAmbientConstants = {
  dprMax: 1.5,
  fpsVisible: 30,
  fpsIdle: 8,
  idlePauseMs: 4500,
} as const
