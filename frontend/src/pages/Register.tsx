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

// ---------------------------------------------------------------------------
// Validation helpers — aligned with spec: 3–30 chars, alphanumeric + undersscores only
// ---------------------------------------------------------------------------

function validateUsername(value: string): string | null {
  if (value.length < 3) return 'Username must be at least 3 characters'
  if (value.length > 30) return 'Username must be 30 characters or less'
  if (!/^[a-zA-Z0-9_]+$/.test(value))
    return 'Username can only contain letters, numbers, and underscores'
  if (/^_/.test(value) || /_$/.test(value))
    return 'Username cannot start or end with an underscore'
  return null
}

function validatePassword(value: string): string | null {
  if (value.length < 12) return 'Password must be at least 12 characters'
  return null
}

function validateConfirm(value: string, password: string): string | null {
  if (value !== password) return 'Passwords do not match'
  return null
}

// ---------------------------------------------------------------------------
// Field error display — reusable inline component
// ---------------------------------------------------------------------------

function FieldError({ id, message }: { id: string; message: string | null }) {
  if (!message) return null
  return (
    <p id={id} className="text-error text-sm mt-1" role="alert" aria-live="polite">
      {message}
    </p>
  )
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
            username: 'Username already taken. Please choose another.',
          }))
          usernameRef.current?.focus()
        } else if (err.response?.status === 422) {
          const detail = (err.response.data as { detail?: string }).detail
          setErrors((e) => ({
            ...e,
            username: detail ?? 'Registration failed. Please check your inputs.',
          }))
          usernameRef.current?.focus()
        } else if (!err.response) {
          setErrors((e) => ({
            ...e,
            username: 'Unable to connect. Please check your connection.',
          }))
          usernameRef.current?.focus()
        }
      } else {
        setErrors((e) => ({
          ...e,
          username: 'An unexpected error occurred. Please try again.',
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
    <div className="min-h-screen bg-base-100 flex items-start justify-center pt-20 px-4">
      <div className="w-full max-w-sm">
        <div className="bg-base-200/80 border border-[rgba(255,255,255,0.08)] rounded-xl p-6 shadow-lg">
          <h1 className="font-display text-2xl text-base-content text-center mb-6">
            Create account
          </h1>

          <form
            onSubmit={(e) => {
              void handleSubmit(e)
            }}
            noValidate
          >
            {/* Username */}
            <div className="form-control w-full mb-4">
              <label htmlFor="reg-username" className="label">
                <span className="label-text text-sm font-medium">Username</span>
              </label>
              <input
                ref={usernameRef}
                id="reg-username"
                name="username"
                type="text"
                autoComplete="username"
                required
                className={`input input-bordered w-full bg-[var(--input-bg)] ${errors.username ? 'input-error' : ''}`}
                aria-invalid={errors.username ? 'true' : 'false'}
                aria-describedby={errors.username ? 'reg-username-error' : undefined}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onBlur={handleUsernameBlur}
              />
              <FieldError id="reg-username-error" message={errors.username} />
            </div>

            {/* Display Name (optional) */}
            <div className="form-control w-full mb-4">
              <label htmlFor="reg-display-name" className="label">
                <span className="label-text text-sm font-medium">
                  Display name{' '}
                  <span className="text-base-content/50 font-normal">(optional)</span>
                </span>
              </label>
              <input
                id="reg-display-name"
                name="display_name"
                type="text"
                autoComplete="name"
                className="input input-bordered w-full bg-[var(--input-bg)]"
                aria-invalid="false"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>

            {/* Password */}
            <div className="form-control w-full mb-4">
              <label htmlFor="reg-password" className="label">
                <span className="label-text text-sm font-medium">Password</span>
              </label>
              <input
                ref={passwordRef}
                id="reg-password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                className={`input input-bordered w-full bg-[var(--input-bg)] ${errors.password ? 'input-error' : ''}`}
                aria-invalid={errors.password ? 'true' : 'false'}
                aria-describedby={errors.password ? 'reg-password-error' : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={handlePasswordBlur}
              />
              <FieldError id="reg-password-error" message={errors.password} />
            </div>

            {/* Confirm Password */}
            <div className="form-control w-full mb-6">
              <label htmlFor="reg-confirm-password" className="label">
                <span className="label-text text-sm font-medium">
                  Confirm password
                </span>
              </label>
              <input
                ref={confirmRef}
                id="reg-confirm-password"
                name="confirm_password"
                type="password"
                autoComplete="new-password"
                required
                className={`input input-bordered w-full bg-[var(--input-bg)] ${errors.confirmPassword ? 'input-error' : ''}`}
                aria-invalid={errors.confirmPassword ? 'true' : 'false'}
                aria-describedby={
                  errors.confirmPassword ? 'reg-confirm-error' : undefined
                }
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onBlur={handleConfirmBlur}
              />
              <FieldError id="reg-confirm-error" message={errors.confirmPassword} />
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full btn-bevel"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="loading loading-spinner loading-sm" />
                  Creating account...
                </>
              ) : (
                'Create account'
              )}
            </button>
          </form>

          <p className="text-center text-sm mt-6">
            Already have an account?{' '}
            <Link to="/login" className="link link-hover text-amber-400">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
