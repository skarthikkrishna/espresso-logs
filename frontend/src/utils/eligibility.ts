/**
 * spec-043 — shot-eligibility → Badge tone mapping.
 *
 * The eligibility tiers map to the binding semantic-colour guide in
 * docs/requirements/design-language.md: God Shot uses the amber brand/accent
 * family; Good Espresso is success; Passable is warning; Reject is error/danger;
 * anything else is neutral metadata. Shared by the brew-log list and detail views
 * so the encoding never diverges between surfaces.
 */
export type EligibilityTone = 'brand' | 'success' | 'warning' | 'danger' | 'neutral'

export function eligibilityBadgeTone(eligibility?: string | null): EligibilityTone {
  switch (eligibility) {
    case 'God Shot':
      return 'brand'
    case 'Good Espresso':
      return 'success'
    case 'Passable':
      return 'warning'
    case 'Reject':
      return 'danger'
    default:
      return 'neutral'
  }
}
