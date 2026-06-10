import { apiClient } from './client'
import type { Membership } from '../types/entities'

export type HouseholdRole = 'admin' | 'member'

type LegacyMembership = {
  id?: string
  name?: string
  household_id?: string
  household_name?: string
  role: HouseholdRole
  joined_at: string
  member_count?: number
  is_active?: boolean
  can_manage?: boolean
}

export interface HouseholdMember {
  user_id: string
  username: string | null
  display_name: string
  email: string | null
  picture_url: string | null
  role: HouseholdRole
  joined_at: string
  is_self: boolean
}

export interface MemberLimit {
  current: number
  max: number
  can_invite: boolean
}

export interface PendingInvitation {
  invitation_id: string
  label: string
  invited_email: string | null
  invited_role: HouseholdRole
  status: 'pending' | 'expired' | 'accepted' | 'revoked'
  invited_at: string | null
  expires_at: string
  invite_url: string | null
  can_copy: boolean
  can_revoke: boolean
  can_resend: boolean
}

export interface GuestAccess {
  is_active: boolean
  guest_url: string | null
  created_at: string | null
  revoked_at: string | null
  can_copy: boolean
}

export interface HouseholdPermissions {
  can_rename: boolean
  can_delete: boolean
  can_manage_members: boolean
  can_manage_invites: boolean
  can_manage_guest_access: boolean
}

export interface HouseholdDetail {
  id: string
  name: string
  created_at: string
  role: HouseholdRole | null
  member_count: number
  members: HouseholdMember[]
  member_limit: MemberLimit
  pending_invitations: PendingInvitation[]
  guest_access: GuestAccess
  permissions: HouseholdPermissions
}

export interface CreateHouseholdResponse {
  id: string
  name: string
  created_at: string
  role: HouseholdRole
}

export interface CreateInvitationPayload {
  invited_email?: string | null
  invited_role: HouseholdRole
}

export interface InvitationMutationResponse {
  invitation_id: string
  invite_url: string | null
  expires_at: string
  invited_email: string | null
  invited_role: HouseholdRole
  status: PendingInvitation['status']
  delivery?: {
    email_configured: boolean
    email_attempted: boolean
    email_sent: boolean
  }
}

interface RawInvitation {
  invitation_id?: string
  invite_id?: string
  token?: string
  invite_url?: string
  invite_link?: string
  expires_at: string
  invited_at?: string | null
  invited_email?: string | null
  invited_role?: HouseholdRole
  role?: HouseholdRole
  status?: PendingInvitation['status']
  can_copy?: boolean
  can_revoke?: boolean
  can_resend?: boolean
  label?: string
  delivery?: InvitationMutationResponse['delivery']
}

const absoluteInviteUrlFromToken = (token: string | null | undefined): string | null => {
  if (!token) return null
  const path = `/invite/accept?token=${encodeURIComponent(token)}`
  if (typeof window === 'undefined') return path
  return `${window.location.origin}${path}`
}

const normalizeMembership = (membership: LegacyMembership): Membership => ({
  household_id: membership.household_id ?? membership.id ?? '',
  household_name: membership.household_name ?? membership.name ?? 'Household',
  role: membership.role,
  joined_at: membership.joined_at,
  member_count: membership.member_count,
  is_active: membership.is_active,
  can_manage: membership.can_manage ?? membership.role === 'admin',
})

const normalizeInvitation = (invitation: RawInvitation): PendingInvitation => {
  const invitedEmail = invitation.invited_email ?? null
  const invitationId = invitation.invitation_id ?? invitation.invite_id ?? ''
  const role = invitation.invited_role ?? invitation.role ?? 'member'
  const inviteUrl = invitation.invite_url ?? invitation.invite_link ?? absoluteInviteUrlFromToken(invitation.token) ?? null
  const status = invitation.status ?? 'pending'

  return {
    invitation_id: invitationId,
    label: invitation.label ?? invitedEmail ?? 'Link-only invite',
    invited_email: invitedEmail,
    invited_role: role,
    status,
    invited_at: invitation.invited_at ?? null,
    expires_at: invitation.expires_at,
    invite_url: inviteUrl,
    can_copy: invitation.can_copy ?? Boolean(inviteUrl && status === 'pending'),
    can_revoke: invitation.can_revoke ?? status === 'pending',
    can_resend: invitation.can_resend ?? status !== 'accepted',
  }
}

const normalizeInvitationResponse = (invitation: RawInvitation): InvitationMutationResponse => {
  const normalized = normalizeInvitation(invitation)
  return {
    invitation_id: normalized.invitation_id,
    invite_url: normalized.invite_url,
    expires_at: normalized.expires_at,
    invited_email: normalized.invited_email,
    invited_role: normalized.invited_role,
    status: normalized.status,
    delivery: invitation.delivery,
  }
}

export const listHouseholds = (): Promise<Membership[]> =>
  apiClient.get<LegacyMembership[]>('/households/me').then((response) => response.data.map(normalizeMembership))

export const createHousehold = (name: string): Promise<CreateHouseholdResponse> =>
  apiClient.post<CreateHouseholdResponse>('/households', { name }).then((response) => response.data)

export const getHousehold = (householdId: string): Promise<HouseholdDetail> =>
  apiClient.get<HouseholdDetail>(`/households/${householdId}`).then((response) => {
    const raw = response.data
    const members = (raw.members ?? []).map((member) => ({
      user_id: member.user_id,
      username: member.username ?? null,
      display_name: member.display_name,
      email: member.email ?? null,
      picture_url: member.picture_url ?? null,
      role: member.role,
      joined_at: member.joined_at,
      is_self: Boolean(member.is_self),
    }))
    const memberCount = raw.member_count ?? members.length
    return {
      ...raw,
      role: raw.role ?? null,
      member_count: memberCount,
      members,
      member_limit: raw.member_limit ?? { current: memberCount, max: 10, can_invite: memberCount < 10 },
      pending_invitations: (raw.pending_invitations ?? []).map((invitation) =>
        normalizeInvitation(invitation as RawInvitation),
      ),
      guest_access: raw.guest_access ?? {
        is_active: Boolean((raw as { is_guest_accessible?: boolean }).is_guest_accessible),
        guest_url: null,
        created_at: null,
        revoked_at: null,
        can_copy: false,
      },
      permissions: raw.permissions ?? {
        can_rename: true,
        can_delete: true,
        can_manage_members: true,
        can_manage_invites: true,
        can_manage_guest_access: true,
      },
    }
  })

export const renameHousehold = (householdId: string, name: string): Promise<CreateHouseholdResponse> =>
  apiClient.patch<CreateHouseholdResponse>(`/households/${householdId}`, { name }).then((response) => response.data)

export const updateMemberRole = (userId: string, role: HouseholdRole): Promise<HouseholdMember> =>
  apiClient.patch<HouseholdMember>(`/households/members/${userId}`, { role }).then((response) => response.data)

export const removeMember = (userId: string): Promise<void> =>
  apiClient.delete(`/households/members/${userId}`).then(() => undefined)

export const createInvitation = (payload: CreateInvitationPayload): Promise<InvitationMutationResponse> =>
  apiClient.post<RawInvitation>('/households/invitations', payload).then((response) => normalizeInvitationResponse(response.data))

export const revokeInvitation = (invitationId: string): Promise<void> =>
  apiClient.delete(`/households/invitations/${invitationId}`).then(() => undefined)

export const resendInvitation = (invitationId: string): Promise<InvitationMutationResponse> =>
  apiClient.post<RawInvitation>(`/households/invitations/${invitationId}/resend`).then((response) => normalizeInvitationResponse(response.data))

export const generateGuestToken = (householdId: string): Promise<GuestAccess> =>
  apiClient.post<GuestAccess>(`/households/${householdId}/guest-token`).then((response) => ({
    is_active: true,
    guest_url: response.data.guest_url,
    created_at: response.data.created_at ?? new Date().toISOString(),
    revoked_at: null,
    can_copy: response.data.can_copy ?? true,
  }))

export const revokeGuestToken = (householdId: string): Promise<void> =>
  apiClient.delete(`/households/${householdId}/guest-token`).then(() => undefined)

export const deleteHousehold = (householdId: string, confirmName: string): Promise<void> =>
  apiClient.delete(`/households/${householdId}`, { data: { confirm_name: confirmName } }).then(() => undefined)
