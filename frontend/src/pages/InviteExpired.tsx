import { Link } from 'react-router-dom'
import StandaloneHouseholdShell from '../components/StandaloneHouseholdShell'

export default function InviteExpired() {
  return (
    <StandaloneHouseholdShell background="bg-invite-recovery" align="left" labelledBy="invite-expired-heading">
      <div className="w-full max-w-md">
        <div className="glass-card card-bevel p-6 text-center space-y-4">
          <p className="text-xs uppercase tracking-[0.22em] text-warning/80">Invitation expired</p>
          <h1 id="invite-expired-heading" className="text-2xl font-display text-amber-100">This invitation has expired</h1>
          <p className="text-base-content/75 text-sm">
            Ask the household admin to resend your invitation. New links are copyable from household settings and remain available until expiry or revocation.
          </p>
          <Link to="/login" className="btn btn-primary btn-sm btn-bevel no-underline">
            Sign in
          </Link>
        </div>
      </div>
    </StandaloneHouseholdShell>
  )
}
