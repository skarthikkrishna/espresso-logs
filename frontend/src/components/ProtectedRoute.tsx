/**
 * ProtectedRoute — auth guard for React Router v6 nested routes.
 *
 * Shows a full-screen loading spinner while the initial token refresh is
 * in-flight, redirects unauthenticated users to /login, and renders
 * <Outlet /> for authenticated users.
 *
 * AC-102: Unauthenticated users are redirected to /login.
 */

import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function ProtectedRoute() {
  const { isLoading, isAuthenticated } = useAuth()

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

  return <Outlet />
}
