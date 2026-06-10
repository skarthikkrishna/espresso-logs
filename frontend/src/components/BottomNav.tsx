import { useState, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import HouseholdSwitcher from './HouseholdSwitcher'
import AccessibleDialog from './AccessibleDialog'
import { useAuth } from '../contexts/AuthContext'

interface NavItem {
  path: string
  label: string
  icon: ReactNode
}

const NAV_ITEMS: NavItem[] = [
  {
    path: '/',
    label: 'Home',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
    ),
  },
  {
    path: '/brew-log',
    label: 'Brew log',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10 3h4v6l6 12H4L10 9V3z" />
        <circle cx="9" cy="15" r="0.5" fill="currentColor" stroke="none" />
        <circle cx="14" cy="17" r="0.5" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    path: '/catalog',
    label: 'Catalog',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>
    ),
  },
  {
    path: '/hardware',
    label: 'Hardware',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="7.05" y2="7.05"/><line x1="16.95" y1="16.95" x2="19.78" y2="19.78"/></svg>
    ),
  },
  {
    path: '/import',
    label: 'Import',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
    ),
  },
]

export default function BottomNav() {
  const [accountOpen, setAccountOpen] = useState(false)
  const { activeMembership, user, logout } = useAuth()

  return (
    <>
      {activeMembership ? (
        <div className="mobile-household-strip nav-shell fixed bottom-[4.25rem] left-0 right-0 z-50 border-t px-2 py-1 lg:hidden">
          <div className="flex min-h-12 items-center gap-2">
            <HouseholdSwitcher variant="mobile" />
            <button
              type="button"
              className="btn btn-ghost min-h-11 px-3 text-amber-100"
              aria-haspopup="dialog"
              aria-expanded={accountOpen}
              onClick={() => setAccountOpen(true)}
            >
              Profile
            </button>
          </div>
        </div>
      ) : null}

      <nav
        className="nav-shell household-bottom-safe fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t px-1 pt-2 lg:hidden"
        aria-label="Primary"
      >
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex min-h-11 flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-xs transition-colors ${
                isActive ? 'text-amber-400' : 'text-amber-100/60'
              }`
            }
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <AccessibleDialog
        open={accountOpen}
        title="Account menu"
        description="Profile and household actions."
        size="bottom"
        onClose={() => setAccountOpen(false)}
      >
        <div className="space-y-2 household-bottom-safe">
          <div className="rounded-xl border border-amber-900/30 p-3">
            <p className="truncate text-sm font-medium text-amber-100">{user?.display_name ?? user?.username ?? 'Kaapi Kadai'}</p>
            <p className="text-xs text-base-content/55">{user?.email ?? 'Username/password account'}</p>
          </div>
          <Link to="/profile" className="btn btn-outline btn-bevel w-full no-underline" onClick={() => setAccountOpen(false)}>
            Open profile
          </Link>
          {activeMembership?.role === 'admin' ? (
            <Link to="/household/settings" className="btn btn-outline btn-bevel w-full no-underline" onClick={() => setAccountOpen(false)}>
              Manage household
            </Link>
          ) : null}
          <Link to="/household/new" className="btn btn-ghost w-full no-underline" onClick={() => setAccountOpen(false)}>
            Create household
          </Link>
          <button
            type="button"
            className="btn btn-ghost w-full text-error"
            onClick={() => {
              setAccountOpen(false)
              logout()
            }}
          >
            Sign out
          </button>
        </div>
      </AccessibleDialog>
    </>
  )
}
