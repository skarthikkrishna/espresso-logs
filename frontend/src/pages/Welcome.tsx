/**
 * Welcome page — onboarding wizard for users with zero household memberships.
 */

import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { getMe } from '../api/auth'
import { createHousehold } from '../api/households'
import { useAuth } from '../contexts/AuthContext'
import StandaloneHouseholdShell from '../components/StandaloneHouseholdShell'
import LoadingSpinner from '../components/LoadingSpinner'
import { LayerTransition } from '../components/ui'
import {
  EntityFormActions,
  TakeoverCard,
  ToneButton,
  ToneInput,
  ToneProvider,
} from '../components/tone-system'
import { COPY } from '../copy'

type WizardStep = 'choose' | 'create' | 'invite-instructions'

function validateName(value: string): string | null {
  if (!value.trim()) return COPY.onboarding.nameRequired
  if (value.trim().length > 64) return COPY.onboarding.nameTooLong
  return null
}

export default function Welcome() {
  const navigate = useNavigate()
  const { isAuthenticated, isLoading, memberships, logout, setUser } = useAuth()
  const [step, setStep] = useState<WizardStep>('choose')
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleCreateSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    const error = validateName(name)
    setNameError(error)
    if (error) return

    setSubmitError(null)
    setIsSubmitting(true)

    try {
      await createHousehold(name.trim())
      const userData = await getMe()
      setUser(userData)
      navigate('/', { replace: true })
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 422) {
          const detail = (err.response.data as { detail?: string }).detail
          setSubmitError(detail ?? COPY.welcome.createInvalid)
        } else if (err.response?.status === 409) {
          setSubmitError(COPY.welcome.duplicateName)
        } else if (!err.response) {
          setSubmitError(COPY.welcome.connectionError)
        } else {
          setSubmitError(COPY.welcome.createFailed)
        }
      } else {
        setSubmitError(COPY.welcome.createFailed)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // Transition branch stays a non-tone sibling: a brief auth-loading state on
  // the household-transition background, not part of the tone takeover card.
  if (isLoading) {
    return (
      <StandaloneHouseholdShell background="bg-household-transition" align="center">
        <LoadingSpinner message={COPY.welcome.loadingBody} />
      </StandaloneHouseholdShell>
    )
  }

  if (!isAuthenticated) {
    return <Navigate replace to="/login" />
  }

  if (memberships.length > 0) {
    return <Navigate replace to="/" />
  }

  return (
    <StandaloneHouseholdShell background="bg-household-onboarding" align="center" labelledBy="welcome-heading">
      <LayerTransition variant="route" className="w-full max-w-md space-y-6">
        <ToneProvider lockedTone="dark">
          <TakeoverCard className="space-y-5">
            {step === 'choose' ? (
              <>
                <div className="text-center">
                  <h1 id="welcome-heading" className="kk-tc-title text-2xl">{COPY.welcome.title}</h1>
                  <div className="kk-tc-section">
                    <p className="kk-tc-body-muted">
                      {COPY.welcome.intro}
                    </p>
                  </div>
                </div>

                <ToneButton
                  type="button"
                  variant="primary"
                  className="w-full"
                  onClick={() => setStep('create')}
                >
                  {COPY.welcome.createCta}
                </ToneButton>

                <ToneButton
                  type="button"
                  variant="edit"
                  className="w-full"
                  onClick={() => setStep('invite-instructions')}
                >
                  {COPY.welcome.inviteCta}
                </ToneButton>
              </>
            ) : null}

            {step === 'create' ? (
              <>
                <div className="text-center">
                  <h1 className="kk-tc-title text-2xl">{COPY.welcome.createTitle}</h1>
                  <div className="kk-tc-section">
                    <p className="kk-tc-body-muted">
                      {COPY.onboarding.nameHint}
                    </p>
                  </div>
                </div>

                <form onSubmit={(e) => { void handleCreateSubmit(e) }} noValidate className="space-y-4">
                  <ToneInput
                    label={COPY.onboarding.nameLabel}
                    id="welcome-household-name"
                    name="name"
                    type="text"
                    autoComplete="off"
                    maxLength={64}
                    error={nameError}
                    errorId="welcome-name-error"
                    aria-invalid={nameError ? 'true' : 'false'}
                    aria-describedby={nameError ? 'welcome-name-error' : undefined}
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value)
                      if (nameError) setNameError(validateName(e.target.value))
                    }}
                    placeholder={COPY.onboarding.namePlaceholder}
                  />

                  <EntityFormActions
                    primaryLabel={COPY.welcome.submit}
                    primaryType="submit"
                    isSubmitting={isSubmitting}
                    errorMessage={submitError ?? undefined}
                    secondaryLabel={COPY.welcome.back}
                    secondaryVariant="ghost"
                    onSecondary={() => {
                      setSubmitError(null)
                      setNameError(null)
                      setStep('choose')
                    }}
                  />
                </form>
              </>
            ) : null}

            {step === 'invite-instructions' ? (
              <>
                <div className="text-center">
                  <h1 className="kk-tc-title text-2xl">{COPY.welcome.inviteTitle}</h1>
                  <div className="kk-tc-section">
                    <p className="kk-tc-body-muted">
                      {COPY.welcome.inviteBody}
                    </p>
                  </div>
                </div>

                <ToneButton
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setStep('create')}
                >
                  {COPY.welcome.inviteBack}
                </ToneButton>
              </>
            ) : null}
          </TakeoverCard>
        </ToneProvider>

        <p className="text-center text-xs text-base-content/40">
          {COPY.welcome.notYou}{' '}
          <button
            onClick={logout}
            className="link link-hover text-amber-400/70"
            type="button"
          >
            {COPY.actions.signOut}
          </button>
        </p>
      </LayerTransition>
    </StandaloneHouseholdShell>
  )
}
