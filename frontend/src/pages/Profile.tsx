/**
 * Profile page — view and manage current user's account details.
 *
 * Displays username, display name, email, connected Google account,
 * and household memberships. Provides navigation to household settings.
 *
 * Spec: functional-spec-v2.md §794-840
 */

import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Profile() {
  const { user, memberships, activeHouseholdId, switchHousehold, logout } = useAuth()

  if (!user) return null

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h1 className="text-xl font-display text-amber-100 pt-2">Profile</h1>

      {/* Account details */}
      <section className="glass-card card-bevel p-5 space-y-3">
        <h2 className="text-sm font-medium text-amber-200/80 uppercase tracking-wide">Account</h2>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-base-content/60">Display name</span>
            <span className="text-base-content">{user.display_name}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-base-content/60">Username</span>
            <span className="text-base-content font-mono">@{user.username}</span>
          </div>
          {user.email && (
            <div className="flex justify-between items-center">
              <span className="text-base-content/60">Email</span>
              <span className="text-base-content">{user.email}</span>
            </div>
          )}
          {user.picture_url && (
            <div className="flex justify-between items-center">
              <span className="text-base-content/60">Google account</span>
              <span className="badge badge-success badge-sm">Connected</span>
            </div>
          )}
        </div>
      </section>

      {/* Household memberships */}
      {memberships.length > 0 && (
        <section className="glass-card card-bevel p-5 space-y-3">
          <h2 className="text-sm font-medium text-amber-200/80 uppercase tracking-wide">Households</h2>
          <ul className="space-y-2">
            {memberships.map((m) => (
              <li key={m.household_id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {m.household_id === activeHouseholdId && (
                    <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" aria-label="Active" />
                  )}
                  {m.household_id !== activeHouseholdId && (
                    <span className="w-2 h-2 rounded-full bg-transparent flex-shrink-0" aria-hidden="true" />
                  )}
                  <span className="text-sm text-base-content">{m.household_name}</span>
                  <span className="badge badge-outline badge-xs">{m.role}</span>
                </div>
                <div className="flex items-center gap-2">
                  {m.household_id !== activeHouseholdId && (
                    <button
                      type="button"
                      className="btn btn-xs btn-ghost"
                      onClick={() => { void switchHousehold(m.household_id) }}
                    >
                      Switch
                    </button>
                  )}
                  {m.role === 'admin' && m.household_id === activeHouseholdId && (
                    <Link to="/household/settings" className="btn btn-xs btn-ghost no-underline">
                      Settings
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Actions */}
      <section className="glass-card card-bevel p-5 space-y-3">
        <h2 className="text-sm font-medium text-amber-200/80 uppercase tracking-wide">Actions</h2>
        <div className="space-y-2">
          <Link to="/household/new" className="btn btn-outline btn-sm w-full btn-bevel no-underline">
            Create a new household
          </Link>
          <button
            type="button"
            onClick={logout}
            className="btn btn-ghost btn-sm w-full text-error"
          >
            Sign out
          </button>
        </div>
      </section>
    </div>
  )
}
