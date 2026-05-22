/* eslint-disable react-refresh/only-export-components -- router file: mixes lazy component declarations with non-component router export */
import { createBrowserRouter } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import AppShell from './components/AppShell'
import LoadingSpinner from './components/LoadingSpinner'
import ErrorBoundary from './components/ErrorBoundary'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import Login from './pages/Login'
import Register from './pages/Register'

import CatalogDetail from './pages/CatalogDetail'
import BrewLogDetail from './pages/BrewLogDetail'

// Lazy-load less-frequently visited pages
const Dashboard = lazy(() => import('./pages/Dashboard'))
const CatalogList = lazy(() => import('./pages/CatalogList'))
const HardwarePage = lazy(() => import('./pages/HardwarePage'))
const BrewLogList = lazy(() => import('./pages/BrewLogList'))
const BrewLogAdd = lazy(() => import('./pages/BrewLogAdd'))
const ImportWizard = lazy(() => import('./pages/ImportWizard'))
const NotFound = lazy(() => import('./pages/NotFound'))

// M5 household/auth pages
const Welcome = lazy(() => import('./pages/Welcome'))
const InviteAccept = lazy(() => import('./pages/InviteAccept'))
const InviteInvalid = lazy(() => import('./pages/InviteInvalid'))
const Profile = lazy(() => import('./pages/Profile'))
const HouseholdNew = lazy(() => import('./pages/HouseholdNew'))
const HouseholdSettings = lazy(() => import('./pages/HouseholdSettings'))

const SuspenseWrapper = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<LoadingSpinner />}>
    <ErrorBoundary>{children}</ErrorBoundary>
  </Suspense>
)

export const router = createBrowserRouter([
  // Public routes — no ProtectedRoute wrapper (N-003)
  { path: '/login', element: <Login /> },
  { path: '/register', element: <Register /> },
  // Public invite error pages — no auth required
  { path: '/invite/invalid', element: <SuspenseWrapper><InviteInvalid /></SuspenseWrapper> },
  { path: '/invite/expired', element: <SuspenseWrapper><InviteInvalid /></SuspenseWrapper> },

  // Protected routes — all app routes require authentication
  {
    element: <ProtectedRoute />,
    children: [
      // Onboarding — shown before household setup; no AppShell
      { path: '/welcome', element: <SuspenseWrapper><Welcome /></SuspenseWrapper> },
      // Household creation wizard — standalone layout
      { path: '/household/new', element: <SuspenseWrapper><HouseholdNew /></SuspenseWrapper> },
      // Invite accept — standalone layout
      { path: '/invite/accept', element: <SuspenseWrapper><InviteAccept /></SuspenseWrapper> },

      // Main app shell
      {
        path: '/',
        element: <ErrorBoundary><AppShell /></ErrorBoundary>,
        children: [
          { index: true, element: <SuspenseWrapper><Dashboard /></SuspenseWrapper> },
          { path: 'catalog', element: <SuspenseWrapper><CatalogList /></SuspenseWrapper> },
          { path: 'catalog/:id', element: <SuspenseWrapper><CatalogDetail /></SuspenseWrapper> },
          { path: 'hardware', element: <SuspenseWrapper><HardwarePage /></SuspenseWrapper> },
          { path: 'brew-log', element: <SuspenseWrapper><BrewLogList /></SuspenseWrapper> },
          { path: 'brew-log/add', element: <SuspenseWrapper><BrewLogAdd /></SuspenseWrapper> },
          { path: 'brew-log/:id', element: <SuspenseWrapper><BrewLogDetail /></SuspenseWrapper> },
          { path: 'profile', element: <SuspenseWrapper><Profile /></SuspenseWrapper> },

          // Admin-only routes — require 'admin' role in active household
          {
            element: <AdminRoute />,
            children: [
              { path: 'import', element: <SuspenseWrapper><ImportWizard /></SuspenseWrapper> },
              { path: 'household/settings', element: <SuspenseWrapper><HouseholdSettings /></SuspenseWrapper> },
            ],
          },

          { path: '*', element: <SuspenseWrapper><NotFound /></SuspenseWrapper> },
        ],
      },
    ],
  },
])
