/**
 * HouseholdSettings page — admin console for the active household.
 *
 * Surfaces rename, member management (promote/demote/remove), invite
 * lifecycle (create/copy/resend/revoke), guest-access link management, and a
 * destructive delete flow. All mutations run through React Query; admin-only.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
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
import { Badge, Button, FormField, Input, PageHeader, Select } from '../components/ui'
import { useKaapiMotion } from '../lib/motion'
import { COPY } from '../copy'

function formatDate(value: string | null | undefined): string {
  if (!value) return COPY.common.unavailable
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return COPY.common.unavailable
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function apiErrorMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) return fallback
  const status = error.response?.status
  const detail = error.response?.data?.detail
  if (typeof detail === 'string') {
    if (/duplicate/i.test(detail)) return COPY.householdSettings.errors.duplicateInvite
    if (/already.*member/i.test(detail)) return COPY.householdSettings.errors.alreadyMember
    if (/last admin|sole admin/i.test(detail)) return COPY.householdSettings.lastAdmin
    if (/self|yourself/i.test(detail)) return COPY.householdSettings.errors.removeSelf
    if (/limit/i.test(detail)) return COPY.householdSettings.memberLimit
    return detail
  }
  if (status === 403) return COPY.householdSettings.adminOnly
  if (status === 409) return COPY.householdSettings.lastAdmin
  if (status === 422) return COPY.householdSettings.errors.validation
  if (!error.response) return COPY.householdSettings.errors.offline
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
  const routeRef = useRef<HTMLDivElement>(null)
  const { routeEnter } = useKaapiMotion({ scope: routeRef })

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
      setStatusMessage(COPY.householdSettings.status.nameSaved)
      setErrorMessage(null)
      setHouseholdNameDraft('')
      await invalidateSettings()
    },
    onError: (err) => setErrorMessage(apiErrorMessage(err, COPY.householdSettings.errors.saveName)),
  })

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: HouseholdRole }) => updateMemberRole(userId, role),
    onSuccess: async () => {
      setStatusMessage(COPY.householdSettings.status.roleUpdated)
      setErrorMessage(null)
      await invalidateSettings()
    },
    onError: (err) => setErrorMessage(apiErrorMessage(err, COPY.householdSettings.errors.role)),
  })

  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeMember(userId),
    onSuccess: async () => {
      setStatusMessage(COPY.householdSettings.status.memberRemoved)
      setErrorMessage(null)
      setMemberToRemove(null)
      await invalidateSettings()
    },
    onError: (err) => setErrorMessage(apiErrorMessage(err, COPY.householdSettings.errors.removeMember)),
  })

  const inviteMutation = useMutation({
    mutationFn: () => createInvitation({
      invited_email: inviteEmail.trim() || null,
      invited_role: inviteRole,
    }),
    onSuccess: async (invite) => {
      setInviteEmail('')
      setLatestInviteUrl(invite.invite_url)
      setStatusMessage(COPY.householdSettings.status.inviteCreated)
      setErrorMessage(null)
      await invalidateSettings()
    },
    onError: (err) => setErrorMessage(apiErrorMessage(err, COPY.householdSettings.errors.createInvite)),
  })

  const revokeInviteMutation = useMutation({
    mutationFn: (invitationId: string) => revokeInvitation(invitationId),
    onSuccess: async () => {
      setStatusMessage(COPY.householdSettings.status.inviteRevoked)
      setErrorMessage(null)
      await invalidateSettings()
    },
    onError: (err) => setErrorMessage(apiErrorMessage(err, COPY.householdSettings.errors.revokeInvite)),
  })

  const resendInviteMutation = useMutation({
    mutationFn: (invitationId: string) => resendInvitation(invitationId),
    onSuccess: async (invite) => {
      setLatestInviteUrl(invite.invite_url)
      setStatusMessage(COPY.householdSettings.status.inviteResent)
      setErrorMessage(null)
      await invalidateSettings()
    },
    onError: (err) => setErrorMessage(apiErrorMessage(err, COPY.householdSettings.errors.resendInvite)),
  })

  const guestGenerateMutation = useMutation({
    mutationFn: () => generateGuestToken(activeHouseholdId!),
    onSuccess: async (guest) => {
      setStatusMessage(COPY.householdSettings.status.guestGenerated)
      setErrorMessage(null)
      queryClient.setQueryData(queryKey, data ? { ...data, guest_access: guest } : data)
      await invalidateSettings()
    },
    onError: (err) => setErrorMessage(apiErrorMessage(err, COPY.householdSettings.errors.generateGuest)),
  })

  const guestRevokeMutation = useMutation({
    mutationFn: () => revokeGuestToken(activeHouseholdId!),
    onSuccess: async () => {
      setStatusMessage(COPY.householdSettings.status.guestRevoked)
      setErrorMessage(null)
      await invalidateSettings()
    },
    onError: (err) => setErrorMessage(apiErrorMessage(err, COPY.householdSettings.errors.revokeGuest)),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteHousehold(activeHouseholdId!, deleteConfirmName),
    onSuccess: async () => {
      const userData = await getMe()
      setUser(userData)
      setStatusMessage(COPY.householdSettings.status.householdDeleted)
      setDeleteOpen(false)
      setDeleteConfirmName('')
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] === 'households' })
      navigate(userData.memberships && userData.memberships.length > 0 ? '/' : '/welcome', { replace: true })
    },
    onError: (err) => setErrorMessage(apiErrorMessage(err, COPY.householdSettings.errors.deleteHousehold)),
  })

  const handleCopy = async (text: string | null | undefined, label: string) => {
    if (!text) {
      setErrorMessage(COPY.householdSettings.errors.noLink)
      return
    }
    try {
      await copyText(text)
      setStatusMessage(COPY.householdSettings.status.copied(label))
      setErrorMessage(null)
    } catch {
      setErrorMessage(COPY.householdSettings.errors.copyFailed)
    }
  }

  useEffect(() => {
    if (activeHouseholdId && isAdmin && !isLoading && !isError && data && routeRef.current) {
      routeEnter(routeRef.current)
    }
  }, [activeHouseholdId, isAdmin, isLoading, isError, data, routeEnter])

  if (!activeHouseholdId) {
    return (
      <div className="mx-auto max-w-xl p-4 md:p-6">
        <div className="kaapi-content-surface p-6 text-center">
          <h1 className="font-display text-2xl text-[var(--kaapi-content-content)]">{COPY.householdSettings.noActiveTitle}</h1>
          <p className="mt-2 text-sm text-[var(--kaapi-content-muted)]">{COPY.householdSettings.noActiveBody}</p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-xl p-4 md:p-6">
        <div className="alert alert-warning card-bevel" role="alert">
          <span>{COPY.householdSettings.adminOnly}</span>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex justify-center p-8" role="status" aria-live="polite">
        <span className="loading loading-spinner loading-lg text-primary" aria-label={COPY.householdSettings.loading} />
        <span className="sr-only">{COPY.householdSettings.loading}</span>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="p-4">
        <div className="kaapi-content-surface p-6 text-center">
          <p className="font-medium text-[var(--kaapi-content-content)]">{COPY.householdSettings.loadError}</p>
          <p className="mt-1 text-sm text-[var(--kaapi-content-muted)]">{apiErrorMessage(error, COPY.householdSettings.errors.retry)}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => { void refetch() }}>
            {COPY.common.retry}
          </Button>
        </div>
      </div>
    )
  }

  const draftName = householdNameDraft || householdName
  const nameInvalid = draftName.trim().length === 0 || draftName.trim().length > 64
  const canSaveName = draftName.trim() !== householdName && !nameInvalid && !renameMutation.isPending

  return (
    <div ref={routeRef} data-testid="motion-route-boundary" className="mx-auto max-w-5xl space-y-4 p-4 pb-32 md:p-6 lg:pb-6">
      <PageHeader
        subtitle={COPY.householdSettings.eyebrow}
        title={COPY.householdSettings.title}
        actions={(
          <Badge tone="neutral" emphasis="solid">
            {COPY.householdSettings.memberCount(data.member_count, data.member_limit.max)}
          </Badge>
        )}
      />

      {statusMessage ? <div className="alert alert-success card-bevel" aria-live="polite"><span>{statusMessage}</span></div> : null}
      {errorMessage ? <div className="alert alert-error card-bevel" role="alert"><span>{errorMessage}</span></div> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <section className="kaapi-content-surface p-5 space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="flex-1">
                <FormField label={COPY.householdSettings.nameLabel} htmlFor="household-name-input">
                  <Input
                    id="household-name-input"
                    value={draftName}
                    maxLength={64}
                    error={nameInvalid}
                    onChange={(event) => setHouseholdNameDraft(event.target.value)}
                    aria-invalid={nameInvalid}
                  />
                </FormField>
              </div>
              <Button
                variant="primary"
                disabled={!canSaveName}
                loading={renameMutation.isPending}
                loadingText={COPY.householdSettings.saving}
                onClick={() => renameMutation.mutate(draftName.trim())}
              >
                {COPY.householdSettings.saveName}
              </Button>
            </div>
            <p className="text-xs text-[var(--kaapi-content-muted)]">{COPY.householdSettings.created(formatDate(data.created_at))}</p>
          </section>

          <section className="kaapi-content-surface p-5 space-y-3">
            <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--kaapi-content-muted)]">{COPY.householdSettings.membersTitle}</h2>
            <ul className="space-y-3">
              {data.members.map((member) => {
                const isSelf = member.is_self || member.user_id === user?.id
                const nextRole: HouseholdRole = member.role === 'admin' ? 'member' : 'admin'
                const roleActionLabel = member.role === 'admin' ? COPY.householdSettings.demote : COPY.householdSettings.promote
                const lastAdminDemotion = member.role === 'admin' && adminCount <= 1
                return (
                  <li
                    key={member.user_id}
                    className="glass-card card-bevel glass-card--content p-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {member.picture_url ? (
                        <img src={member.picture_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[var(--kaapi-content-border)] bg-[var(--kaapi-content-surface-2)] text-sm font-semibold text-[var(--kaapi-content-muted)]" aria-hidden="true">
                          {monogramFor(member)}
                        </span>
                      )}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-medium text-[var(--kaapi-content-content)]">{member.display_name}</span>
                          <Badge tone="neutral" emphasis="solid" className="capitalize">{member.role}</Badge>
                          {isSelf ? <Badge tone="brand" emphasis="solid">{COPY.householdSettings.you}</Badge> : null}
                        </div>
                        <p className="text-xs text-[var(--kaapi-content-muted)]">
                          {COPY.householdSettings.memberMeta(member.email, member.username, formatDate(member.joined_at))}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!isSelf ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={roleMutation.isPending || lastAdminDemotion}
                          title={lastAdminDemotion ? COPY.householdSettings.lastAdmin : undefined}
                          onClick={() => roleMutation.mutate({ userId: member.user_id, role: nextRole })}
                        >
                          {roleActionLabel}
                        </Button>
                      ) : null}
                      {!isSelf ? (
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={removeMutation.isPending}
                          onClick={() => setMemberToRemove(member)}
                        >
                          {COPY.householdSettings.remove}
                        </Button>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>

          <section className="kaapi-content-surface p-5 space-y-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--kaapi-content-muted)]">{COPY.householdSettings.inviteTitle}</h2>
              <p className="text-sm text-[var(--kaapi-content-muted)]">{COPY.householdSettings.inviteHint}</p>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                inviteMutation.mutate()
              }}
              className="grid gap-3 md:grid-cols-[1fr_auto_auto]"
            >
              <label className="sr-only" htmlFor="invite-email">{COPY.householdSettings.inviteEmailLabel}</label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder={COPY.householdSettings.inviteEmailPlaceholder}
              />
              <label className="sr-only" htmlFor="invite-role">{COPY.householdSettings.inviteRoleLabel}</label>
              <Select
                id="invite-role"
                value={inviteRole}
                onChange={(event) => setInviteRole(event.target.value as HouseholdRole)}
              >
                <option value="member">{COPY.householdSettings.roleMember}</option>
                <option value="admin">{COPY.householdSettings.roleAdmin}</option>
              </Select>
              <Button
                type="submit"
                variant="primary"
                disabled={inviteDisabled}
                loading={inviteMutation.isPending}
                loadingText={COPY.householdSettings.creating}
                title={inviteDisabled ? COPY.householdSettings.memberLimit : undefined}
              >
                {COPY.householdSettings.createInvite}
              </Button>
            </form>
            {inviteDisabled ? <p className="text-sm text-warning">{COPY.householdSettings.memberLimit}</p> : null}
            {latestInviteUrl ? (
              <div className="rounded-xl border border-[var(--kaapi-content-border)] bg-[var(--kaapi-content-surface-2)] p-3">
                <p className="text-xs uppercase tracking-wide text-[var(--kaapi-content-muted)]">{COPY.householdSettings.latestInviteLabel}</p>
                <p className="mt-1 break-all text-sm text-[var(--kaapi-content-content)]">{latestInviteUrl}</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => { void handleCopy(latestInviteUrl, COPY.householdSettings.status.copyLabelInvite) }}>
                  {COPY.householdSettings.copyLatest}
                </Button>
              </div>
            ) : null}

            <div className="space-y-2">
              <h3 className="text-sm font-medium text-[var(--kaapi-content-content)]">{COPY.householdSettings.pendingTitle}</h3>
              {data.pending_invitations.length === 0 ? (
                <p className="text-sm text-[var(--kaapi-content-muted)]">{COPY.householdSettings.pendingNone}</p>
              ) : (
                <ul className="space-y-2">
                  {data.pending_invitations.map((invite: PendingInvitation) => (
                    <li
                      key={invite.invitation_id}
                      className="glass-card card-bevel glass-card--content p-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm text-[var(--kaapi-content-content)]">{invite.label}</p>
                          <Badge tone="neutral" emphasis="solid" className="capitalize">{invite.invited_role}</Badge>
                          <Badge tone={invite.status === 'pending' ? 'brand' : 'warning'} emphasis="solid">{invite.status}</Badge>
                        </div>
                        <p className="text-xs text-[var(--kaapi-content-muted)]">{COPY.householdSettings.expires(formatDate(invite.expires_at))}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {invite.can_copy && invite.invite_url ? (
                          <Button variant="outline" size="sm" onClick={() => { void handleCopy(invite.invite_url, COPY.householdSettings.status.copyLabelInvite) }}>
                            {COPY.householdSettings.copy}
                          </Button>
                        ) : null}
                        {invite.can_resend ? (
                          <Button variant="outline" size="sm" disabled={resendInviteMutation.isPending} onClick={() => resendInviteMutation.mutate(invite.invitation_id)}>
                            {COPY.householdSettings.resend}
                          </Button>
                        ) : null}
                        {invite.can_revoke ? (
                          <Button variant="danger" size="sm" disabled={revokeInviteMutation.isPending} onClick={() => revokeInviteMutation.mutate(invite.invitation_id)}>
                            {COPY.householdSettings.revoke}
                          </Button>
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
          <section className="kaapi-content-surface p-5 space-y-3">
            <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--kaapi-content-muted)]">{COPY.householdSettings.guestTitle}</h2>
            <p className="text-sm text-[var(--kaapi-content-muted)]">{COPY.householdSettings.guestHint}</p>
            {data.guest_access.is_active && data.guest_access.guest_url ? (
              <div className="rounded-xl border border-[var(--kaapi-content-border)] bg-[var(--kaapi-content-surface-2)] p-3">
                <p className="break-all text-sm text-[var(--kaapi-content-content)]">{data.guest_access.guest_url}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => { void handleCopy(data.guest_access.guest_url, COPY.householdSettings.status.copyLabelGuest) }}>
                    {COPY.householdSettings.copy}
                  </Button>
                  <a className="btn btn-outline btn-bevel btn-sm no-underline" href={data.guest_access.guest_url} target="_blank" rel="noreferrer">
                    {COPY.householdSettings.openPreview}
                  </a>
                  <Button variant="danger" size="sm" disabled={guestRevokeMutation.isPending} onClick={() => guestRevokeMutation.mutate()}>
                    {COPY.householdSettings.revoke}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                loading={guestGenerateMutation.isPending}
                loadingText={COPY.householdSettings.generating}
                onClick={() => guestGenerateMutation.mutate()}
              >
                {COPY.householdSettings.generateGuest}
              </Button>
            )}
          </section>

          <section className="kaapi-content-surface border border-error/40 p-5 space-y-3">
            <h2 className="text-sm font-medium uppercase tracking-wide text-error">{COPY.householdSettings.dangerTitle}</h2>
            <p className="text-sm text-[var(--kaapi-content-muted)]">{COPY.householdSettings.dangerHint}</p>
            <Button variant="outline" className="btn-error" onClick={() => setDeleteOpen(true)}>
              {COPY.householdSettings.deleteHousehold}
            </Button>
          </section>
        </aside>
      </div>

      <AccessibleDialog
        open={memberToRemove != null}
        title={COPY.householdSettings.removeMemberTitle}
        description={memberToRemove ? COPY.householdSettings.removeMemberConfirm(memberToRemove.display_name) : undefined}
        onClose={() => setMemberToRemove(null)}
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setMemberToRemove(null)}>{COPY.common.cancel}</Button>
          <Button
            variant="outline"
            className="btn-error"
            disabled={removeMutation.isPending}
            onClick={() => memberToRemove && removeMutation.mutate(memberToRemove.user_id)}
          >
            {COPY.householdSettings.removeMemberAction}
          </Button>
        </div>
      </AccessibleDialog>

      <AccessibleDialog
        open={deleteOpen}
        title={COPY.householdSettings.deleteHousehold}
        description={COPY.householdSettings.deleteConfirmPrompt(householdName)}
        onClose={() => setDeleteOpen(false)}
      >
        <div className="space-y-4">
          <FormField label={COPY.householdSettings.nameLabel} htmlFor="delete-confirm-input">
            <Input
              id="delete-confirm-input"
              value={deleteConfirmName}
              onChange={(event) => setDeleteConfirmName(event.target.value)}
              autoComplete="off"
            />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>{COPY.common.cancel}</Button>
            <Button
              variant="outline"
              className="btn-error"
              disabled={deleteConfirmName !== householdName || deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              {COPY.householdSettings.deletePermanently}
            </Button>
          </div>
        </div>
      </AccessibleDialog>
    </div>
  )
}
