import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { getMe } from '../api/auth'
import { acceptInvitation, declineInvitation, getInvitationPreview, type InvitationPreview } from '../api/invitations'
import { useAuth } from '../contexts/AuthContext'
import StandaloneHouseholdShell from '../components/StandaloneHouseholdShell'
import { Button, LayerTransition } from '../components/ui'
import { COPY } from '../copy'

function formatExpiry(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return COPY.invite.expirySoon
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
        setError(COPY.invite.loadError)
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
      setError(COPY.invite.acceptFailed)
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
      setError(COPY.invite.declineFailed)
    } finally {
      setIsDeclining(false)
    }
  }

  if (authLoading || isLoadingPreview) {
    return (
      <StandaloneHouseholdShell background="bg-invite-accept" align="right">
        <div className="kaapi-content-surface w-full max-w-sm p-6 text-center" role="status" aria-live="polite">
          <span className="loading loading-spinner loading-lg text-primary" aria-label={COPY.invite.loadingAria} />
          <p className="mt-4 text-sm text-[var(--kaapi-content-muted)]">{COPY.invite.loadingBody}</p>
        </div>
      </StandaloneHouseholdShell>
    )
  }

  if (!token || !preview || !isAuthenticated) return null

  return (
    <StandaloneHouseholdShell background="bg-invite-accept" align="right" labelledBy="invite-heading">
      <LayerTransition variant="route" className="w-full max-w-md">
        <div className="kaapi-content-surface p-6 space-y-5">
          <div className="space-y-2 text-center">
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--kaapi-content-muted)]">{COPY.invite.eyebrow}</p>
            <h1 id="invite-heading" className="text-2xl font-display text-[var(--kaapi-content-content)]">{COPY.invite.joinHeading(preview.household_name)}</h1>
            <p className="text-sm text-[var(--kaapi-content-muted)]">
              {COPY.invite.invitedBy(preview.inviter_display_name, preview.invited_role)}
            </p>
            <p className="text-xs text-[var(--kaapi-content-muted)]">{COPY.invite.expires(formatExpiry(preview.expires_at))}</p>
          </div>

          {declined ? (
            <div className="alert alert-info card-bevel text-sm" role="status">
              <span>{COPY.invite.dismissedBanner}</span>
            </div>
          ) : null}

          {error ? <p className="text-error text-sm text-center" role="alert">{error}</p> : null}

          <div className="grid gap-2">
            <Button
              type="button"
              variant="primary"
              fullWidth
              onClick={() => { void handleAccept() }}
              disabled={isAccepting || declined}
            >
              {isAccepting ? COPY.invite.joining : COPY.invite.accept}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              fullWidth
              onClick={() => { void handleDecline() }}
              disabled={isDeclining || declined}
            >
              {isDeclining ? COPY.invite.dismissing : COPY.invite.decline}
            </Button>
            <Link to="/" className="btn btn-outline btn-sm btn-bevel w-full no-underline">
              {COPY.invite.goToDashboard}
            </Link>
          </div>
        </div>
      </LayerTransition>
    </StandaloneHouseholdShell>
  )
}
