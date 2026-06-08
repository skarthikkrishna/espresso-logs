/**
 * HouseholdSettings page — admin-only household management surface.
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { apiClient } from '../api/client'
import { useAuth } from '../contexts/AuthContext'

interface HouseholdMember {
  user_id: string
  username: string | null
  display_name: string
  role: 'admin' | 'member'
  joined_at: string
}

interface PendingInvitation {
  invite_id: string
  invited_email: string | null
  role: 'admin' | 'member'
  expires_at: string
  status: 'pending' | 'expired'
}

interface HouseholdDetail {
  id: string
  name: string
  created_at: string
  is_guest_accessible: boolean
  members: HouseholdMember[]
  pending_invitations?: PendingInvitation[]
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unavailable'
  return date.toLocaleDateString()
}

export default function HouseholdSettings() {
  const { activeHouseholdId, user } = useAuth()
  const [householdNameDraft, setHouseholdNameDraft] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)
  const [stubNotice, setStubNotice] = useState<string | null>(null)
  const [isInviting, setIsInviting] = useState(false)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['household-settings', activeHouseholdId],
    queryFn: async () => {
      const response = await apiClient.get<HouseholdDetail>(`/households/${activeHouseholdId ?? ''}`)
      return {
        ...response.data,
        pending_invitations: response.data.pending_invitations ?? [],
      }
    },
    enabled: Boolean(activeHouseholdId),
  })

  const handleInvite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setInviteError(null)
    setInviteSuccess(null)
    setIsInviting(true)

    try {
      const payload: Record<string, string> = { role: inviteRole }
      if (inviteEmail.trim()) payload.email = inviteEmail.trim()

      const { data: invite } = await apiClient.post<{ invite_link?: string; invite_url?: string }>(
        `/households/${activeHouseholdId ?? ''}/invite`,
        payload,
      )
      const inviteLink = invite.invite_link ?? invite.invite_url ?? 'Invitation created.'
      setInviteSuccess(`Invitation created. Share this link: ${inviteLink}`)
      setInviteEmail('')
      void refetch()
    } catch (error) {
      if (axios.isAxiosError(error) && !error.response) {
        setInviteError('Unable to connect. Please try again.')
      } else {
        setInviteError('Failed to create invitation. Please try again.')
      }
    } finally {
      setIsInviting(false)
    }
  }

  const showTodo = (message: string) => {
    setStubNotice(message)
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
          <p className="text-amber-200 font-medium">Couldn&apos;t load household settings</p>
          <button
            onClick={() => {
              void refetch()
            }}
            className="btn btn-sm btn-outline border-amber-600 text-amber-200 mt-3 btn-bevel"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const pendingInvitations = data.pending_invitations ?? []

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">
      <h1 className="text-xl font-display text-amber-100 pt-2">Household settings</h1>

      {stubNotice ? (
        <div className="alert alert-info card-bevel">
          <span>{stubNotice}</span>
        </div>
      ) : null}

      <section className="glass-card card-bevel p-5 space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <label className="form-control flex-1">
            <span className="label-text text-sm text-base-content/60">Household name</span>
            <input
              className="input input-bordered input-styled"
              value={householdNameDraft ?? data.name}
              maxLength={64}
              onChange={(event) => setHouseholdNameDraft(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn btn-primary btn-bevel"
            onClick={() => showTodo(`TODO: wire household rename to PATCH /households/:id (next value: ${householdNameDraft ?? data.name}).`)}
          >
            Save name
          </button>
        </div>
        <p className="text-xs text-base-content/50">Created {formatDate(data.created_at)}</p>
      </section>

      <section className="glass-card card-bevel p-5 space-y-3">
        <h2 className="text-sm font-medium text-amber-200/80 uppercase tracking-wide">Members</h2>
        <ul className="space-y-3">
          {data.members.map((member) => {
            const isSelf = member.user_id === user?.id
            const roleActionLabel = member.role === 'admin' ? 'Demote to member' : 'Promote to admin'
            return (
              <li
                key={member.user_id}
                className="glass-card card-bevel flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-base-content">{member.display_name}</span>
                    <span className="badge badge-outline badge-sm">{member.role}</span>
                    {isSelf ? <span className="badge badge-primary badge-sm">You</span> : null}
                  </div>
                  <p className="text-xs text-base-content/50">
                    {member.username ? `@${member.username} • ` : ''}Joined {formatDate(member.joined_at)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!isSelf ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline btn-bevel"
                      onClick={() => showTodo(`TODO: ${roleActionLabel} API wiring for ${member.display_name}.`)}
                    >
                      {roleActionLabel}
                    </button>
                  ) : null}
                  {!isSelf ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost text-error"
                      onClick={() => showTodo(`TODO: remove-member flow for ${member.display_name}.`)}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="glass-card card-bevel p-5 space-y-3">
        <h2 className="text-sm font-medium text-amber-200/80 uppercase tracking-wide">Invite management</h2>
        <form
          onSubmit={(event) => {
            void handleInvite(event)
          }}
          className="grid gap-3 md:grid-cols-[1fr_auto_auto]"
        >
          <input
            id="invite-email"
            type="email"
            className="input input-bordered input-styled w-full"
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
            placeholder="Email (optional)"
          />
          <select
            id="invite-role"
            className="select select-bordered input-styled w-full"
            value={inviteRole}
            onChange={(event) => setInviteRole(event.target.value as 'member' | 'admin')}
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <button type="submit" className="btn btn-primary btn-bevel" disabled={isInviting}>
            {isInviting ? 'Creating…' : 'Create invite'}
          </button>
        </form>

        {inviteError ? <p className="text-error text-sm" role="alert">{inviteError}</p> : null}
        {inviteSuccess ? <p className="text-success text-sm break-all" role="status">{inviteSuccess}</p> : null}

        <div className="space-y-2">
          <h3 className="text-sm font-medium text-base-content">Pending invitations</h3>
          {pendingInvitations.length === 0 ? (
            <p className="text-sm text-base-content/60">
              Pending invites will appear here once the backend exposes them on the household detail payload.
            </p>
          ) : (
            <ul className="space-y-2">
              {pendingInvitations.map((invite) => (
                <li
                  key={invite.invite_id}
                  className="glass-card card-bevel flex flex-col gap-2 p-3 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="text-sm text-base-content">{invite.invited_email ?? 'Link-only invite'}</p>
                    <p className="text-xs text-base-content/50">
                      {invite.role} • Expires {formatDate(invite.expires_at)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost text-error"
                    onClick={() => showTodo('TODO: revoke invitation API wiring.')}
                  >
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="glass-card card-bevel p-5 space-y-3">
        <h2 className="text-sm font-medium text-amber-200/80 uppercase tracking-wide">Guest access</h2>
        <p className="text-sm text-base-content/60">
          Read-only guest links are available for household sharing. Current status: {data.is_guest_accessible ? 'enabled' : 'not generated'}.
        </p>
        <button
          type="button"
          className="btn btn-outline btn-bevel"
          onClick={() => showTodo('TODO: wire guest-link generate/revoke actions.')}
        >
          {data.is_guest_accessible ? 'Manage guest link' : 'Generate guest link'}
        </button>
      </section>

      <section className="glass-card card-bevel p-5 border border-error/20 space-y-3">
        <h2 className="text-sm font-medium text-error/80 uppercase tracking-wide">Danger zone</h2>
        <button
          type="button"
          className="btn btn-outline btn-error"
          onClick={() => showTodo('TODO: wire household deletion confirmation + API call.')}
        >
          Delete household
        </button>
        <p className="text-xs text-base-content/50">
          Deleting a household is irreversible. The final confirmation flow is still pending backend integration.
        </p>
      </section>
    </div>
  )
}
