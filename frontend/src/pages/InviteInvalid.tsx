/**
 * InviteInvalid page — static error page for invalid or already-used invite links.
 */

import { Link } from 'react-router-dom'

export default function InviteInvalid() {
  return (
    <div className="min-h-screen bg-base-100 flex items-start justify-center pt-16 px-4">
      <div className="w-full max-w-sm">
        <div className="glass-card card-bevel p-6 text-center space-y-4">
          <p className="text-4xl" aria-hidden="true">🚫</p>
          <h1 className="text-xl font-display text-amber-100">Invalid invitation</h1>
          <p className="text-base-content/70 text-sm">
            This invite link is invalid or has already been used.
          </p>
          <Link to="/login" className="btn btn-primary btn-sm btn-bevel no-underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
