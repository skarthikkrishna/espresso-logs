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
import { Button, FormField, Input } from '../components/ui'
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

  if (isLoading) {
    return (
      <StandaloneHouseholdShell background="bg-household-transition" align="center">
        <div className="kaapi-content-surface p-6 text-center" role="status" aria-live="polite">
          <span className="loading loading-spinner loading-lg text-primary" aria-label={COPY.welcome.loadingAria} />
          <p className="mt-3 text-sm text-[var(--kaapi-content-muted)]">{COPY.welcome.loadingBody}</p>
        </div>
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
      <div className="w-full max-w-md space-y-6">
        <div className="kaapi-content-surface p-6 space-y-5">
          {step === 'choose' ? (
            <>
              <div className="text-center space-y-3">
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--kaapi-content-muted)]">{COPY.welcome.eyebrow}</p>
                <h1 id="welcome-heading" className="text-2xl font-display text-[var(--kaapi-content-content)]">{COPY.welcome.title}</h1>
                <p className="text-[var(--kaapi-content-muted)] text-sm">
                  {COPY.welcome.intro}
                </p>
              </div>

              <Button
                type="button"
                variant="primary"
                fullWidth
                onClick={() => setStep('create')}
              >
                {COPY.welcome.createCta}
              </Button>

              <Button
                type="button"
                variant="outline"
                fullWidth
                onClick={() => setStep('invite-instructions')}
              >
                {COPY.welcome.inviteCta}
              </Button>
            </>
          ) : null}

          {step === 'create' ? (
            <>
              <div className="space-y-2 text-center">
                <h1 className="text-2xl font-display text-[var(--kaapi-content-content)]">{COPY.welcome.createTitle}</h1>
                <p className="text-[var(--kaapi-content-muted)] text-sm">
                  {COPY.onboarding.nameHint}
                </p>
              </div>

              <form onSubmit={(e) => { void handleCreateSubmit(e) }} noValidate className="space-y-4">
                <FormField
                  label={COPY.onboarding.nameLabel}
                  htmlFor="welcome-household-name"
                  error={nameError}
                  errorId="welcome-name-error"
                >
                  <Input
                    id="welcome-household-name"
                    name="name"
                    type="text"
                    autoComplete="off"
                    required
                    maxLength={64}
                    error={Boolean(nameError)}
                    aria-invalid={nameError ? 'true' : 'false'}
                    aria-describedby={nameError ? 'welcome-name-error' : undefined}
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value)
                      if (nameError) setNameError(validateName(e.target.value))
                    }}
                    placeholder={COPY.onboarding.namePlaceholder}
                  />
                </FormField>

                {submitError ? (
                  <p className="text-error text-sm text-center" role="alert" aria-live="polite">
                    {submitError}
                  </p>
                ) : null}

                <Button
                  type="submit"
                  variant="primary"
                  fullWidth
                  loading={isSubmitting}
                  loadingText={COPY.welcome.creating}
                >
                  {COPY.welcome.submit}
                </Button>
              </form>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                fullWidth
                onClick={() => {
                  setSubmitError(null)
                  setNameError(null)
                  setStep('choose')
                }}
              >
                {COPY.welcome.back}
              </Button>
            </>
          ) : null}

          {step === 'invite-instructions' ? (
            <>
              <div className="space-y-3 text-center">
                <h1 className="text-2xl font-display text-[var(--kaapi-content-content)]">{COPY.welcome.inviteTitle}</h1>
                <p className="text-[var(--kaapi-content-muted)] text-sm">
                  {COPY.welcome.inviteBody}
                </p>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                fullWidth
                onClick={() => setStep('create')}
              >
                {COPY.welcome.inviteBack}
              </Button>
            </>
          ) : null}
        </div>

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
      </div>
    </StandaloneHouseholdShell>
  )
}
