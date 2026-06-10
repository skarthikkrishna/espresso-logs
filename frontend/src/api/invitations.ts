import { apiClient } from './client'
import type { HouseholdRole } from './households'

export interface InvitationPreview {
  household_name: string
  inviter_display_name: string
  invited_role: HouseholdRole
  expires_at: string
  status: 'pending' | 'expired' | 'revoked' | 'accepted'
}

export interface InvitationAcceptResponse {
  household_id: string
  household_name: string
  role: HouseholdRole
  active_household_id?: string
}

export const getInvitationPreview = (token: string): Promise<InvitationPreview> =>
  apiClient.get<InvitationPreview>(`/households/invitations/${encodeURIComponent(token)}`).then((response) => response.data)

export const acceptInvitation = (token: string): Promise<InvitationAcceptResponse> =>
  apiClient.post<InvitationAcceptResponse>(`/households/invitations/${encodeURIComponent(token)}/accept`).then((response) => response.data)

export const declineInvitation = (token: string): Promise<void> =>
  apiClient.post(`/households/invitations/${encodeURIComponent(token)}/decline`).then(() => undefined)
