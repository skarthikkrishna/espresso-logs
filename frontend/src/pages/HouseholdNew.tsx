/**
 * HouseholdNew page — household creation wizard.
 *
 * Allows an authenticated user to create a new household by entering a name.
 * On success, refreshes auth state (so the new membership appears) and
 * navigates to the home dashboard.
 *
 * Spec: functional-spec-v2.md §862-863
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { apiClient } from '../api/client'
import { getMe } from '../api/auth'
import { useAuth } from '../contexts/AuthContext'

function validateName(value: string): string | null {
  if (!value.trim()) return 'Household name is required'
  if (value.trim().length > 64) return 'Name must be 64 characters or less'
  return null
}

interface CreateHouseholdResponse {
  id: string
  name: string
  created_at: string
  role: 'admin'
}

export default function HouseholdNew() {
  const navigate = useNavigate()
  const { setUser } = useAuth()

  const [name, setName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleBlur = () => {
    if (name) setNameError(validateName(name))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const err = validateName(name)
    setNameError(err)
    if (err) return

    setSubmitError(null)
    setIsSubmitting(true)

    try {
      await apiClient.post<CreateHouseholdResponse>('/households', {
        name: name.trim(),
      })
      const userData = await getMe()
      setUser(userData)
      navigate('/', { replace: true })
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 409) {
          setNameError('A household with this name already exists.')
        } else if (!err.response) {
          setSubmitError('Unable to connect. Please check your connection.')
        } else {
          setSubmitError('Failed to create household. Please try again.')
        }
      } else {
        setSubmitError('An unexpected error occurred.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-base-100 flex items-start justify-center pt-16 px-4">
      <div className="w-full max-w-sm">
        <div className="bg-base-200/80 border border-[rgba(255,255,255,0.08)] rounded-xl p-6 shadow-lg space-y-5">
          <div className="text-center">
            <p className="text-4xl mb-2" aria-hidden="true">🏠</p>
            <h1 className="text-xl font-display text-amber-100">Create a household</h1>
            <p className="text-base-content/60 text-sm mt-1">
              Give your household a name to get started.
            </p>
          </div>

          <form onSubmit={(e) => { void handleSubmit(e) }} noValidate className="space-y-4">
            <div className="form-control">
              <label className="label" htmlFor="household-name">
                <span className="label-text text-sm font-medium">Household name</span>
              </label>
              <input
                id="household-name"
                name="name"
                type="text"
                autoComplete="off"
                required
                maxLength={64}
                className={`input input-bordered w-full bg-[var(--input-bg)] ${nameError ? 'input-error' : ''}`}
                aria-invalid={nameError ? 'true' : 'false'}
                aria-describedby={nameError ? 'name-error' : undefined}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={handleBlur}
                placeholder="e.g. Home, The Office, Studio…"
              />
              {nameError && (
                <p id="name-error" className="text-error text-sm mt-1" role="alert" aria-live="polite">
                  {nameError}
                </p>
              )}
            </div>

            {submitError && (
              <p className="text-error text-sm text-center" role="alert">{submitError}</p>
            )}

            <button
              type="submit"
              className="btn btn-primary w-full btn-bevel"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="loading loading-spinner loading-sm" />
                  Creating…
                </>
              ) : (
                'Create household'
              )}
            </button>
          </form>

          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn btn-ghost btn-sm w-full"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
