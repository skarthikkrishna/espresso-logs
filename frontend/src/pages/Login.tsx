/**
 * Login page — standalone auth layout (no AppShell wrapper).
 *
 * Handles:
 *   - Standard username/password login
 *   - Google OAuth success redirect (?oauth_success=1)
 *   - 401 / 429 / network error states
 *   - Invite token preservation (?invite=<tok>) across auth flow
 *   - Return-to redirect (?from=<path>) after successful login
 *
 * AC-100: /login renders per aria-gate.md layout spec.
 * AC-061: ?oauth_success=1 shows spinner while AuthContext refreshes, then navigates.
 * AC-103: Access token stored in AuthContext state only.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { login, getMe } from '../api/auth'
import { useAuth } from '../contexts/AuthContext'
import StandaloneHouseholdShell from '../components/StandaloneHouseholdShell'
import { Button, FormField, Input } from '../components/ui'
import { COPY } from '../copy'

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
  const {
    setAccessToken: ctxSetToken,
    setUser,
    isAuthenticated,
    isLoading,
    memberships,
    user,
  } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const inviteToken = searchParams.get('invite')
  const returnTo = searchParams.get('from')
  const authQuery = searchParams.toString()
  const googleHref = inviteToken
    ? `/auth/google?invite=${encodeURIComponent(inviteToken)}${returnTo ? `&from=${encodeURIComponent(returnTo)}` : ''}`
    : '/auth/google'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ username: string | null; password: string | null }>({
    username: null,
    password: null,
  })
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Initialise from URL so the effect body never calls setState synchronously
  const [isOAuthProcessing, setIsOAuthProcessing] = useState(
    () => new URLSearchParams(window.location.search).get('oauth_success') === '1',
  )

  const usernameRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  // Determine where to navigate after successful auth
  const getPostAuthDestination = useCallback((user: Awaited<ReturnType<typeof getMe>>) => {
    // If invite token present, go to accept flow
    if (inviteToken) {
      return `/invite/accept?token=${encodeURIComponent(inviteToken)}`
    }
    // If explicit return-to provided and it's a safe relative path, use it
    if (returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')) {
      return returnTo
    }
    // Zero-membership users → onboarding
    const hasMembership =
      (user.memberships && user.memberships.length > 0) ||
      Boolean(user.household_id)
    return hasMembership ? '/' : '/welcome'
  }, [inviteToken, returnTo])

  // Redirect immediately if already authenticated (not during oauth — oauthEffect handles that)
  useEffect(() => {
    if (isOAuthProcessing) return  // Let oauthEffect handle navigation
    if (isAuthenticated) {
      // Determine destination based on memberships from context
      if (inviteToken) {
        navigate(`/invite/accept?token=${encodeURIComponent(inviteToken)}`, { replace: true })
      } else if (returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')) {
        navigate(returnTo, { replace: true })
      } else {
        const hasMembership = memberships.length > 0
        navigate(hasMembership ? '/' : '/welcome', { replace: true })
      }
    }
  }, [isAuthenticated, isOAuthProcessing, navigate, inviteToken, returnTo, memberships])

  // Detect ?oauth_success=1 on mount and complete the OAuth flow
  useEffect(() => {
    if (!isOAuthProcessing) return
    if (isLoading) return  // Wait for AuthContext to finish its own refresh attempt

    let cancelled = false

    if (isAuthenticated) {
      void (async () => {
        try {
          const userData = user ?? await getMe()
          if (cancelled) return
          if (!user) {
            setUser(userData)
          }
          navigate(getPostAuthDestination(userData), { replace: true })
        } catch {
          if (cancelled) return
          setIsOAuthProcessing(false)
          setFormError(COPY.auth.googleFailed)
        }
      })()
    } else {
      void (async () => {
        await Promise.resolve()
        if (cancelled) return
        setIsOAuthProcessing(false)
        setFormError(COPY.auth.googleFailed)
      })()
    }

    return () => { cancelled = true }
  }, [
    getPostAuthDestination,
    isAuthenticated,
    isLoading,
    isOAuthProcessing,
    navigate,
    setUser,
    user,
  ])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormError(null)

    // Client-side required-field validation
    const usernameErr = username.trim() ? null : COPY.auth.usernameRequired
    const passwordErr = password ? null : COPY.auth.passwordRequired
    setFieldErrors({ username: usernameErr, password: passwordErr })
    if (usernameErr) {
      usernameRef.current?.focus()
      return
    }
    if (passwordErr) {
      passwordRef.current?.focus()
      return
    }

    setIsSubmitting(true)

    try {
      const { access_token } = await login(username, password)
      ctxSetToken(access_token)
      const userData = await getMe()
      setUser(userData)
      navigate(getPostAuthDestination(userData), { replace: true })
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) {
          setFormError(COPY.auth.invalidCredentials)
        } else if (err.response?.status === 429) {
          setFormError(COPY.auth.rateLimited)
        } else if (!err.response) {
          setFormError(COPY.auth.connectionError)
        } else {
          setFormError(COPY.auth.unexpectedError)
        }
      } else {
        setFormError(COPY.auth.connectionError)
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
      <StandaloneHouseholdShell background="bg-auth-login" align="right">
        <div className="w-full max-w-sm">
          <div className="kaapi-content-surface p-6 text-center">
            <h1 id="oauth-heading" className="sr-only">{COPY.auth.signingInAria}</h1>
            <span className="loading loading-spinner loading-lg text-primary" aria-label={COPY.auth.signingInAria} />
            <p className="mt-4 text-[var(--kaapi-content-muted)]">{COPY.auth.oauthBody}</p>
            {inviteToken ? (
              <p className="mt-2 text-sm text-[var(--kaapi-content-muted)]">{COPY.auth.oauthInviteNote}</p>
            ) : null}
          </div>
        </div>
      </StandaloneHouseholdShell>
    )
  }

  // ---------------------------------------------------------------------------
  // Main login form
  // ---------------------------------------------------------------------------

  return (
    <StandaloneHouseholdShell background="bg-auth-login" align="right" labelledBy="login-heading">
      <div className="w-full max-w-sm">
        <div className="kaapi-content-surface p-6">
          <h1 id="login-heading" className="font-display text-2xl text-[var(--kaapi-content-content)] text-center mb-6">
            {COPY.auth.signIn}
          </h1>

          {inviteToken ? (
            <div className="alert alert-info card-bevel mb-4 text-sm">
              <span>{COPY.auth.loginInviteBanner}</span>
            </div>
          ) : null}

          {formError && (
            <div
              id="login-form-error"
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
            className="space-y-4"
          >
            <FormField
              label={COPY.auth.usernameLabel}
              htmlFor="login-username"
              error={fieldErrors.username}
              errorId="login-username-error"
            >
              <Input
                ref={usernameRef}
                id="login-username"
                name="username"
                type="text"
                autoComplete="username"
                required
                error={Boolean(fieldErrors.username)}
                aria-invalid={fieldErrors.username ? 'true' : 'false'}
                aria-describedby={fieldErrors.username ? 'login-username-error' : formError ? 'login-form-error' : undefined}
                value={username}
                onChange={(e) => { setUsername(e.target.value); setFieldErrors((fe) => ({ ...fe, username: null })) }}
              />
            </FormField>

            <FormField
              label={COPY.auth.passwordLabel}
              htmlFor="login-password"
              error={fieldErrors.password}
              errorId="login-password-error"
            >
              <Input
                ref={passwordRef}
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                error={Boolean(fieldErrors.password)}
                aria-invalid={fieldErrors.password ? 'true' : 'false'}
                aria-describedby={fieldErrors.password ? 'login-password-error' : formError ? 'login-form-error' : undefined}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setFieldErrors((fe) => ({ ...fe, password: null })) }}
              />
            </FormField>

            <Button
              type="submit"
              variant="primary"
              fullWidth
              loading={isSubmitting}
              loadingText={COPY.auth.signingIn}
            >
              {COPY.auth.signIn}
            </Button>
          </form>

          <div className="divider text-xs text-[var(--kaapi-content-muted)]">{COPY.auth.orDivider}</div>

          <a
            href={googleHref}
            className="btn btn-outline btn-bevel w-full"
            aria-label={COPY.auth.googleSignIn}
          >
            <GoogleIcon />
            {COPY.auth.googleSignIn}
          </a>

          <p className="text-sm text-[var(--kaapi-content-muted)] text-center mt-4">
            {COPY.auth.forgotPassword}
          </p>

          <p className="text-center text-sm mt-4 text-[var(--kaapi-content-content)]">
            {COPY.auth.noAccountPrompt}{' '}
            <Link to={authQuery ? `/register?${authQuery}` : '/register'} className="link link-hover font-medium text-[var(--kaapi-content-content)]">
              {COPY.auth.registerCta}
            </Link>
          </p>
        </div>
      </div>
    </StandaloneHouseholdShell>
  )
}
