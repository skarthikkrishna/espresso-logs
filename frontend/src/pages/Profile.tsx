import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import type { Membership } from '../types/entities'

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Unavailable'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unavailable'
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
  return (
    <li className="glass-card card-bevel flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium text-base-content" title={membership.household_name}>{membership.household_name}</span>
          <span className="badge badge-outline badge-sm capitalize">{membership.role}</span>
          {isActive ? <span className="badge badge-primary badge-sm">Active</span> : null}
        </div>
        <p className="text-xs text-base-content/55">
          {membership.member_count != null ? `${membership.member_count} member${membership.member_count === 1 ? '' : 's'} • ` : ''}
          Joined {formatDate(membership.joined_at)}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-sm btn-outline btn-bevel"
          disabled={isActive || busy}
          onClick={() => { void onOpen(membership.household_id, membership.household_name) }}
        >
          {isActive ? 'Current' : 'Open'}
        </button>
        {membership.can_manage ?? membership.role === 'admin' ? (
          <Link to="/household/settings" className="btn btn-sm btn-ghost no-underline">
            Manage
          </Link>
        ) : null}
      </div>
    </li>
  )
}

export default function Profile() {
  const { user, memberships, activeHouseholdId, switchHousehold, logout } = useAuth()
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [switching, setSwitching] = useState(false)

  if (!user) return null

  const joinedAt = user.created_at ?? memberships[0]?.joined_at ?? null
  const authMethod = user.email ? 'Google' : 'Username + password'
  const displayName = user.display_name || user.username || 'Kaapi Kadai user'

  const handleOpen = async (householdId: string, householdName: string) => {
    if (householdId === activeHouseholdId) return
    setSwitching(true)
    setStatus(`Opening ${householdName}…`)
    setError(null)
    try {
      await switchHousehold(householdId)
      setStatus(`${householdName} is now active.`)
    } catch {
      setError('Could not switch households. Please try again.')
      setStatus(null)
    } finally {
      setSwitching(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 pb-32 md:p-6 lg:pb-6">
      <div className="flex flex-col gap-2 pt-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-amber-300/60">Account</p>
          <h1 className="font-display text-3xl text-amber-100">Profile</h1>
        </div>
        <Link to="/household/new" className="btn btn-outline btn-bevel no-underline">
          Create household
        </Link>
      </div>

      <p className="sr-only" aria-live="polite">{status}</p>
      {error ? <div className="alert alert-error card-bevel" role="alert"><span>{error}</span></div> : null}

      <section className="glass-card card-bevel p-5 md:p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-center">
          {user.picture_url ? (
            <img src={user.picture_url} alt="" className="h-20 w-20 rounded-full object-cover" />
          ) : (
            <div className="grid h-20 w-20 place-items-center rounded-full border border-amber-500/30 bg-amber-500/15 text-2xl font-semibold text-amber-200" aria-hidden="true">
              {monogramFor(displayName)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-semibold text-base-content">{displayName}</h2>
            <p className="text-sm text-base-content/60">@{user.username}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="badge badge-outline">{authMethod}</span>
              <span className="badge badge-outline">Joined {formatDate(joinedAt)}</span>
              {user.email ? <span className="badge badge-outline">{user.email}</span> : null}
            </div>
          </div>
        </div>
      </section>

      <section className="glass-card card-bevel p-5 space-y-3 md:p-6">
        <h2 className="text-sm font-medium uppercase tracking-wide text-amber-200/80">Password reset</h2>
        <p className="text-sm text-base-content/70">
          Password resets are admin-assisted for household safety. Ask a household admin to reset your password if you lose access.
        </p>
      </section>

      <section className="glass-card card-bevel p-5 space-y-4 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium uppercase tracking-wide text-amber-200/80">My households</h2>
            <p className="text-sm text-base-content/60">Open a household, manage admin settings, or create another workspace.</p>
          </div>
        </div>
        {memberships.length === 0 ? (
          <div className="rounded-xl border border-amber-900/30 p-4 text-sm text-base-content/70">
            You are not a member of a household yet. Create one or ask an admin for an invitation link.
          </div>
        ) : (
          <ul className="space-y-3">
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
      </section>

      <section className="glass-card card-bevel p-5 md:p-6">
        <button
          type="button"
          onClick={logout}
          className="btn btn-ghost w-full text-error"
        >
          Sign out
        </button>
      </section>
    </div>
  )
}
