/* eslint-disable react-refresh/only-export-components -- router file: mixes lazy component declarations with non-component router export */
import { createBrowserRouter } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import AppShell from './components/AppShell'
import LoadingSpinner from './components/LoadingSpinner'
import ErrorBoundary from './components/ErrorBoundary'

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

const SuspenseWrapper = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<LoadingSpinner />}>
    <ErrorBoundary>{children}</ErrorBoundary>
  </Suspense>
)

export const router = createBrowserRouter([
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
      { path: 'import', element: <SuspenseWrapper><ImportWizard /></SuspenseWrapper> },
      { path: '*', element: <SuspenseWrapper><NotFound /></SuspenseWrapper> },
    ],
  },
])
