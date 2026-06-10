/**
 * ProtectedRoute — auth + optional role guard for React Router v6 nested routes.
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import StandaloneHouseholdShell from './StandaloneHouseholdShell'

interface ProtectedRouteProps {
  requiredRole?: 'admin' | 'member'
}

export default function ProtectedRoute({ requiredRole }: ProtectedRouteProps) {
  const { authState, isLoading, isAuthenticated, activeMembership, memberships } = useAuth()
  const location = useLocation()
  const isRouteLoading = authState === 'LOADING' || isLoading
  const isRouteAuthenticated = authState === 'AUTHENTICATED' || isAuthenticated

  if (isRouteLoading) {
    return (
      <StandaloneHouseholdShell background="bg-household-transition" align="center">
        <div className="glass-card card-bevel p-6 text-center" role="status" aria-live="polite">
          <span className="loading loading-spinner loading-lg text-primary" aria-label="Loading" />
          <p className="mt-3 text-sm text-base-content/70">Loading household context…</p>
        </div>
      </StandaloneHouseholdShell>
    )
  }

  if (!isRouteAuthenticated) {
    return <Navigate replace to="/login" />
  }

  // Zero-membership guard — redirect to /welcome to complete onboarding.
  // Exempt: /household/new and /invite/*.
  const exemptPaths = ['/household/new', '/invite/']
  const isExempt = exemptPaths.some((path) => location.pathname.startsWith(path))

  if (!isRouteLoading && isRouteAuthenticated && memberships.length === 0 && !isExempt) {
    return <Navigate replace to="/welcome" />
  }

  if (requiredRole === 'admin' && activeMembership?.role !== 'admin') {
    return <Navigate replace to="/" />
  }

  return <Outlet />
}
