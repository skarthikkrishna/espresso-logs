/* eslint-disable react-refresh/only-export-components -- router file: mixes lazy component declarations with non-component router export */
import { createBrowserRouter } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import AppShell from './components/AppShell'
import LoadingSpinner from './components/LoadingSpinner'
import ErrorBoundary from './components/ErrorBoundary'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Register from './pages/Register'

import CatalogDetail from './pages/CatalogDetail'
import BrewLogDetail from './pages/BrewLogDetail'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const CatalogList = lazy(() => import('./pages/CatalogList'))
const HardwarePage = lazy(() => import('./pages/HardwarePage'))
const BrewLogList = lazy(() => import('./pages/BrewLogList'))
const BrewLogAdd = lazy(() => import('./pages/BrewLogAdd'))
const ImportWizard = lazy(() => import('./pages/ImportWizard'))
const NotFound = lazy(() => import('./pages/NotFound'))
const Welcome = lazy(() => import('./pages/Welcome'))
const InviteAccept = lazy(() => import('./pages/InviteAccept'))
const InviteInvalid = lazy(() => import('./pages/InviteInvalid'))
const InviteExpired = lazy(() => import('./pages/InviteExpired'))
const Profile = lazy(() => import('./pages/Profile'))
const HouseholdNew = lazy(() => import('./pages/HouseholdNew'))
const HouseholdSettings = lazy(() => import('./pages/HouseholdSettings'))
const HouseholdGuestView = lazy(() => import('./pages/HouseholdGuestView'))

const SuspenseWrapper = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<LoadingSpinner />}>
    <ErrorBoundary>{children}</ErrorBoundary>
  </Suspense>
)

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  { path: '/register', element: <Register /> },
  { path: '/welcome', element: <SuspenseWrapper><Welcome /></SuspenseWrapper> },
  { path: '/invite/accept', element: <SuspenseWrapper><InviteAccept /></SuspenseWrapper> },
  { path: '/invite/invalid', element: <SuspenseWrapper><InviteInvalid /></SuspenseWrapper> },
  { path: '/invite/expired', element: <SuspenseWrapper><InviteExpired /></SuspenseWrapper> },
  { path: '/households/:householdId/view', element: <SuspenseWrapper><HouseholdGuestView /></SuspenseWrapper> },
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/household/new', element: <SuspenseWrapper><HouseholdNew /></SuspenseWrapper> },
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
          {
            element: <ProtectedRoute requiredRole="admin" />,
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
