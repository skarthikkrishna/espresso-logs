/**
 * ProtectedRoute — auth + optional role guard for React Router v6 nested routes.
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface ProtectedRouteProps {
  requiredRole?: 'admin' | 'member'
}

export default function ProtectedRoute({ requiredRole }: ProtectedRouteProps) {
  const { isLoading, isAuthenticated, activeMembership, memberships } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary" aria-label="Loading" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate replace to="/login" />
  }

  // Zero-membership guard — redirect to /welcome to complete onboarding.
  // Exempt: /household/new and /invite/*.
  const exemptPaths = ['/household/new', '/invite/']
  const isExempt = exemptPaths.some((path) => location.pathname.startsWith(path))

  if (!isLoading && isAuthenticated && memberships.length === 0 && !isExempt) {
    return <Navigate replace to="/welcome" />
  }

  if (requiredRole === 'admin' && activeMembership?.role !== 'admin') {
    return <Navigate replace to="/" />
  }

  return <Outlet />
}
