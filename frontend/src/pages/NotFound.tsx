import { Link } from 'react-router-dom'
import StandaloneHouseholdShell from '../components/StandaloneHouseholdShell'
import { ToneProvider, TonePageWrapper, ToneStateCard } from '../components/tone-system'
import { COPY } from '../copy'

export default function NotFound() {
  return (
    <StandaloneHouseholdShell background="bg-state-empty" align="center">
      <ToneProvider lockedTone="dark">
        <TonePageWrapper className="w-full max-w-md">
          <ToneStateCard
            state="not-found"
            title={COPY.notFound.title}
            message={COPY.notFound.body}
            action={(
              <Link to="/" className="kk-tc-primary-btn no-underline">
                {COPY.notFound.goHome}
              </Link>
            )}
          />
        </TonePageWrapper>
      </ToneProvider>
    </StandaloneHouseholdShell>
  )
}
