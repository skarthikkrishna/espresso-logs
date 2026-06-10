import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { getMe } from '../api/auth'
import { acceptInvitation, declineInvitation, getInvitationPreview, type InvitationPreview } from '../api/invitations'
import { useAuth } from '../contexts/AuthContext'
import StandaloneHouseholdShell from '../components/StandaloneHouseholdShell'

function formatExpiry(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'soon'
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function routeForInviteError(error: unknown): '/invite/expired' | '/invite/invalid' | null {
  if (!axios.isAxiosError(error)) return null
  if (error.response?.status === 410) return '/invite/expired'
  if (error.response?.status === 404 || error.response?.status === 422) return '/invite/invalid'
  return null
}

export default function InviteAccept() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { setUser, isAuthenticated, isLoading: authLoading } = useAuth()
  const token = searchParams.get('token')

  const [preview, setPreview] = useState<InvitationPreview | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(true)
  const [isAccepting, setIsAccepting] = useState(false)
  const [isDeclining, setIsDeclining] = useState(false)
  const [declined, setDeclined] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      navigate('/invite/invalid', { replace: true })
      return
    }

    let cancelled = false
    void getInvitationPreview(token)
      .then((data) => {
        if (!cancelled) setPreview(data)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const route = routeForInviteError(err)
        if (route) {
          navigate(route, { replace: true })
          return
        }
        setError('Could not load this invitation. Please retry or ask the household admin for a new link.')
      })
      .finally(() => {
        if (!cancelled) setIsLoadingPreview(false)
      })

    return () => { cancelled = true }
  }, [navigate, token])

  useEffect(() => {
    if (!token || authLoading || isLoadingPreview || !preview || isAuthenticated) return
    navigate(`/login?invite=${encodeURIComponent(token)}&from=${encodeURIComponent('/invite/accept')}`, { replace: true })
  }, [authLoading, isAuthenticated, isLoadingPreview, navigate, preview, token])

  const handleAccept = async () => {
    if (!token) return
    setError(null)
    setIsAccepting(true)
    try {
      await acceptInvitation(token)
      const userData = await getMe()
      setUser(userData)
      navigate('/', { replace: true })
    } catch (err) {
      const route = routeForInviteError(err)
      if (route) {
        navigate(route, { replace: true })
        return
      }
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        const userData = await getMe().catch(() => null)
        if (userData) setUser(userData)
        navigate('/', { replace: true })
        return
      }
      setError('Failed to accept the invitation. Please try again.')
    } finally {
      setIsAccepting(false)
    }
  }

  const handleDecline = async () => {
    if (!token) return
    setError(null)
    setIsDeclining(true)
    try {
      await declineInvitation(token)
      setDeclined(true)
    } catch (err) {
      const route = routeForInviteError(err)
      if (route) {
        navigate(route, { replace: true })
        return
      }
      setError('Could not dismiss the invitation. You can still leave this page without accepting.')
    } finally {
      setIsDeclining(false)
    }
  }

  if (authLoading || isLoadingPreview) {
    return (
      <StandaloneHouseholdShell background="bg-invite-accept" align="right">
        <div className="glass-card card-bevel w-full max-w-sm p-6 text-center" role="status" aria-live="polite">
          <span className="loading loading-spinner loading-lg text-primary" aria-label="Loading invitation" />
          <p className="mt-4 text-sm text-base-content/70">Loading invitation…</p>
        </div>
      </StandaloneHouseholdShell>
    )
  }

  if (!token || !preview || !isAuthenticated) return null

  return (
    <StandaloneHouseholdShell background="bg-invite-accept" align="right" labelledBy="invite-heading">
      <div className="w-full max-w-md">
        <div className="glass-card card-bevel p-6 space-y-5">
          <div className="space-y-2 text-center">
            <p className="text-xs uppercase tracking-[0.22em] text-amber-300/70">Household invitation</p>
            <h1 id="invite-heading" className="text-2xl font-display text-amber-100">Join {preview.household_name}</h1>
            <p className="text-sm text-base-content/75">
              {preview.inviter_display_name} invited you to join as a <span className="text-amber-200">{preview.invited_role}</span>.
            </p>
            <p className="text-xs text-base-content/55">Expires {formatExpiry(preview.expires_at)}</p>
          </div>

          {declined ? (
            <div className="alert alert-info card-bevel text-sm" role="status">
              <span>Invitation dismissed. The link was not consumed; you can revisit it before expiry if you change your mind.</span>
            </div>
          ) : null}

          {error ? <p className="text-error text-sm text-center" role="alert">{error}</p> : null}

          <div className="grid gap-2">
            <button
              type="button"
              onClick={() => { void handleAccept() }}
              disabled={isAccepting || declined}
              className="btn btn-primary w-full btn-bevel"
            >
              {isAccepting ? 'Joining…' : 'Accept invitation'}
            </button>
            <button
              type="button"
              onClick={() => { void handleDecline() }}
              disabled={isDeclining || declined}
              className="btn btn-ghost btn-sm w-full"
            >
              {isDeclining ? 'Dismissing…' : 'Decline without accepting'}
            </button>
            <Link to="/" className="btn btn-outline btn-sm btn-bevel w-full no-underline">
              Go to dashboard
            </Link>
          </div>
        </div>
      </div>
    </StandaloneHouseholdShell>
  )
}
