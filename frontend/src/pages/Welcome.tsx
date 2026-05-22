/**
 * Welcome page — onboarding for users with zero household memberships.
 */

import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Welcome() {
  const { isAuthenticated, isLoading, memberships, user, logout } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary" aria-label="Loading welcome" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate replace to="/login" />
  }

  if (memberships.length > 0) {
    return <Navigate replace to="/" />
  }

  return (
    <div className="min-h-screen bg-base-100 flex items-start justify-center pt-16 px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <p className="text-5xl mb-3" aria-hidden="true">☕</p>
          <h1 className="text-2xl font-display text-amber-100">Welcome to Coffee Tracker</h1>
          {user ? (
            <p className="text-amber-200/70 text-sm mt-2">
              Hi, <span className="text-amber-200">{user.display_name}</span>! Let&apos;s get your first household set up.
            </p>
          ) : null}
        </div>

        <div className="bg-base-200/80 border border-[rgba(255,255,255,0.08)] rounded-xl p-6 shadow-lg space-y-5">
          <p className="text-base-content/80 text-sm text-center">
            Coffee Tracker is a household app. You&apos;ll need to either create a new household or accept an invitation from a friend.
          </p>

          <Link
            to="/household/new"
            className="btn btn-primary w-full btn-bevel no-underline"
          >
            Create my household
          </Link>

          <div className="divider text-xs text-base-content/50 my-0">or</div>

          <div className="rounded-lg border border-base-300/50 bg-base-100/40 p-4 text-sm text-base-content/70 space-y-2">
            <p className="font-medium text-base-content">I have an invitation</p>
            <p>
              Ask a household admin to share an invitation link with you, then open that link here to join their household.
            </p>
            <p className="text-xs text-base-content/50">
              The admin can generate an invitation link from household settings — no email address required.
            </p>
          </div>
        </div>

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
