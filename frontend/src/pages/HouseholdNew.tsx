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
import { getMe } from '../api/auth'
import { createHousehold } from '../api/households'
import { useAuth } from '../contexts/AuthContext'
import StandaloneHouseholdShell from '../components/StandaloneHouseholdShell'
import { Button, FormField, Input, LayerTransition } from '../components/ui'
import { COPY } from '../copy'

function validateName(value: string): string | null {
  if (!value.trim()) return COPY.onboarding.nameRequired
  if (value.trim().length > 64) return COPY.onboarding.nameTooLong
  return null
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
      await createHousehold(name.trim())
      const userData = await getMe()
      setUser(userData)
      navigate('/', { replace: true })
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 409) {
          setNameError(COPY.householdNew.duplicateName)
        } else if (!err.response) {
          setSubmitError(COPY.householdNew.offline)
        } else {
          setSubmitError(COPY.householdNew.createFailed)
        }
      } else {
        setSubmitError(COPY.householdNew.unexpected)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <StandaloneHouseholdShell background="bg-household-onboarding" align="center" labelledBy="household-new-heading">
      <LayerTransition variant="route" className="w-full max-w-sm">
        <div className="kaapi-content-surface p-6 space-y-5">
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--kaapi-content-muted)]">
              {COPY.householdNew.eyebrow}
            </p>
            <h1 id="household-new-heading" className="text-xl font-display text-[var(--kaapi-content-content)]">
              {COPY.householdNew.title}
            </h1>
            <p className="mt-1 text-sm text-[var(--kaapi-content-muted)]">
              {COPY.onboarding.nameHint}
            </p>
          </div>

          <form onSubmit={(e) => { void handleSubmit(e) }} noValidate className="space-y-4">
            <FormField label={COPY.onboarding.nameLabel} htmlFor="household-name" error={nameError} errorId="name-error">
              <Input
                id="household-name"
                name="name"
                type="text"
                autoComplete="off"
                required
                maxLength={64}
                error={Boolean(nameError)}
                aria-invalid={nameError ? 'true' : 'false'}
                aria-describedby={nameError ? 'name-error' : undefined}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={handleBlur}
                placeholder={COPY.onboarding.namePlaceholder}
              />
            </FormField>

            {submitError && (
              <p className="text-error text-sm text-center" role="alert">{submitError}</p>
            )}

            <Button
              type="submit"
              variant="primary"
              fullWidth
              loading={isSubmitting}
              loadingText={COPY.householdNew.creating}
            >
              {COPY.householdNew.submit}
            </Button>
          </form>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            fullWidth
            onClick={() => navigate(-1)}
          >
            {COPY.householdNew.cancel}
          </Button>
        </div>
      </LayerTransition>
    </StandaloneHouseholdShell>
  )
}
