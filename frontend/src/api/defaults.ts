import { apiClient } from './client'
import type { DefaultsPayload } from '../types/entities'

export const getDefaults = (bagId: string, basketId?: string) => {
  const url = basketId
    ? `/api/defaults/${bagId}?basket_id=${encodeURIComponent(basketId)}`
    : `/api/defaults/${bagId}`
  return apiClient.get<DefaultsPayload>(url).then((r) => r.data)
}
