/**
 * ProtectedRoute — auth + optional role guard for React Router v6 nested routes.
 */

import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface ProtectedRouteProps {
  requiredRole?: 'admin' | 'member'
}

export default function ProtectedRoute({ requiredRole }: ProtectedRouteProps) {
  const { isLoading, isAuthenticated, activeMembership } = useAuth()

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

  if (requiredRole === 'admin' && activeMembership?.role !== 'admin') {
    return <Navigate replace to="/" />
  }

  return <Outlet />
}
