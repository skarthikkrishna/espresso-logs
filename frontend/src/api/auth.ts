import { apiClient } from './client'
import type { CurrentUser } from '../types/entities'

export const getMe = () =>
  apiClient.get<CurrentUser>('/api/me').then((r) => r.data)

export const logout = () =>
  apiClient.post('/api/logout').then((r) => r.data)
