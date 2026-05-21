/**
 * Login page — standalone auth layout (no AppShell wrapper).
 *
 * Handles:
 *   - Standard username/password login
 *   - Google OAuth success redirect (?oauth_success=1)
 *   - 401 / 429 / network error states
 *
 * AC-100: /login renders per aria-gate.md layout spec.
 * AC-061: ?oauth_success=1 shows spinner, calls refresh, navigates to /.
 * AC-103: Access token stored in AuthContext state only.
 */

import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { login, refresh, getMe } from '../api/auth'
import { setAccessToken } from '../api/client'
import { useAuth } from '../contexts/AuthContext'

// ---------------------------------------------------------------------------
// Google icon (inline SVG — no external dependency)
// ---------------------------------------------------------------------------

function GoogleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className="w-5 h-5"
      aria-hidden="true"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Login page
// ---------------------------------------------------------------------------

export default function Login() {
  const { setAccessToken: ctxSetToken, setUser, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Initialise from URL so the effect body never calls setState synchronously
  const [isOAuthProcessing, setIsOAuthProcessing] = useState(
    () => new URLSearchParams(window.location.search).get('oauth_success') === '1',
  )

  const usernameRef = useRef<HTMLInputElement>(null)

  // Redirect immediately if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true })
    }
  }, [isAuthenticated, navigate])

  // Detect ?oauth_success=1 on mount and complete the OAuth flow
  useEffect(() => {
    if (!isOAuthProcessing) return

    void (async () => {
      try {
        const { access_token } = await refresh()
        setAccessToken(access_token)
        ctxSetToken(access_token)
        const userData = await getMe()
        setUser(userData)
        navigate('/', { replace: true })
      } catch {
        setIsOAuthProcessing(false)
        setFormError('Google sign-in failed. Please try again.')
      }
    })()
  }, [isOAuthProcessing])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormError(null)
    setIsSubmitting(true)

    try {
      const { access_token } = await login(username, password)
      setAccessToken(access_token)
      ctxSetToken(access_token)
      const userData = await getMe()
      setUser(userData)
      navigate('/', { replace: true })
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) {
          setFormError('Invalid username or password')
        } else if (err.response?.status === 429) {
          setFormError('Too many failed attempts. Try again in 15 minutes.')
        } else if (!err.response) {
          setFormError('Unable to connect. Please check your connection.')
        } else {
          setFormError('An unexpected error occurred. Please try again.')
        }
      } else {
        setFormError('Unable to connect. Please check your connection.')
      }
      // Focus first invalid field for accessibility
      usernameRef.current?.focus()
    } finally {
      setIsSubmitting(false)
    }
  }

  // ---------------------------------------------------------------------------
  // OAuth processing interstitial
  // ---------------------------------------------------------------------------

  if (isOAuthProcessing) {
    return (
      <div className="min-h-screen bg-base-100 flex items-start justify-center pt-20 px-4">
        <div className="w-full max-w-sm">
          <div className="bg-base-200/80 border border-[rgba(255,255,255,0.08)] rounded-xl p-6 shadow-lg text-center">
            <span className="loading loading-spinner loading-lg text-primary" aria-label="Signing in" />
            <p className="mt-4 text-base-content/70">Signing you in...</p>
          </div>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Main login form
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-base-100 flex items-start justify-center pt-20 px-4">
      <div className="w-full max-w-sm">
        <div className="bg-base-200/80 border border-[rgba(255,255,255,0.08)] rounded-xl p-6 shadow-lg">
          <h1 className="font-display text-2xl text-base-content text-center mb-6">
            Sign in
          </h1>

          {formError && (
            <div
              role="alert"
              aria-live="polite"
              className="text-error text-sm mb-4 text-center"
            >
              {formError}
            </div>
          )}

          <form
            onSubmit={(e) => {
              void handleSubmit(e)
            }}
            noValidate
          >
            {/* Username */}
            <div className="form-control w-full mb-4">
              <label htmlFor="login-username" className="label">
                <span className="label-text text-sm font-medium">Username</span>
              </label>
              <input
                ref={usernameRef}
                id="login-username"
                name="username"
                type="text"
                autoComplete="username"
                required
                className="input input-bordered w-full bg-[var(--input-bg)]"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            {/* Password */}
            <div className="form-control w-full mb-6">
              <label htmlFor="login-password" className="label">
                <span className="label-text text-sm font-medium">Password</span>
              </label>
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="input input-bordered w-full bg-[var(--input-bg)]"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full btn-bevel"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="loading loading-spinner loading-sm" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <div className="divider text-xs text-base-content/50">or</div>

          <a
            href="/auth/google"
            className="btn btn-outline w-full border-[rgba(255,255,255,0.08)]"
            aria-label="Sign in with Google"
          >
            <GoogleIcon />
            Sign in with Google
          </a>

          <p className="text-sm text-base-content/60 text-center mt-4">
            Forgotten your password? Contact your household admin.
          </p>

          <p className="text-center text-sm mt-4">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="link link-hover text-amber-400">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
