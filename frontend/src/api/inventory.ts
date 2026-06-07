import { apiClient } from './client'
import type { InventoryBag } from '../types/entities'

export const listInventory = (status?: string) =>
  apiClient
    .get<InventoryBag[]>('/api/inventory', { params: status ? { status } : {} })
    .then((r) => r.data)

export const getInventoryBag = (id: string) =>
  apiClient.get<InventoryBag>(`/api/inventory/${id}`).then((r) => r.data)

export const updateInventoryBagStatus = (id: string, status: InventoryBag['status']) =>
  apiClient.patch<InventoryBag>(`/api/inventory/${id}`, { status }).then((r) => r.data)
