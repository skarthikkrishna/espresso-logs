import { apiClient } from './client'
import type { MaintenanceEvent } from '../types/entities'

export const listMaintenance = (hardwareId?: string) =>
  apiClient
    .get<MaintenanceEvent[]>('/api/maintenance', {
      params: hardwareId ? { hardware_id: hardwareId } : {},
    })
    .then((r) => r.data)

export const createMaintenance = (data: {
  hardware_id: string
  action_type: string
  date: string
  notes?: string
}) => apiClient.post<MaintenanceEvent>('/api/maintenance', data).then((r) => r.data)
