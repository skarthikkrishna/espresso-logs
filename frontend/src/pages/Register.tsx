/**
 * Register page — standalone auth layout (no AppShell wrapper).
 *
 * Client-side validation fires on blur and on submit. Server 409 renders
 * inline under the username field. Success (201) stores token and navigates
 * to /welcome (new users have no household) or accepts a pending invite.
 *
 * AC-101: /register renders with all four fields.
 * AC-011: 409 error shows under username field.
 * AC-103: Access token stored in AuthContext state only (no module-level setter).
 */

import { useState, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { register, getMe } from '../api/auth'
import { useAuth } from '../contexts/AuthContext'
import StandaloneHouseholdShell from '../components/StandaloneHouseholdShell'
import { Button, FormField, Input, LayerTransition } from '../components/ui'
import { COPY } from '../copy'

// ---------------------------------------------------------------------------
// Validation helpers — aligned with spec: 3–30 chars, alphanumeric + undersscores only
// ---------------------------------------------------------------------------

function validateUsername(value: string): string | null {
  if (value.length < 3) return COPY.auth.usernameTooShort
  if (value.length > 30) return COPY.auth.usernameTooLong
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(value)) {
    return COPY.auth.usernameInvalid
  }
  return null
}

function validatePassword(value: string): string | null {
  if (value.length < 12) return COPY.auth.passwordTooShort
  return null
}

function validateConfirm(value: string, password: string): string | null {
  if (value !== password) return COPY.auth.passwordsNoMatch
  return null
}

// ---------------------------------------------------------------------------
// Register page
// ---------------------------------------------------------------------------

export default function Register() {
  const { setAccessToken: ctxSetToken, setUser } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const inviteToken = searchParams.get('invite')
  const returnTo = searchParams.get('from')
  const authQuery = searchParams.toString()

  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [errors, setErrors] = useState<{
    username: string | null
    password: string | null
    confirmPassword: string | null
  }>({ username: null, password: null, confirmPassword: null })

  const [isSubmitting, setIsSubmitting] = useState(false)

  const usernameRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const confirmRef = useRef<HTMLInputElement>(null)

  // -------------------------------------------------------------------------
  // Blur handlers — validate individual field on leave
  // -------------------------------------------------------------------------

  const handleUsernameBlur = () => {
    if (username)
      setErrors((e) => ({ ...e, username: validateUsername(username) }))
  }

  const handlePasswordBlur = () => {
    if (password)
      setErrors((e) => ({ ...e, password: validatePassword(password) }))
  }

  const handleConfirmBlur = () => {
    if (confirmPassword)
      setErrors((e) => ({
        ...e,
        confirmPassword: validateConfirm(confirmPassword, password),
      }))
  }

  // -------------------------------------------------------------------------
  // Submit
  // -------------------------------------------------------------------------

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    const usernameErr = validateUsername(username)
    const passwordErr = validatePassword(password)
    const confirmErr = validateConfirm(confirmPassword, password)

    setErrors({
      username: usernameErr,
      password: passwordErr,
      confirmPassword: confirmErr,
    })

    if (usernameErr || passwordErr || confirmErr) {
      if (usernameErr) {
        usernameRef.current?.focus()
      } else if (passwordErr) {
        passwordRef.current?.focus()
      } else {
        confirmRef.current?.focus()
      }
      return
    }

    setIsSubmitting(true)

    try {
      const { access_token } = await register(username, password, displayName)
      ctxSetToken(access_token)
      const userData = await getMe()
      setUser(userData)
      // New users have no household — send to onboarding unless invite token present
      if (inviteToken) {
        navigate(`/invite/accept?token=${encodeURIComponent(inviteToken)}`, { replace: true })
      } else if (returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')) {
        navigate(returnTo, { replace: true })
      } else {
        navigate('/welcome', { replace: true })
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 409) {
          setErrors((e) => ({
            ...e,
            username: COPY.auth.usernameTaken,
          }))
          usernameRef.current?.focus()
        } else if (err.response?.status === 422) {
          const detail = (err.response.data as { detail?: string }).detail
          setErrors((e) => ({
            ...e,
            username: detail ?? COPY.auth.registrationFailed,
          }))
          usernameRef.current?.focus()
        } else if (err.response && err.response.status >= 500) {
          // Server error: registration may have partially succeeded. Guide user
          // to try signing in rather than retrying and hitting a 409.
          setErrors((e) => ({
            ...e,
            username: COPY.auth.serverError,
          }))
          usernameRef.current?.focus()
        } else if (!err.response) {
          setErrors((e) => ({
            ...e,
            username: COPY.auth.connectionError,
          }))
          usernameRef.current?.focus()
        }
      } else {
        setErrors((e) => ({
          ...e,
          username: COPY.auth.unexpectedError,
        }))
        usernameRef.current?.focus()
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <StandaloneHouseholdShell background="bg-auth-register" align="left" labelledBy="register-heading">
      <LayerTransition variant="route" className="w-full max-w-sm">
        <div className="kaapi-content-surface p-6">
          <h1 id="register-heading" className="font-display text-2xl text-[var(--kaapi-content-content)] text-center mb-6">
            {COPY.auth.createAccount}
          </h1>

          {inviteToken ? (
            <div className="alert alert-info card-bevel mb-4 text-sm">
              <span>{COPY.auth.registerInviteBanner}</span>
            </div>
          ) : null}

          <form
            onSubmit={(e) => {
              void handleSubmit(e)
            }}
            noValidate
            className="space-y-4"
          >
            <FormField
              label={COPY.auth.usernameLabel}
              htmlFor="reg-username"
              error={errors.username}
              errorId="reg-username-error"
            >
              <Input
                ref={usernameRef}
                id="reg-username"
                name="username"
                type="text"
                autoComplete="username"
                required
                error={Boolean(errors.username)}
                aria-invalid={errors.username ? 'true' : 'false'}
                aria-describedby={errors.username ? 'reg-username-error' : undefined}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onBlur={handleUsernameBlur}
              />
            </FormField>

            <FormField
              label={COPY.auth.displayNameLabel}
              htmlFor="reg-display-name"
              hint={COPY.auth.displayNameHint}
            >
              <Input
                id="reg-display-name"
                name="display_name"
                type="text"
                autoComplete="name"
                aria-invalid="false"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </FormField>

            <FormField
              label={COPY.auth.passwordLabel}
              htmlFor="reg-password"
              error={errors.password}
              errorId="reg-password-error"
            >
              <Input
                ref={passwordRef}
                id="reg-password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                error={Boolean(errors.password)}
                aria-invalid={errors.password ? 'true' : 'false'}
                aria-describedby={errors.password ? 'reg-password-error' : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={handlePasswordBlur}
              />
            </FormField>

            <FormField
              label={COPY.auth.confirmPasswordLabel}
              htmlFor="reg-confirm-password"
              error={errors.confirmPassword}
              errorId="reg-confirm-error"
            >
              <Input
                ref={confirmRef}
                id="reg-confirm-password"
                name="confirm_password"
                type="password"
                autoComplete="new-password"
                required
                error={Boolean(errors.confirmPassword)}
                aria-invalid={errors.confirmPassword ? 'true' : 'false'}
                aria-describedby={
                  errors.confirmPassword ? 'reg-confirm-error' : undefined
                }
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onBlur={handleConfirmBlur}
              />
            </FormField>

            <Button
              type="submit"
              variant="primary"
              fullWidth
              loading={isSubmitting}
              loadingText={COPY.auth.creatingAccount}
            >
              {COPY.auth.createAccount}
            </Button>
          </form>

          <p className="text-center text-sm mt-6 text-[var(--kaapi-content-content)]">
            {COPY.auth.haveAccountPrompt}{' '}
            <Link to={authQuery ? `/login?${authQuery}` : '/login'} className="link link-hover font-medium text-[var(--kaapi-content-content)]">
              {COPY.auth.signIn}
            </Link>
          </p>
        </div>
      </LayerTransition>
    </StandaloneHouseholdShell>
  )
}
