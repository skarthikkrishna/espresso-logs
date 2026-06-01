/**
 * Profile page — signed-in user account details and household switcher.
 */

import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Unavailable'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unavailable'
  return date.toLocaleDateString()
}

export default function Profile() {
  const { user, memberships, activeHouseholdId, switchHousehold, logout } = useAuth()

  if (!user) return null

  const joinedAt = user.created_at ?? memberships[0]?.joined_at ?? null
  const authMethod = user.email ? 'Google' : 'Username + password'

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-display text-amber-100 pt-2">Profile</h1>

      <section className="glass-card card-bevel p-5 space-y-4">
        <h2 className="text-sm font-medium text-amber-200/80 uppercase tracking-wide">Account details</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="form-control">
            <span className="label-text text-sm text-base-content/60">Username</span>
            <input className="input input-bordered" value={user.username} readOnly />
          </label>
          <label className="form-control">
            <span className="label-text text-sm text-base-content/60">Display name</span>
            <input className="input input-bordered" value={user.display_name} readOnly />
          </label>
          {user.email ? (
            <label className="form-control md:col-span-2">
              <span className="label-text text-sm text-base-content/60">Email</span>
              <input className="input input-bordered" value={user.email} readOnly />
            </label>
          ) : null}
          <label className="form-control">
            <span className="label-text text-sm text-base-content/60">Joined date</span>
            <input className="input input-bordered" value={formatDate(joinedAt)} readOnly />
          </label>
          <div className="space-y-2">
            <span className="label-text text-sm text-base-content/60">Auth method</span>
            <div className="flex items-center gap-3">
              <span className="badge badge-outline">{authMethod}</span>
              {user.picture_url ? (
                <img
                  src={user.picture_url}
                  alt={`${user.display_name} profile`}
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="glass-card card-bevel p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-amber-200/80 uppercase tracking-wide">My households</h2>
          <Link to="/household/new" className="btn btn-xs btn-outline btn-bevel no-underline">
            Create household
          </Link>
        </div>
        <ul className="space-y-3">
          {memberships.map((membership) => {
            const isActive = membership.household_id === activeHouseholdId
            return (
              <li
                key={membership.household_id}
                className="flex flex-col gap-3 rounded-lg border border-base-300/50 bg-base-100/30 p-3 md:flex-row md:items-center md:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-base-content">{membership.household_name}</span>
                    <span className="badge badge-outline badge-sm">{membership.role}</span>
                    {isActive ? <span className="badge badge-primary badge-sm">Active</span> : null}
                  </div>
                  <p className="text-xs text-base-content/50">
                    Joined {formatDate(membership.joined_at)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!isActive ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline btn-bevel"
                      onClick={() => {
                        void switchHousehold(membership.household_id)
                      }}
                    >
                      Open
                    </button>
                  ) : null}
                  {membership.role === 'admin' ? (
                    <Link to="/household/settings" className="btn btn-sm btn-ghost no-underline">
                      Manage
                    </Link>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="glass-card card-bevel p-5 space-y-3">
        <h2 className="text-sm font-medium text-amber-200/80 uppercase tracking-wide">Change password</h2>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={(event) => event.preventDefault()}>
          <label className="form-control md:col-span-2">
            <span className="label-text text-sm text-base-content/60">Current password</span>
            <input className="input input-bordered" type="password" placeholder="Current password" />
          </label>
          <label className="form-control">
            <span className="label-text text-sm text-base-content/60">New password</span>
            <input className="input input-bordered" type="password" placeholder="New password" />
          </label>
          <label className="form-control">
            <span className="label-text text-sm text-base-content/60">Confirm new password</span>
            <input className="input input-bordered" type="password" placeholder="Confirm new password" />
          </label>
          <div className="md:col-span-2 rounded-lg border border-dashed border-base-300/60 p-3 text-sm text-base-content/60">
            TODO: wire this form to the password-change API when the backend endpoint is available.
          </div>
        </form>
      </section>

      <section className="glass-card card-bevel p-5 space-y-3">
        <button
          type="button"
          onClick={logout}
          className="btn btn-ghost btn-sm w-full text-error"
        >
          Sign out
        </button>
      </section>
    </div>
  )
}
