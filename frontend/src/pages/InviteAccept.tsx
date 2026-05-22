/**
 * InviteAccept page — handles /invite/accept?token=<tok> URLs.
 *
 * Reads the invite token from the query string, shows a confirmation screen,
 * then calls POST /households/accept-invite on confirmation. On success,
 * refreshes auth state and navigates to the home dashboard.
 *
 * Handles error states:
 *   - Missing token → redirect to /invite/invalid
 *   - 404/410 expired → redirect to /invite/expired
 *   - Other errors → inline error with retry
 *
 * Spec: functional-spec-v2.md §690-726
 */

import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { apiClient } from '../api/client'
import { getMe } from '../api/auth'
import { useAuth } from '../contexts/AuthContext'

interface InviteInfo {
  household_name: string
  inviter_display_name: string
  role: 'admin' | 'member'
}

export default function InviteAccept() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { setUser, isAuthenticated, isLoading: authLoading } = useAuth()

  const token = searchParams.get('token')

  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null)
  const [isLoadingInfo, setIsLoadingInfo] = useState(true)
  const [isAccepting, setIsAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Redirect to invalid page immediately if no token present
  useEffect(() => {
    if (!token) {
      navigate('/invite/invalid', { replace: true })
    }
  }, [token, navigate])

  // Redirect unauthenticated users to login, preserving the invite token
  useEffect(() => {
    if (!authLoading && !isAuthenticated && token) {
      navigate(`/login?invite=${encodeURIComponent(token)}&from=${encodeURIComponent('/invite/accept')}`, { replace: true })
    }
  }, [authLoading, isAuthenticated, token, navigate])

  // Fetch invite preview info
  useEffect(() => {
    if (!token || !isAuthenticated) return

    void (async () => {
      setIsLoadingInfo(true)
      try {
        const { data } = await apiClient.get<InviteInfo>(`/households/invite-info?token=${encodeURIComponent(token)}`)
        setInviteInfo(data)
      } catch (err) {
        if (axios.isAxiosError(err)) {
          if (err.response?.status === 410) {
            navigate('/invite/expired', { replace: true })
            return
          }
          if (err.response?.status === 404) {
            navigate('/invite/invalid', { replace: true })
            return
          }
        }
        // If the endpoint doesn't exist yet, show a generic accept confirmation
        setInviteInfo(null)
      } finally {
        setIsLoadingInfo(false)
      }
    })()
  }, [token, isAuthenticated, navigate])

  const handleAccept = async () => {
    if (!token) return
    setError(null)
    setIsAccepting(true)

    try {
      await apiClient.post('/households/accept-invite', { token })
      const userData = await getMe()
      setUser(userData)
      navigate('/', { replace: true })
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 410) {
          navigate('/invite/expired', { replace: true })
          return
        }
        if (err.response?.status === 404) {
          navigate('/invite/invalid', { replace: true })
          return
        }
        if (err.response?.status === 409) {
          setError('You are already a member of this household.')
        } else {
          setError('Failed to accept the invitation. Please try again.')
        }
      } else {
        setError('Unable to connect. Please check your connection.')
      }
    } finally {
      setIsAccepting(false)
    }
  }

  if (authLoading || isLoadingInfo) {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary" aria-label="Loading invitation" />
      </div>
    )
  }

  if (!token || !isAuthenticated) return null

  return (
    <div className="min-h-screen bg-base-100 flex items-start justify-center pt-16 px-4">
      <div className="w-full max-w-sm">
        <div className="bg-base-200/80 border border-[rgba(255,255,255,0.08)] rounded-xl p-6 shadow-lg space-y-5">
          <div className="text-center">
            <p className="text-4xl mb-2" aria-hidden="true">🏠</p>
            <h1 className="text-xl font-display text-amber-100">Household Invitation</h1>
          </div>

          {inviteInfo ? (
            <div className="space-y-2 text-sm text-center">
              <p className="text-base-content/80">
                <span className="text-amber-200">{inviteInfo.inviter_display_name}</span> invited you to join
              </p>
              <p className="text-amber-100 text-lg font-medium">{inviteInfo.household_name}</p>
              <p className="text-base-content/60">
                You'll join as a <span className="text-amber-200">{inviteInfo.role}</span>.
              </p>
            </div>
          ) : (
            <p className="text-center text-sm text-base-content/70">
              Accept this invitation to join the household.
            </p>
          )}

          {error && (
            <p className="text-error text-sm text-center" role="alert">{error}</p>
          )}

          <button
            type="button"
            onClick={() => { void handleAccept() }}
            disabled={isAccepting}
            className="btn btn-primary w-full btn-bevel"
          >
            {isAccepting ? (
              <>
                <span className="loading loading-spinner loading-sm" />
                Joining...
              </>
            ) : (
              'Accept invitation'
            )}
          </button>

          <button
            type="button"
            onClick={() => navigate('/')}
            className="btn btn-ghost btn-sm w-full"
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  )
}
