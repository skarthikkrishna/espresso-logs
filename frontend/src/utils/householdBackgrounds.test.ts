import { describe, expect, it } from 'vitest'
import { getAppShellBackgroundToken, getStandaloneBackgroundToken } from './householdBackgrounds'

describe('household background route map', () => {
  it('maps app shell household routes to approved Spec-040 tokens', () => {
    expect(getAppShellBackgroundToken('/profile')).toBe('bg-profile-household')
    expect(getAppShellBackgroundToken('/household/settings')).toBe('bg-household-settings')
    expect(getAppShellBackgroundToken('/brew-log')).toBe('bg-brew-log')
  })

  it('maps standalone auth, invite, and guest routes to approved tokens', () => {
    expect(getStandaloneBackgroundToken('/login')).toBe('bg-auth-login')
    expect(getStandaloneBackgroundToken('/register')).toBe('bg-auth-register')
    expect(getStandaloneBackgroundToken('/invite/accept')).toBe('bg-invite-accept')
    expect(getStandaloneBackgroundToken('/invite/expired')).toBe('bg-invite-recovery')
    expect(getStandaloneBackgroundToken('/households/household-id/view')).toBe('bg-guest')
  })
})
