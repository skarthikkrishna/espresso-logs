import { Link } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import type { Membership } from '../types/entities'
import { Badge, Button, GlassCard, PageHeader } from '../components/ui'
import { useKaapiMotion } from '../lib/motion'
import { COPY } from '../copy'

function formatDate(value: string | null | undefined): string {
  if (!value) return COPY.common.unavailable
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return COPY.common.unavailable
  return date.toLocaleDateString()
}

const monogramFor = (name: string): string =>
  name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'CT'

function HouseholdRow({
  membership,
  activeHouseholdId,
  onOpen,
  busy,
}: {
  membership: Membership
  activeHouseholdId: string | null
  onOpen: (householdId: string, name: string) => Promise<void>
  busy: boolean
}) {
  const isActive = membership.household_id === activeHouseholdId || membership.is_active
  const canManage = membership.can_manage ?? membership.role === 'admin'
  return (
    <li>
      <GlassCard
        variant="content"
        padding="sm"
        className="kaapi-motion-card flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
      >
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium text-[var(--kaapi-content-content)]" title={membership.household_name}>
              {membership.household_name}
            </span>
            <Badge tone="neutral" emphasis="solid" className="capitalize">{membership.role}</Badge>
            {isActive ? <Badge tone="brand" emphasis="solid">{COPY.profile.active}</Badge> : null}
          </div>
          <p className="text-xs text-[var(--kaapi-content-muted)]">
            {COPY.profile.rowMeta(membership.member_count, formatDate(membership.joined_at))}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={isActive || busy}
            onClick={() => { void onOpen(membership.household_id, membership.household_name) }}
          >
            {isActive ? COPY.profile.current : COPY.profile.open}
          </Button>
          {canManage ? (
            <Link to="/household/settings" className="btn btn-ghost btn-sm no-underline">
              {COPY.profile.manage}
            </Link>
          ) : null}
        </div>
      </GlassCard>
    </li>
  )
}

export default function Profile() {
  const { user, memberships, activeHouseholdId, switchHousehold, logout } = useAuth()
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [switching, setSwitching] = useState(false)
  const routeRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const { routeEnter, staggerCards } = useKaapiMotion({ scope: routeRef })

  useEffect(() => {
    if (user && routeRef.current) routeEnter(routeRef.current)
  }, [user, routeEnter])

  useEffect(() => {
    const cards = listRef.current?.querySelectorAll('.kaapi-motion-card')
    if (cards?.length) staggerCards(cards)
  }, [memberships.length, staggerCards])

  if (!user) return null

  const joinedAt = user.created_at ?? memberships[0]?.joined_at ?? null
  const authMethod = user.email ? COPY.profile.authGoogle : COPY.profile.authPassword
  const displayName = user.display_name || user.username || 'Kaapi Kadai user'

  const handleOpen = async (householdId: string, householdName: string) => {
    if (householdId === activeHouseholdId) return
    setSwitching(true)
    setStatus(COPY.profile.opening(householdName))
    setError(null)
    try {
      await switchHousehold(householdId)
      setStatus(COPY.profile.nowActive(householdName))
    } catch {
      setError(COPY.profile.switchError)
      setStatus(null)
    } finally {
      setSwitching(false)
    }
  }

  return (
    <div ref={routeRef} data-testid="motion-route-boundary" className="mx-auto max-w-3xl space-y-4 p-4 pb-32 md:p-6 lg:pb-6">
      <PageHeader
        subtitle={COPY.profile.eyebrow}
        title={COPY.profile.title}
        actions={(
          <Link to="/household/new" className="btn btn-outline btn-bevel no-underline">
            {COPY.actions.createHousehold}
          </Link>
        )}
      />

      <p className="sr-only" aria-live="polite">{status}</p>
      {error ? <div className="alert alert-error card-bevel" role="alert"><span>{error}</span></div> : null}

      <GlassCard variant="content" padding="lg">
        <div className="flex flex-col gap-5 md:flex-row md:items-center">
          {user.picture_url ? (
            <img src={user.picture_url} alt="" className="h-20 w-20 rounded-full object-cover" />
          ) : (
            <div
              className="grid h-20 w-20 place-items-center rounded-full border border-[var(--kaapi-content-border)] bg-[var(--kaapi-content-surface-2)] text-2xl font-semibold text-[var(--kaapi-content-muted)]"
              aria-hidden="true"
            >
              {monogramFor(displayName)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-semibold text-[var(--kaapi-content-content)]">{displayName}</h2>
            <p className="text-sm text-[var(--kaapi-content-muted)]">@{user.username}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="neutral" emphasis="solid">{authMethod}</Badge>
              <Badge tone="neutral" emphasis="solid">{COPY.profile.joined(formatDate(joinedAt))}</Badge>
              {user.email ? <Badge tone="neutral" emphasis="solid">{user.email}</Badge> : null}
            </div>
          </div>
        </div>
      </GlassCard>

      <GlassCard variant="content" padding="lg" className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--kaapi-content-muted)]">
          {COPY.profile.passwordResetTitle}
        </h2>
        <p className="text-sm text-[var(--kaapi-content-muted)]">{COPY.profile.passwordResetBody}</p>
      </GlassCard>

      <GlassCard variant="content" padding="lg" className="space-y-4">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--kaapi-content-muted)]">
            {COPY.profile.householdsTitle}
          </h2>
          <p className="text-sm text-[var(--kaapi-content-muted)]">{COPY.profile.householdsHint}</p>
        </div>
        {memberships.length === 0 ? (
          <div className="kaapi-content-surface kaapi-content-surface--elevated p-4 text-sm text-[var(--kaapi-content-muted)]">
            {COPY.profile.noHouseholds}
          </div>
        ) : (
          <ul ref={listRef} className="space-y-3">
            {memberships.map((membership) => (
              <HouseholdRow
                key={membership.household_id}
                membership={membership}
                activeHouseholdId={activeHouseholdId}
                busy={switching}
                onOpen={handleOpen}
              />
            ))}
          </ul>
        )}
      </GlassCard>

      <GlassCard variant="content" padding="lg">
        <Button variant="danger" fullWidth onClick={logout}>
          {COPY.actions.signOut}
        </Button>
      </GlassCard>
    </div>
  )
}
