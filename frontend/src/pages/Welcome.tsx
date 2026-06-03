/**
 * Welcome page — onboarding wizard for users with zero household memberships.
 */

import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { apiClient } from '../api/client'
import { getMe } from '../api/auth'
import { useAuth } from '../contexts/AuthContext'

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
      await apiClient.post('/households', { name: name.trim() })
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
      <div className="min-h-screen bg-base-100 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary" aria-label="Loading welcome" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate replace to="/login" />
  }

  if (memberships.length > 0) {
    return <Navigate replace to="/" />
  }

  return (
    <div className="min-h-screen bg-base-100 flex items-start justify-center pt-16 px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="bg-base-200/80 border border-[rgba(255,255,255,0.08)] rounded-xl p-6 shadow-lg space-y-5">
          {step === 'choose' ? (
            <>
              <div className="text-center space-y-3">
                <p className="text-5xl" aria-hidden="true">☕</p>
                <h1 className="text-2xl font-display text-base-content">Welcome to Coffee Tracker</h1>
                <p className="text-base-content/80 text-sm">
                  Coffee Tracker is a household app. You&apos;ll need to either create a new household or accept an invitation from a friend.
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
                className="btn btn-outline w-full border-[rgba(255,255,255,0.08)]"
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
                    className={`input input-bordered w-full bg-[var(--input-bg)] ${nameError ? 'input-error' : ''}`}
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
    </div>
  )
}
