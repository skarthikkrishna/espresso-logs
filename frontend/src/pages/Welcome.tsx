/**
 * Welcome page — onboarding for users with zero household memberships.
 *
 * Shown when /auth/me returns an empty memberships array. Users must either
 * create a new household or accept a pending invite to proceed.
 *
 * Spec: functional-spec-v2.md §602-645
 */

import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Welcome() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-base-100 flex items-start justify-center pt-16 px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center">
          <p className="text-5xl mb-3" aria-hidden="true">☕</p>
          <h1 className="text-2xl font-display text-amber-100">Welcome to Espresso Logs</h1>
          {user && (
            <p className="text-amber-200/70 text-sm mt-2">
              Hi, <span className="text-amber-200">{user.display_name}</span>! Let's get you set up.
            </p>
          )}
        </div>

        {/* Action cards */}
        <div className="bg-base-200/80 border border-[rgba(255,255,255,0.08)] rounded-xl p-6 shadow-lg space-y-4">
          <p className="text-base-content/80 text-sm text-center">
            You're not part of any household yet. Create one to start tracking espresso, or accept an invite from an existing household.
          </p>

          <Link
            to="/household/new"
            className="btn btn-primary w-full btn-bevel no-underline"
          >
            Create a household
          </Link>

          <p className="text-center text-base-content/50 text-xs">— or —</p>

          <p className="text-center text-base-content/60 text-sm">
            Have an invite link? Open it to join an existing household.
          </p>
        </div>

        {/* Sign out */}
        <p className="text-center text-xs text-base-content/40">
          Not you?{' '}
          <button
            onClick={logout}
            className="link link-hover text-amber-400/70"
            type="button"
          >
            Sign out
          </button>
        </p>
      </div>
    </div>
  )
}
