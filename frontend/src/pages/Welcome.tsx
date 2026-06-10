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

type WizardStep = 'choose' | 'create' | 'invite-instructions'

function validateName(value: string): string | null {
  if (!value.trim()) return 'Household name is required'
  if (value.trim().length > 64) return 'Name must be 64 characters or less'
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
          setSubmitError(detail ?? 'Could not create household. Please check your inputs.')
        } else if (err.response?.status === 409) {
          setSubmitError('A household with that name already exists. Please choose a different name.')
        } else if (!err.response) {
          setSubmitError('Unable to connect. Please check your connection and try again.')
        } else {
          setSubmitError('Could not create household. Please try again.')
        }
      } else {
        setSubmitError('Could not create household. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <StandaloneHouseholdShell background="bg-household-transition" align="center">
        <div className="glass-card card-bevel p-6 text-center" role="status" aria-live="polite">
          <span className="loading loading-spinner loading-lg text-primary" aria-label="Loading welcome" />
          <p className="mt-3 text-sm text-base-content/70">Preparing household setup…</p>
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
        <div className="glass-card card-bevel p-6 space-y-5">
          {step === 'choose' ? (
            <>
              <div className="text-center space-y-3">
                <p className="text-xs uppercase tracking-[0.22em] text-amber-300/70">Household setup</p>
                <h1 id="welcome-heading" className="text-2xl font-display text-base-content">Welcome to Kaapi Kadai</h1>
                <p className="text-base-content/80 text-sm">
                  Kaapi Kadai is a household app. You&apos;ll need to either create a new household or accept an invitation from a friend.
                </p>
              </div>

              <button
                type="button"
                className="btn btn-primary w-full btn-bevel"
                onClick={() => setStep('create')}
              >
                Create my household
              </button>

              <button
                type="button"
                className="btn btn-outline btn-bevel w-full"
                onClick={() => setStep('invite-instructions')}
              >
                I have an invitation
              </button>
            </>
          ) : null}

          {step === 'create' ? (
            <>
              <div className="space-y-2 text-center">
                <h1 className="text-2xl font-display text-base-content">Create your household</h1>
                <p className="text-base-content/70 text-sm">
                  Give your household a name to get started.
                </p>
              </div>

              <form onSubmit={(e) => { void handleCreateSubmit(e) }} noValidate className="space-y-4">
                <div className="form-control">
                  <label className="label" htmlFor="welcome-household-name">
                    <span className="label-text text-sm font-medium">Household name</span>
                  </label>
                  <input
                    id="welcome-household-name"
                    name="name"
                    type="text"
                    autoComplete="off"
                    required
                    maxLength={64}
                    className={`input input-bordered input-styled w-full ${nameError ? 'input-error' : ''}`}
                    aria-invalid={nameError ? 'true' : 'false'}
                    aria-describedby={nameError ? 'welcome-name-error' : undefined}
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value)
                      if (nameError) setNameError(validateName(e.target.value))
                    }}
                    placeholder="e.g. Home, The Office, Studio…"
                  />
                  {nameError ? (
                    <p id="welcome-name-error" className="text-error text-sm mt-1" role="alert" aria-live="polite">
                      {nameError}
                    </p>
                  ) : null}
                </div>

                {submitError ? (
                  <p className="text-error text-sm text-center" role="alert" aria-live="polite">
                    {submitError}
                  </p>
                ) : null}

                <button
                  type="submit"
                  className="btn btn-primary w-full btn-bevel"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <span className="loading loading-spinner loading-sm" />
                      Creating household...
                    </>
                  ) : (
                    'Create household'
                  )}
                </button>
              </form>

              <button
                type="button"
                className="btn btn-ghost btn-sm w-full"
                onClick={() => {
                  setSubmitError(null)
                  setNameError(null)
                  setStep('choose')
                }}
              >
                ← Back
              </button>
            </>
          ) : null}

          {step === 'invite-instructions' ? (
            <>
              <div className="space-y-3 text-center">
                <h1 className="text-2xl font-display text-base-content">Join with an invitation</h1>
                <p className="text-base-content/80 text-sm">
                  Ask a household admin to share an invitation link with you. Open that link to join their household directly. No email address is required — the link is all you need.
                </p>
              </div>

              <button
                type="button"
                className="btn btn-ghost btn-sm w-full"
                onClick={() => setStep('create')}
              >
                ← Create a new household instead
              </button>
            </>
          ) : null}
        </div>

        <p className="text-center text-xs text-base-content/40">
          Not you?{' '}
          <button
            onClick={logout}
            className="link link-hover text-amber-400/70"
            type="button"
          >
            Sign out
          </button>
        </p>
      </div>
    </StandaloneHouseholdShell>
  )
}
