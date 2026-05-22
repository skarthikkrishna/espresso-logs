/**
 * HouseholdSettings page — admin-only household management.
 *
 * Allows household admins to:
 *   - View household details and member list
 *   - Invite new members (with optional email and role)
 *   - Manage pending invitations
 *
 * Rename and delete household flows are placeholders pending backend
 * endpoint availability (Alex's M5 backend gap items).
 *
 * Admin-only: protected by AdminRoute in the router.
 *
 * Spec: functional-spec-v2.md §543, §828-839
 */

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import axios from 'axios'
import { apiClient } from '../api/client'
import { useAuth } from '../contexts/AuthContext'

interface HouseholdMember {
  user_id: string
  username: string
  display_name: string
  role: 'admin' | 'member'
  joined_at: string
}

interface PendingInvitation {
  invite_id: string
  invited_email: string | null
  role: 'admin' | 'member'
  created_at: string
  expires_at: string
}

interface HouseholdDetail {
  household_id: string
  name: string
  members: HouseholdMember[]
  pending_invitations: PendingInvitation[]
}

export default function HouseholdSettings() {
  const { activeHouseholdId } = useAuth()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['household-settings', activeHouseholdId],
    queryFn: async () => {
      const { data } = await apiClient.get<HouseholdDetail>(`/households/${activeHouseholdId ?? ''}`)
      return data
    },
    enabled: Boolean(activeHouseholdId),
  })

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)
  const [isInviting, setIsInviting] = useState(false)

  const handleInvite = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setInviteError(null)
    setInviteSuccess(null)
    setIsInviting(true)

    try {
      const payload: Record<string, string> = { role: inviteRole }
      if (inviteEmail.trim()) payload['email'] = inviteEmail.trim()
      const { data: inv } = await apiClient.post<{ invite_link: string }>(
        `/households/${activeHouseholdId ?? ''}/invite`,
        payload,
      )
      setInviteSuccess(`Invitation created. Share this link: ${inv.invite_link}`)
      setInviteEmail('')
      void refetch()
    } catch (err) {
      if (axios.isAxiosError(err) && !err.response) {
        setInviteError('Unable to connect. Please try again.')
      } else {
        setInviteError('Failed to create invitation. Please try again.')
      }
    } finally {
      setIsInviting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="p-4 flex justify-center pt-12">
        <span className="loading loading-spinner loading-lg text-primary" aria-label="Loading settings" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="p-4">
        <div className="glass-card card-bevel p-6 text-center">
          <p className="text-amber-200 font-medium">Couldn't load household settings</p>
          <button onClick={() => { void refetch() }} className="btn btn-sm btn-outline border-amber-600 text-amber-200 mt-3 btn-bevel">
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h1 className="text-xl font-display text-amber-100 pt-2">Household Settings</h1>

      {/* Household name */}
      <section className="glass-card card-bevel p-5 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-amber-200/80 uppercase tracking-wide mb-1">Household</h2>
            <p className="text-base-content text-lg font-medium">{data.name}</p>
          </div>
          {/* Rename — placeholder until backend PATCH /households/:id is available */}
          <button type="button" className="btn btn-xs btn-ghost opacity-40 cursor-not-allowed" disabled title="Coming soon">
            Rename
          </button>
        </div>
      </section>

      {/* Members */}
      <section className="glass-card card-bevel p-5 space-y-3">
        <h2 className="text-sm font-medium text-amber-200/80 uppercase tracking-wide">Members</h2>
        <ul className="divide-y divide-base-300/30">
          {data.members.map((m) => (
            <li key={m.user_id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <span className="text-base-content">{m.display_name}</span>
                <span className="text-base-content/50 ml-2">@{m.username}</span>
              </div>
              <span className="badge badge-outline badge-xs">{m.role}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Invite */}
      <section className="glass-card card-bevel p-5 space-y-3">
        <h2 className="text-sm font-medium text-amber-200/80 uppercase tracking-wide">Invite a member</h2>
        <form onSubmit={(e) => { void handleInvite(e) }} className="space-y-3">
          <div className="form-control">
            <label className="label" htmlFor="invite-email">
              <span className="label-text text-sm">Email (optional)</span>
            </label>
            <input
              id="invite-email"
              type="email"
              className="input input-bordered input-sm w-full bg-[var(--input-bg)]"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="user@example.com"
            />
          </div>
          <div className="form-control">
            <label className="label" htmlFor="invite-role">
              <span className="label-text text-sm">Role</span>
            </label>
            <select
              id="invite-role"
              className="select select-bordered select-sm w-full bg-[var(--input-bg)]"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as 'member' | 'admin')}
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {inviteError && (
            <p className="text-error text-sm" role="alert">{inviteError}</p>
          )}
          {inviteSuccess && (
            <p className="text-success text-sm break-all" role="status">{inviteSuccess}</p>
          )}

          <button type="submit" className="btn btn-primary btn-sm btn-bevel" disabled={isInviting}>
            {isInviting ? <span className="loading loading-spinner loading-xs" /> : 'Send invitation'}
          </button>
        </form>
      </section>

      {/* Pending invitations */}
      {data.pending_invitations.length > 0 && (
        <section className="glass-card card-bevel p-5 space-y-3">
          <h2 className="text-sm font-medium text-amber-200/80 uppercase tracking-wide">Pending invitations</h2>
          <ul className="divide-y divide-base-300/30">
            {data.pending_invitations.map((inv) => (
              <li key={inv.invite_id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <span className="text-base-content/70">{inv.invited_email ?? 'Open invite'}</span>
                  <span className="badge badge-outline badge-xs ml-2">{inv.role}</span>
                </div>
                <span className="text-base-content/40 text-xs">
                  Expires {new Date(inv.expires_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Danger zone — delete placeholder */}
      <section className="glass-card card-bevel p-5 border border-error/20 space-y-3">
        <h2 className="text-sm font-medium text-error/80 uppercase tracking-wide">Danger zone</h2>
        <button type="button" className="btn btn-error btn-sm btn-outline opacity-40 cursor-not-allowed" disabled title="Coming soon">
          Delete household
        </button>
        <p className="text-base-content/40 text-xs">Household deletion is coming in a future release.</p>
      </section>
    </div>
  )
}
