import { Link } from 'react-router-dom'
import StandaloneHouseholdShell from '../components/StandaloneHouseholdShell'
import { LayerTransition } from '../components/ui'
import { COPY } from '../copy'

export default function InviteExpired() {
  return (
    <StandaloneHouseholdShell background="bg-invite-recovery" align="left" labelledBy="invite-expired-heading">
      <LayerTransition variant="route" className="w-full max-w-md">
        <div className="kaapi-content-surface p-6 text-center space-y-4">
          <p className="text-xs uppercase tracking-[0.22em] text-warning">{COPY.invite.expiredEyebrow}</p>
          <h1 id="invite-expired-heading" className="text-2xl font-display text-[var(--kaapi-content-content)]">{COPY.invite.expiredTitle}</h1>
          <p className="text-[var(--kaapi-content-muted)] text-sm">
            {COPY.invite.expiredBody}
          </p>
          <Link to="/login" className="btn btn-primary btn-sm btn-bevel no-underline">
            {COPY.invite.signIn}
          </Link>
        </div>
      </LayerTransition>
    </StandaloneHouseholdShell>
  )
}
