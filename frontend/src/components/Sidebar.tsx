import { NavLink } from 'react-router-dom'
import HouseholdSwitcher from './HouseholdSwitcher'
import { useAuth } from '../contexts/AuthContext'

interface NavItem {
  path: string
  label: string
  icon: React.ReactNode
}

const IconHome = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
)

const IconBrewLog = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 3h4v6l6 12H4L10 9V3z" />
    <circle cx="9" cy="15" r="0.5" fill="currentColor" stroke="none" />
    <circle cx="14" cy="17" r="0.5" fill="currentColor" stroke="none" />
  </svg>
)

const IconCatalog = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  </svg>
)

const IconHardware = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

const IconImport = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
)

const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Home', icon: <IconHome /> },
  { path: '/brew-log', label: 'Brew log', icon: <IconBrewLog /> },
  { path: '/catalog', label: 'Catalog', icon: <IconCatalog /> },
  { path: '/hardware', label: 'Hardware', icon: <IconHardware /> },
  { path: '/import', label: 'Import', icon: <IconImport /> },
]

const monogramFor = (name: string): string =>
  name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'CT'

export default function Sidebar() {
  const { user } = useAuth()
  const displayName = user?.display_name ?? user?.username ?? 'Profile'

  return (
    <aside
      data-testid="sidebar"
      className="nav-shell hidden h-full w-64 shrink-0 flex-col border-r lg:flex"
    >
      <div className="flex items-center gap-3 px-6 py-6">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 shrink-0 text-amber-400" aria-hidden="true">
          <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
          <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
          <line x1="6" y1="1" x2="6" y2="4" />
          <line x1="10" y1="1" x2="10" y2="4" />
          <line x1="14" y1="1" x2="14" y2="4" />
        </svg>
        <span className="text-xl font-display font-bold text-amber-400">Coffee Tracker</span>
      </div>

      <HouseholdSwitcher variant="desktop" />

      <nav className="flex-1 space-y-1 px-3" aria-label="Primary">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${
                isActive
                  ? 'border border-amber-600/30 bg-amber-600/20 text-amber-400'
                  : 'text-amber-100/70 hover:bg-amber-900/30 hover:text-amber-200'
              }`
            }
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <NavLink
        to="/profile"
        className={({ isActive }) =>
          `m-3 flex min-h-16 items-center gap-3 rounded-xl border border-amber-900/30 px-3 py-3 no-underline transition-colors ${
            isActive ? 'bg-amber-600/20 text-amber-100' : 'text-amber-100/75 hover:bg-amber-900/25 hover:text-amber-100'
          }`
        }
      >
        {user?.picture_url ? (
          <img src={user.picture_url} alt="" className="h-10 w-10 rounded-full object-cover" />
        ) : (
          <span className="grid h-10 w-10 place-items-center rounded-full bg-amber-500/20 text-sm font-semibold text-amber-200" aria-hidden="true">
            {monogramFor(displayName)}
          </span>
        )}
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{displayName}</span>
          <span className="block text-xs text-base-content/50">Profile</span>
        </span>
      </NavLink>
    </aside>
  )
}
