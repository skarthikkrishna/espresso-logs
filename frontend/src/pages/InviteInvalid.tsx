import { Link } from 'react-router-dom'
import StandaloneHouseholdShell from '../components/StandaloneHouseholdShell'

export default function InviteInvalid() {
  return (
    <StandaloneHouseholdShell background="bg-invite-recovery" align="left" labelledBy="invite-invalid-heading">
      <div className="w-full max-w-md">
        <div className="glass-card card-bevel p-6 text-center space-y-4">
          <p className="text-xs uppercase tracking-[0.22em] text-error/80">Invitation unavailable</p>
          <h1 id="invite-invalid-heading" className="text-2xl font-display text-amber-100">This invitation link is not valid</h1>
          <p className="text-base-content/75 text-sm">
            Ask the household admin to send you a new invitation. For security, links stop working when they are revoked, replaced, or already resolved.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link to="/login" className="btn btn-primary btn-sm btn-bevel no-underline">
              Sign in
            </Link>
            <Link to="/register" className="btn btn-outline btn-sm btn-bevel no-underline">
              Create account
            </Link>
          </div>
        </div>
      </div>
    </StandaloneHouseholdShell>
  )
}
