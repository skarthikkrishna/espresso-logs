/**
 * InviteInvalid page — shown for invalid, expired, or already-used invite tokens.
 *
 * Rendered at /invite/invalid and /invite/expired.
 * Provides a clear message and a path back to home or to request a new invite.
 *
 * Spec: functional-spec-v2.md §717-721
 */

import { useLocation, Link } from 'react-router-dom'

export default function InviteInvalid() {
  const { pathname } = useLocation()
  const isExpired = pathname === '/invite/expired'

  return (
    <div className="min-h-screen bg-base-100 flex items-start justify-center pt-16 px-4">
      <div className="w-full max-w-sm">
        <div className="bg-base-200/80 border border-[rgba(255,255,255,0.08)] rounded-xl p-6 shadow-lg text-center space-y-4">
          <p className="text-4xl" aria-hidden="true">{isExpired ? '⏰' : '🚫'}</p>
          <h1 className="text-xl font-display text-amber-100">
            {isExpired ? 'Invitation expired' : 'Invalid invitation'}
          </h1>
          <p className="text-base-content/70 text-sm">
            {isExpired
              ? 'This invitation link has expired (invitations are valid for 72 hours). Ask the household admin to send a new one.'
              : 'This invitation link is invalid or has already been used.'}
          </p>
          <Link to="/" className="btn btn-primary btn-sm btn-bevel no-underline">
            Go to home
          </Link>
        </div>
      </div>
    </div>
  )
}
