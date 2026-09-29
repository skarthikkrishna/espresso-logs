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
import { LayerTransition } from '../components/ui'
import {
  EntityFormActions,
  TakeoverCard,
  ToneInput,
  ToneProvider,
} from '../components/tone-system'
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
        <ToneProvider lockedTone="dark">
          <TakeoverCard className="space-y-5">
            <div className="text-center">
              <h1 id="household-new-heading" className="kk-tc-title text-2xl">
                {COPY.householdNew.title}
              </h1>
              <div className="kk-tc-section">
                <p className="kk-tc-body-muted">
                  {COPY.onboarding.nameHint}
                </p>
              </div>
            </div>

            <form onSubmit={(e) => { void handleSubmit(e) }} noValidate className="space-y-4">
              <ToneInput
                label={COPY.onboarding.nameLabel}
                id="household-name"
                name="name"
                type="text"
                autoComplete="off"
                maxLength={64}
                error={nameError}
                errorId="name-error"
                aria-invalid={nameError ? 'true' : 'false'}
                aria-describedby={nameError ? 'name-error' : undefined}
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (nameError) setNameError(validateName(e.target.value))
                }}
                placeholder={COPY.onboarding.namePlaceholder}
              />

              <EntityFormActions
                primaryLabel={COPY.householdNew.submit}
                primaryType="submit"
                isSubmitting={isSubmitting}
                errorMessage={submitError ?? undefined}
                secondaryLabel={COPY.householdNew.cancel}
                secondaryVariant="ghost"
                onSecondary={() => navigate(-1)}
              />
            </form>
          </TakeoverCard>
        </ToneProvider>
      </LayerTransition>
    </StandaloneHouseholdShell>
  )
}
