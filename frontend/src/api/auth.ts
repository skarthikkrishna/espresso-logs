/**
 * auth.ts — typed API client for all /auth/* endpoints.
 *
 * All requests use withCredentials: true (set on the shared apiClient) so the
 * rt HttpOnly cookie is included automatically.
 *
 * AC-103: Access token is never written to localStorage/sessionStorage.
 * AC-104: All functions are typed end-to-end with no `any`.
 */

import { apiClient, refreshAccessToken } from './client'
import type { CurrentUser, Membership } from '../types/entities'

// ---------------------------------------------------------------------------
// Response types (matching API contract — spec §5.1)
// ---------------------------------------------------------------------------

export interface RegisterResponse {
  access_token: string
  token_type: string
  user: {
    id: string
    username: string
    display_name: string
    email: string | null
    picture_url: string | null
  }
}

export interface LoginResponse {
  access_token: string
  token_type: string
}

export interface SwitchHouseholdResponse {
  household_id: string
  household_name: string
  role: Membership['role']
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export const register = (
  username: string,
  password: string,
  displayName: string,
): Promise<RegisterResponse> =>
  apiClient
    .post<RegisterResponse>('/auth/register', {
      username,
      password,
      display_name: displayName,
    })
    .then((r) => r.data)

export const login = (
  username: string,
  password: string,
): Promise<LoginResponse> =>
  apiClient
    .post<LoginResponse>('/auth/login', { username, password })
    .then((r) => r.data)

/** POST /auth/refresh — no body; relies on rt HttpOnly cookie.
 *
 * Delegates to refreshAccessToken() from client.ts so that AuthContext,
 * Login.oauthEffect, AND the Axios 401 interceptor all share a single
 * in-flight promise. Without this, AuthContext.attemptRefresh() and the
 * 401 interceptor each fire independent POST /auth/refresh requests,
 * causing token rotation collision → revoke_all_for_user() → login loop.
 */
export const refresh = (): Promise<LoginResponse> =>
  refreshAccessToken().then((access_token) => ({ access_token, token_type: 'bearer' }))

export const logout = (): Promise<void> =>
  apiClient.post('/auth/logout').then(() => undefined)

export const getMe = (): Promise<CurrentUser> =>
  apiClient.get<CurrentUser>('/auth/me').then((r) => r.data)

/** POST /auth/switch-household — sets active household context server-side. */
export const switchHousehold = (householdId: string): Promise<SwitchHouseholdResponse> =>
  apiClient
    .post<SwitchHouseholdResponse>('/auth/switch-household', { household_id: householdId })
    .then((r) => r.data)
