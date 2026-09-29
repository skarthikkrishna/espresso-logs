import { Link } from 'react-router-dom'
import StandaloneHouseholdShell from '../components/StandaloneHouseholdShell'
import { LayerTransition } from '../components/ui'
import { ToneProvider, TonePageWrapper, ToneStateCard } from '../components/tone-system'
import { COPY } from '../copy'

export default function InviteInvalid() {
  return (
    <StandaloneHouseholdShell background="bg-invite-recovery" align="center">
      <LayerTransition variant="route" className="w-full max-w-md">
        <ToneProvider lockedTone="dark">
          <TonePageWrapper>
            <ToneStateCard
              state="error"
              title={COPY.invite.invalidTitle}
              message={COPY.invite.invalidBody}
              action={(
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                  <Link to="/login" className="kk-tc-primary-btn no-underline">
                    {COPY.invite.signIn}
                  </Link>
                  <Link to="/register" className="kk-tc-btn kk-tc-btn--edit no-underline">
                    {COPY.invite.createAccount}
                  </Link>
                </div>
              )}
            />
          </TonePageWrapper>
        </ToneProvider>
      </LayerTransition>
    </StandaloneHouseholdShell>
  )
}
