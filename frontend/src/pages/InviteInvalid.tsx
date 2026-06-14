import { Link } from 'react-router-dom'
import StandaloneHouseholdShell from '../components/StandaloneHouseholdShell'
import { COPY } from '../copy'

export default function InviteInvalid() {
  return (
    <StandaloneHouseholdShell background="bg-invite-recovery" align="left" labelledBy="invite-invalid-heading">
      <div className="w-full max-w-md">
        <div className="kaapi-content-surface p-6 text-center space-y-4">
          <p className="text-xs uppercase tracking-[0.22em] text-error">{COPY.invite.invalidEyebrow}</p>
          <h1 id="invite-invalid-heading" className="text-2xl font-display text-[var(--kaapi-content-content)]">{COPY.invite.invalidTitle}</h1>
          <p className="text-[var(--kaapi-content-muted)] text-sm">
            {COPY.invite.invalidBody}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link to="/login" className="btn btn-primary btn-sm btn-bevel no-underline">
              {COPY.invite.signIn}
            </Link>
            <Link to="/register" className="btn btn-outline btn-sm btn-bevel no-underline">
              {COPY.invite.createAccount}
            </Link>
          </div>
        </div>
      </div>
    </StandaloneHouseholdShell>
  )
}
