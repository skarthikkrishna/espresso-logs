/**
 * AdminRoute — role guard for admin-only React Router v6 nested routes.
 *
 * Requires the user to be authenticated AND to be an admin in the active
 * household. Non-admins are redirected to the home page with a 403-style
 * notice. Unauthenticated users fall through to ProtectedRoute (which must
 * wrap this in the route tree).
 *
 * Usage (in router.tsx):
 *   { element: <AdminRoute />, children: [...admin pages...] }
 */

import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function AdminRoute() {
  const { activeMembership, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary" aria-label="Loading" />
      </div>
    )
  }

  if (activeMembership?.role !== 'admin') {
    return <Navigate replace to="/" />
  }

  return <Outlet />
}
