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
