export type HouseholdBackgroundToken =
  | 'bg-auth-login'
  | 'bg-auth-register'
  | 'bg-household-onboarding'
  | 'bg-invite'
  | 'bg-invite-accept'
  | 'bg-invite-recovery'
  | 'bg-guest'
  | 'bg-profile-household'
  | 'bg-household-settings'
  | 'bg-household-transition'
  | 'bg-state-empty'
  | 'bg-state-error'
  | 'bg-state-error-empty'

export function getAppShellBackgroundToken(pathname: string): string {
  if (pathname === '/') return 'bg-dashboard'
  if (pathname.startsWith('/brew-log')) return 'bg-brew-log'
  if (pathname.startsWith('/catalog')) return 'bg-catalog'
  if (pathname.startsWith('/hardware')) return 'bg-hardware'
  if (pathname.startsWith('/profile')) return 'bg-profile-household'
  if (pathname.startsWith('/household/settings')) return 'bg-household-settings'
  if (pathname.startsWith('/household/new')) return 'bg-household-onboarding'
  return 'bg-household-transition'
}

export function getStandaloneBackgroundToken(pathname: string): HouseholdBackgroundToken {
  if (pathname.startsWith('/login')) return 'bg-auth-login'
  if (pathname.startsWith('/register')) return 'bg-auth-register'
  if (pathname.startsWith('/welcome') || pathname.startsWith('/household/new')) return 'bg-household-onboarding'
  if (pathname.startsWith('/invite/expired') || pathname.startsWith('/invite/invalid')) return 'bg-invite-recovery'
  if (pathname.startsWith('/invite/accept')) return 'bg-invite-accept'
  if (pathname.includes('/view')) return 'bg-guest'
  return 'bg-state-empty'
}
