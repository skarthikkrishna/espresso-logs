import { apiClient } from './client'
import type { BrewLogEntry } from '../types/entities'

export interface SubmitShotPayload {
  bag_id: string
  machine_id?: string
  grinder_id?: string
  basket_id?: string
  dose_in_g: number | null
  yield_out_g: number | null
  time_sec: number | null
  grind_setting?: string
  storage_method?: string
  shot_eligibility?: string
  taste_summary?: string
  user_notes?: string
  idempotency_key: string
}

export const listBrewLog = () =>
  apiClient.get<BrewLogEntry[]>('/api/brew-log').then((r) => r.data)

export const getBrewLogDetail = (id: string) =>
  apiClient.get<BrewLogEntry>(`/api/brew-log/${id}`).then((r) => r.data)

export const submitShot = (data: SubmitShotPayload) =>
  apiClient.post<BrewLogEntry>('/api/brew-log', data).then((r) => r.data)

export const getBrewLogFeedback = (id: string) =>
  apiClient.get<{ ai_feedback: string | null }>(`/api/brew-log/${id}/feedback`).then((r) => r.data)
