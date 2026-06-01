/**
 * InviteExpired page — static error page for expired invitation links.
 */

import { Link } from 'react-router-dom'

export default function InviteExpired() {
  return (
    <div className="min-h-screen bg-base-100 flex items-start justify-center pt-16 px-4">
      <div className="w-full max-w-sm">
        <div className="bg-base-200/80 border border-[rgba(255,255,255,0.08)] rounded-xl p-6 shadow-lg text-center space-y-4">
          <p className="text-4xl" aria-hidden="true">⏰</p>
          <h1 className="text-xl font-display text-amber-100">Invitation expired</h1>
          <p className="text-base-content/70 text-sm">
            This invite link has expired. Request a new invite from a household admin.
          </p>
          <p className="text-xs text-base-content/50">
            Request a new invite and then open the latest link to join the household.
          </p>
          <Link to="/login" className="btn btn-primary btn-sm btn-bevel no-underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
