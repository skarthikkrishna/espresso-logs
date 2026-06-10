import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { getMe } from '../api/auth'
import {
  createInvitation,
  deleteHousehold,
  generateGuestToken,
  getHousehold,
  removeMember,
  renameHousehold,
  resendInvitation,
  revokeGuestToken,
  revokeInvitation,
  updateMemberRole,
  type HouseholdMember,
  type HouseholdRole,
  type PendingInvitation,
} from '../api/households'
import { householdKeys } from '../api/queryKeys'
import { useAuth } from '../contexts/AuthContext'
import AccessibleDialog from '../components/AccessibleDialog'

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Unavailable'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unavailable'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function apiErrorMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) return fallback
  const status = error.response?.status
  const detail = error.response?.data?.detail
  if (typeof detail === 'string') {
    if (/duplicate/i.test(detail)) return 'An invitation to this address is already pending.'
    if (/already.*member/i.test(detail)) return 'This person is already a member.'
    if (/last admin|sole admin/i.test(detail)) return 'Every household needs at least one admin.'
    if (/self|yourself/i.test(detail)) return 'You cannot remove yourself from the household.'
    if (/limit/i.test(detail)) return 'Member limit reached (10/10)'
    return detail
  }
  if (status === 403) return 'Only admins can access household settings.'
  if (status === 409) return 'Every household needs at least one admin.'
  if (status === 422) return 'Validation failed. Please check the highlighted fields.'
  if (!error.response) return 'Unable to connect. Please check your connection.'
  return fallback
}

function monogramFor(member: Pick<HouseholdMember, 'display_name' | 'username'>): string {
  const source = member.display_name || member.username || 'Member'
  return source.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'M'
}

async function copyText(text: string): Promise<void> {
  if (!navigator.clipboard) throw new Error('Clipboard unavailable')
  await navigator.clipboard.writeText(text)
}

export default function HouseholdSettings() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { activeHouseholdId, activeMembership, user, setUser } = useAuth()
  const [householdNameDraft, setHouseholdNameDraft] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<HouseholdRole>('member')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [latestInviteUrl, setLatestInviteUrl] = useState<string | null>(null)
  const [memberToRemove, setMemberToRemove] = useState<HouseholdMember | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirmName, setDeleteConfirmName] = useState('')

  const queryKey = householdKeys.settings(activeHouseholdId)
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey,
    queryFn: () => getHousehold(activeHouseholdId!),
    enabled: Boolean(activeHouseholdId),
  })

  const householdName = data?.name ?? ''
  const adminCount = useMemo(() => data?.members.filter((member) => member.role === 'admin').length ?? 0, [data?.members])
  const isAdmin = activeMembership?.role === 'admin'
  const inviteDisabled = !data?.member_limit.can_invite

  const invalidateSettings = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: householdKeys.settings(activeHouseholdId) }),
      queryClient.invalidateQueries({ queryKey: householdKeys.list }),
      queryClient.invalidateQueries({ queryKey: householdKeys.detail(activeHouseholdId) }),
    ])
  }

  const renameMutation = useMutation({
    mutationFn: (name: string) => renameHousehold(activeHouseholdId!, name),
    onSuccess: async () => {
      setStatusMessage('Household name saved.')
      setErrorMessage(null)
      setHouseholdNameDraft('')
      await invalidateSettings()
    },
    onError: (err) => setErrorMessage(apiErrorMessage(err, 'Could not save household name.')),
  })

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: HouseholdRole }) => updateMemberRole(userId, role),
    onSuccess: async () => {
      setStatusMessage('Member role updated.')
      setErrorMessage(null)
      await invalidateSettings()
    },
    onError: (err) => setErrorMessage(apiErrorMessage(err, 'Could not update member role.')),
  })

  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeMember(userId),
    onSuccess: async () => {
      setStatusMessage('Member removed.')
      setErrorMessage(null)
      setMemberToRemove(null)
      await invalidateSettings()
    },
    onError: (err) => setErrorMessage(apiErrorMessage(err, 'Could not remove member.')),
  })

  const inviteMutation = useMutation({
    mutationFn: () => createInvitation({
      invited_email: inviteEmail.trim() || null,
      invited_role: inviteRole,
    }),
    onSuccess: async (invite) => {
      setInviteEmail('')
      setLatestInviteUrl(invite.invite_url)
      setStatusMessage('Invite link created. No email is sent — copy and share the link yourself.')
      setErrorMessage(null)
      await invalidateSettings()
    },
    onError: (err) => setErrorMessage(apiErrorMessage(err, 'Failed to create invitation.')),
  })

  const revokeInviteMutation = useMutation({
    mutationFn: (invitationId: string) => revokeInvitation(invitationId),
    onSuccess: async () => {
      setStatusMessage('Invitation revoked.')
      setErrorMessage(null)
      await invalidateSettings()
    },
    onError: (err) => setErrorMessage(apiErrorMessage(err, 'Could not revoke invitation.')),
  })

  const resendInviteMutation = useMutation({
    mutationFn: (invitationId: string) => resendInvitation(invitationId),
    onSuccess: async (invite) => {
      setLatestInviteUrl(invite.invite_url)
      setStatusMessage('Invitation resent with a fresh link.')
      setErrorMessage(null)
      await invalidateSettings()
    },
    onError: (err) => setErrorMessage(apiErrorMessage(err, 'Could not resend invitation.')),
  })

  const guestGenerateMutation = useMutation({
    mutationFn: () => generateGuestToken(activeHouseholdId!),
    onSuccess: async (guest) => {
      setStatusMessage('Guest link generated. Copy it before sharing.')
      setErrorMessage(null)
      queryClient.setQueryData(queryKey, data ? { ...data, guest_access: guest } : data)
      await invalidateSettings()
    },
    onError: (err) => setErrorMessage(apiErrorMessage(err, 'Could not generate guest link.')),
  })

  const guestRevokeMutation = useMutation({
    mutationFn: () => revokeGuestToken(activeHouseholdId!),
    onSuccess: async () => {
      setStatusMessage('Guest link revoked.')
      setErrorMessage(null)
      await invalidateSettings()
    },
    onError: (err) => setErrorMessage(apiErrorMessage(err, 'Could not revoke guest link.')),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteHousehold(activeHouseholdId!, deleteConfirmName),
    onSuccess: async () => {
      const userData = await getMe()
      setUser(userData)
      setStatusMessage('Household deleted.')
      setDeleteOpen(false)
      setDeleteConfirmName('')
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] === 'households' })
      navigate(userData.memberships && userData.memberships.length > 0 ? '/' : '/welcome', { replace: true })
    },
    onError: (err) => setErrorMessage(apiErrorMessage(err, 'Could not delete household.')),
  })

  const handleCopy = async (text: string | null | undefined, label: string) => {
    if (!text) {
      setErrorMessage('No link is available to copy.')
      return
    }
    try {
      await copyText(text)
      setStatusMessage(`${label} copied.`)
      setErrorMessage(null)
    } catch {
      setErrorMessage('Copy failed. Select and copy the link manually.')
    }
  }

  if (!activeHouseholdId) {
    return (
      <div className="mx-auto max-w-xl p-4 md:p-6">
        <div className="glass-card card-bevel p-6 text-center">
          <h1 className="font-display text-2xl text-amber-100">No active household</h1>
          <p className="mt-2 text-sm text-base-content/70">Create a household or accept an invitation before opening settings.</p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-xl p-4 md:p-6">
        <div className="alert alert-warning card-bevel" role="alert">
          <span>Only admins can access household settings.</span>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex justify-center p-8" role="status" aria-live="polite">
        <span className="loading loading-spinner loading-lg text-primary" aria-label="Loading settings" />
        <span className="sr-only">Loading settings</span>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="p-4">
        <div className="glass-card card-bevel p-6 text-center">
          <p className="font-medium text-amber-200">Couldn&apos;t load household settings</p>
          <p className="mt-1 text-sm text-base-content/60">{apiErrorMessage(error, 'Please retry.')}</p>
          <button onClick={() => { void refetch() }} className="btn btn-sm btn-outline btn-bevel mt-3">
            Retry
          </button>
        </div>
      </div>
    )
  }

  const draftName = householdNameDraft || householdName
  const nameInvalid = draftName.trim().length === 0 || draftName.trim().length > 64
  const canSaveName = draftName.trim() !== householdName && !nameInvalid && !renameMutation.isPending

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 pb-32 md:p-6 lg:pb-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-amber-300/60">Admin</p>
          <h1 className="font-display text-3xl text-amber-100">Household settings</h1>
        </div>
        <span className="badge badge-outline">{data.member_count} / {data.member_limit.max} members</span>
      </div>

      {statusMessage ? <div className="alert alert-success card-bevel" aria-live="polite"><span>{statusMessage}</span></div> : null}
      {errorMessage ? <div className="alert alert-error card-bevel" role="alert"><span>{errorMessage}</span></div> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <section className="glass-card card-bevel p-5 space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <label className="form-control flex-1">
                <span className="label-text text-sm text-base-content/60">Household name</span>
                <input
                  className={`input input-bordered input-styled ${nameInvalid ? 'input-error' : ''}`}
                  value={draftName}
                  maxLength={64}
                  onChange={(event) => setHouseholdNameDraft(event.target.value)}
                  aria-invalid={nameInvalid}
                />
              </label>
              <button
                type="button"
                className="btn btn-primary btn-bevel"
                disabled={!canSaveName}
                onClick={() => renameMutation.mutate(draftName.trim())}
              >
                {renameMutation.isPending ? 'Saving…' : 'Save name'}
              </button>
            </div>
            <p className="text-xs text-base-content/50">Created {formatDate(data.created_at)}</p>
          </section>

          <section className="glass-card card-bevel p-5 space-y-3">
            <h2 className="text-sm font-medium uppercase tracking-wide text-amber-200/80">Members</h2>
            <ul className="space-y-3">
              {data.members.map((member) => {
                const isSelf = member.is_self || member.user_id === user?.id
                const nextRole: HouseholdRole = member.role === 'admin' ? 'member' : 'admin'
                const roleActionLabel = member.role === 'admin' ? 'Demote to member' : 'Promote to admin'
                const lastAdminDemotion = member.role === 'admin' && adminCount <= 1
                return (
                  <li key={member.user_id} className="glass-card card-bevel flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      {member.picture_url ? (
                        <img src={member.picture_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-500/15 text-sm font-semibold text-amber-200" aria-hidden="true">
                          {monogramFor(member)}
                        </span>
                      )}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-medium text-base-content">{member.display_name}</span>
                          <span className="badge badge-outline badge-sm capitalize">{member.role}</span>
                          {isSelf ? <span className="badge badge-primary badge-sm">You</span> : null}
                        </div>
                        <p className="text-xs text-base-content/50">
                          {member.email ? `${member.email} • ` : ''}{member.username ? `@${member.username} • ` : ''}Joined {formatDate(member.joined_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!isSelf ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline btn-bevel"
                          disabled={roleMutation.isPending || lastAdminDemotion}
                          title={lastAdminDemotion ? 'Every household needs at least one admin.' : undefined}
                          onClick={() => roleMutation.mutate({ userId: member.user_id, role: nextRole })}
                        >
                          {roleActionLabel}
                        </button>
                      ) : null}
                      {!isSelf ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost text-error"
                          disabled={removeMutation.isPending}
                          onClick={() => setMemberToRemove(member)}
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

          <section className="glass-card card-bevel p-5 space-y-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-sm font-medium uppercase tracking-wide text-amber-200/80">Invite management</h2>
              <p className="text-sm text-base-content/60">Email is optional — it labels who this invite is for. No email is sent. Copy and share the link yourself.</p>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                inviteMutation.mutate()
              }}
              className="grid gap-3 md:grid-cols-[1fr_auto_auto]"
            >
              <label className="sr-only" htmlFor="invite-email">Invite email</label>
              <input
                id="invite-email"
                type="email"
                className="input input-bordered input-styled w-full"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="Email (optional)"
              />
              <label className="sr-only" htmlFor="invite-role">Invite role</label>
              <select
                id="invite-role"
                className="select select-bordered input-styled w-full"
                value={inviteRole}
                onChange={(event) => setInviteRole(event.target.value as HouseholdRole)}
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <button
                type="submit"
                className="btn btn-primary btn-bevel"
                disabled={inviteMutation.isPending || inviteDisabled}
                title={inviteDisabled ? 'Member limit reached (10/10)' : undefined}
              >
                {inviteMutation.isPending ? 'Creating…' : 'Create invite link'}
              </button>
            </form>
            {inviteDisabled ? <p className="text-sm text-warning">Member limit reached (10/10)</p> : null}
            {latestInviteUrl ? (
              <div className="rounded-xl border border-amber-700/30 bg-amber-950/30 p-3">
                <p className="text-xs uppercase tracking-wide text-amber-200/70">Latest invitation link</p>
                <p className="mt-1 break-all text-sm text-base-content/75">{latestInviteUrl}</p>
                <button type="button" className="btn btn-sm btn-outline btn-bevel mt-3" onClick={() => { void handleCopy(latestInviteUrl, 'Invitation link') }}>
                  Copy latest link
                </button>
              </div>
            ) : null}

            <div className="space-y-2">
              <h3 className="text-sm font-medium text-base-content">Pending invitations</h3>
              {data.pending_invitations.length === 0 ? (
                <p className="text-sm text-base-content/60">No pending invitations.</p>
              ) : (
                <ul className="space-y-2">
                  {data.pending_invitations.map((invite: PendingInvitation) => (
                    <li key={invite.invitation_id} className="glass-card card-bevel flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm text-base-content">{invite.label}</p>
                          <span className="badge badge-outline badge-sm capitalize">{invite.invited_role}</span>
                          <span className={`badge badge-sm ${invite.status === 'pending' ? 'badge-primary' : 'badge-warning'}`}>{invite.status}</span>
                        </div>
                        <p className="text-xs text-base-content/50">Expires {formatDate(invite.expires_at)}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {invite.can_copy && invite.invite_url ? (
                          <button type="button" className="btn btn-sm btn-outline btn-bevel" onClick={() => { void handleCopy(invite.invite_url, 'Invitation link') }}>
                            Copy
                          </button>
                        ) : null}
                        {invite.can_resend ? (
                          <button type="button" className="btn btn-sm btn-outline btn-bevel" disabled={resendInviteMutation.isPending} onClick={() => resendInviteMutation.mutate(invite.invitation_id)}>
                            Resend
                          </button>
                        ) : null}
                        {invite.can_revoke ? (
                          <button type="button" className="btn btn-sm btn-ghost text-error" disabled={revokeInviteMutation.isPending} onClick={() => revokeInviteMutation.mutate(invite.invitation_id)}>
                            Revoke
                          </button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="glass-card card-bevel p-5 space-y-3">
            <h2 className="text-sm font-medium uppercase tracking-wide text-amber-200/80">Guest access</h2>
            <p className="text-sm text-base-content/60">Create a read-only guest link for people who should view but never edit household coffee data.</p>
            {data.guest_access.is_active && data.guest_access.guest_url ? (
              <div className="rounded-xl border border-amber-700/30 bg-amber-950/30 p-3">
                <p className="break-all text-sm text-base-content/75">{data.guest_access.guest_url}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className="btn btn-sm btn-outline btn-bevel" onClick={() => { void handleCopy(data.guest_access.guest_url, 'Guest link') }}>
                    Copy
                  </button>
                  <a className="btn btn-sm btn-outline btn-bevel no-underline" href={data.guest_access.guest_url} target="_blank" rel="noreferrer">
                    Open preview
                  </a>
                  <button type="button" className="btn btn-sm btn-ghost text-error" disabled={guestRevokeMutation.isPending} onClick={() => guestRevokeMutation.mutate()}>
                    Revoke
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="btn btn-outline btn-bevel" disabled={guestGenerateMutation.isPending} onClick={() => guestGenerateMutation.mutate()}>
                {guestGenerateMutation.isPending ? 'Generating…' : 'Generate guest link'}
              </button>
            )}
          </section>

          <section className="glass-card card-bevel border border-error/30 p-5 space-y-3">
            <h2 className="text-sm font-medium uppercase tracking-wide text-error/80">Danger zone</h2>
            <p className="text-sm text-base-content/60">Deleting a household is irreversible and removes its household-scoped data.</p>
            <button type="button" className="btn btn-outline btn-error" onClick={() => setDeleteOpen(true)}>
              Delete household
            </button>
          </section>
        </aside>
      </div>

      <AccessibleDialog
        open={memberToRemove != null}
        title="Remove member"
        description={memberToRemove ? `Remove ${memberToRemove.display_name} from this household?` : undefined}
        onClose={() => setMemberToRemove(null)}
      >
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={() => setMemberToRemove(null)}>Cancel</button>
          <button
            type="button"
            className="btn btn-outline btn-error"
            disabled={removeMutation.isPending}
            onClick={() => memberToRemove && removeMutation.mutate(memberToRemove.user_id)}
          >
            Remove member
          </button>
        </div>
      </AccessibleDialog>

      <AccessibleDialog
        open={deleteOpen}
        title="Delete household"
        description={`Type ${householdName} exactly to confirm permanent deletion.`}
        onClose={() => setDeleteOpen(false)}
      >
        <div className="space-y-4">
          <label className="form-control">
            <span className="label-text text-sm text-base-content/70">Household name</span>
            <input
              className="input input-bordered input-styled"
              value={deleteConfirmName}
              onChange={(event) => setDeleteConfirmName(event.target.value)}
              autoComplete="off"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setDeleteOpen(false)}>Cancel</button>
            <button
              type="button"
              className="btn btn-outline btn-error"
              disabled={deleteConfirmName !== householdName || deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              Delete permanently
            </button>
          </div>
        </div>
      </AccessibleDialog>
    </div>
  )
}
