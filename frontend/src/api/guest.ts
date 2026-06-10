import { apiClient } from './client'
import type { BrewLogEntry, CatalogItem, DashboardBag } from '../types/entities'

export interface GuestViewResponse {
  household: { name: string }
  banner: string
  dashboard: {
    active_bags?: DashboardBag[]
    recent_shots?: BrewLogEntry[]
    stats?: Record<string, number | string | null>
  }
  brew_log: {
    entries: BrewLogEntry[]
    pagination?: { page: number; per_page: number; total: number }
  }
  catalog: {
    beans: CatalogItem[]
    compass_summary?: Record<string, number | string | null>
  }
  capabilities: { can_write: false }
}

export const getGuestHouseholdView = (householdId: string, key: string): Promise<GuestViewResponse> =>
  apiClient
    .get<GuestViewResponse>(`/api/guest/households/${householdId}/view`, { params: { key } })
    .then((response) => response.data)
