import { Link } from 'react-router-dom'
import StandaloneHouseholdShell from '../components/StandaloneHouseholdShell'
import { LayerTransition } from '../components/ui'
import { ToneProvider, TonePageWrapper, ToneStateCard } from '../components/tone-system'
import { COPY } from '../copy'

export default function InviteExpired() {
  return (
    <StandaloneHouseholdShell background="bg-invite-recovery" align="center">
      <LayerTransition variant="route" className="w-full max-w-md">
        <ToneProvider lockedTone="dark">
          <TonePageWrapper>
            <ToneStateCard
              state="warning"
              title={COPY.invite.expiredTitle}
              message={COPY.invite.expiredBody}
              action={(
                <Link to="/login" className="kk-tc-primary-btn no-underline">
                  {COPY.invite.signIn}
                </Link>
              )}
            />
          </TonePageWrapper>
        </ToneProvider>
      </LayerTransition>
    </StandaloneHouseholdShell>
  )
}
