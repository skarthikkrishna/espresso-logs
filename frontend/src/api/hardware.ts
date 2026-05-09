import { apiClient } from './client'
import type { HardwareItem, HardwareDetail } from '../types/entities'

export const listHardware = () =>
  apiClient.get<HardwareItem[]>('/api/hardware').then((r) => r.data)

export const getHardwareDetail = (id: string) =>
  apiClient.get<HardwareDetail>(`/api/hardware/${id}`).then((r) => r.data)

export const createHardware = (data: { category: string; name: string; product_url?: string }) =>
  apiClient.post<HardwareItem>('/api/hardware', data).then((r) => r.data)

export const updateHardware = (id: string, data: { name: string; category: string }) =>
  apiClient.put<HardwareItem>(`/api/hardware/${id}`, data).then((r) => r.data)

export const getActionTypes = () =>
  apiClient.get<{ action_types: Record<string, string[]> }>('/api/hardware/action-types').then((r) => r.data)

export const uploadHardwareImage = (id: string, file: File) => {
  const form = new FormData()
  form.append('file', file)
  return apiClient
    .post<{ image_path: string }>(`/api/hardware/${id}/image`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data)
}
