/**
 * spec-043 — shot-eligibility → Badge tone mapping.
 *
 * The eligibility tiers map to Aria's spec-043 semantic chip contract:
 * God Shot = success, Good = brand, Passable = warning, Reject = danger.
 * Good Espresso is the persisted API label for the Good tier.
 */
export type EligibilityTone = 'brand' | 'success' | 'warning' | 'danger' | 'neutral'

export function eligibilityBadgeTone(eligibility?: string | null): EligibilityTone {
  switch (eligibility) {
    case 'God Shot':
      return 'success'
    case 'Good':
    case 'Good Espresso':
      return 'brand'
    case 'Passable':
      return 'warning'
    case 'Reject':
      return 'danger'
    default:
      return 'neutral'
  }
}
