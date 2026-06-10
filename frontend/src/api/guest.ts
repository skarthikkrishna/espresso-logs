import { apiClient } from './client'

export interface GuestBag {
  display_name: string
  beans: string | null
  roast_level: string | null
  status: string | null
  storage_method: string | null
}

export interface GuestShot {
  date: string
  bag_display: string
  roast_level: string | null
  machine_name: string | null
  grinder_name: string | null
  basket_name: string | null
  storage_method: string | null
  dose_in_g: number | null
  yield_out_g: number | null
  time_sec: number | null
  shot_eligibility: string | null
  taste_summary: string | null
}

export interface GuestBean {
  roaster: string
  bean_name: string
  roast_level: string
  image_path: string | null
}

export interface GuestViewResponse {
  household: { name: string }
  banner: string
  dashboard: {
    active_bags?: GuestBag[]
    recent_shots?: GuestShot[]
    stats?: Record<string, number | string | null>
  }
  brew_log: {
    entries: GuestShot[]
    pagination?: { page: number; per_page: number; total: number }
  }
  catalog: {
    beans: GuestBean[]
    compass_summary?: Record<string, number | string | null>
  }
  capabilities: { can_write: false }
}

export const getGuestHouseholdView = (householdId: string, key: string): Promise<GuestViewResponse> =>
  apiClient
    .get<GuestViewResponse>(`/api/guest/households/${householdId}/view`, { params: { key } })
    .then((response) => response.data)
