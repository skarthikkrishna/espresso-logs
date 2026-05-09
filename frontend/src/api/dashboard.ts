import { apiClient } from './client'
import type { DashboardBag } from '../types/entities'

export const getDashboard = () =>
  apiClient.get<DashboardBag[]>('/api/dashboard').then((r) => r.data)
