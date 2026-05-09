export interface BasketDefaults {
  dose_in_g: number
  yield_out_g: number
  grind_setting: number
}

// Profiles matched via case-insensitive substring of basket name.
// Priority order: IMS → Single Shot → Crema.
// Values sourced from data-model.md §4.
const BASKET_PROFILES: Array<{ keyword: string; defaults: BasketDefaults }> = [
  { keyword: 'ims',                    defaults: { dose_in_g: 18, yield_out_g: 37, grind_setting: 10.5 } },
  { keyword: 'single shot',            defaults: { dose_in_g: 9,  yield_out_g: 18, grind_setting: 13   } },
  { keyword: 'crema 54mm double shot', defaults: { dose_in_g: 17, yield_out_g: 36, grind_setting: 14   } },
]

/**
 * Returns basket-type defaults for a given basket name, or null if no pattern matches.
 * Matching is case-insensitive substring. Priority order: IMS → Single Shot → Crema.
 */
export function getBasketDefaults(basketName: string): BasketDefaults | null {
  const lower = basketName.toLowerCase()
  for (const profile of BASKET_PROFILES) {
    if (lower.includes(profile.keyword)) return profile.defaults
  }
  return null
}
