import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import type { HouseholdBackgroundToken } from '../utils/householdBackgrounds'
import { getStandaloneBackgroundToken } from '../utils/householdBackgrounds'

interface StandaloneHouseholdShellProps {
  children: ReactNode
  background?: HouseholdBackgroundToken
  align?: 'center' | 'left' | 'right' | 'wide'
  labelledBy?: string
}

export default function StandaloneHouseholdShell({
  children,
  background,
  align = 'center',
  labelledBy,
}: StandaloneHouseholdShellProps) {
  const location = useLocation()
  const bgClass = background ?? getStandaloneBackgroundToken(location.pathname)

  return (
    <div className="standalone-household-shell min-h-screen" style={{ isolation: 'isolate' }}>
      <div className={`app-bg ${bgClass}`} aria-hidden="true" />
      <main className={`standalone-household-main standalone-household-main--${align}`} aria-labelledby={labelledBy}>
        {children}
      </main>
    </div>
  )
}
