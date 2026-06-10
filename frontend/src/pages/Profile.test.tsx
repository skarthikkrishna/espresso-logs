import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import Profile from './Profile'

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      username: 'alice',
      display_name: 'Alice Example',
      email: null,
      picture_url: null,
      created_at: '2026-01-01T00:00:00Z',
    },
    memberships: [
      {
        household_id: 'hh-1',
        household_name: 'Home Espresso Bar',
        role: 'admin',
        joined_at: '2026-01-02T00:00:00Z',
        member_count: 3,
        can_manage: true,
      },
    ],
    activeHouseholdId: 'hh-1',
    switchHousehold: vi.fn(),
    logout: vi.fn(),
  }),
}))

describe('Profile', () => {
  it('shows household counts and admin-assisted reset note without self-serve password fields', () => {
    render(<MemoryRouter><Profile /></MemoryRouter>)

    expect(screen.getByText('Home Espresso Bar')).toBeInTheDocument()
    expect(screen.getByText(/3 members/i)).toBeInTheDocument()
    expect(screen.getByText(/Password resets are admin-assisted/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/current password/i)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /create household/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /current/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
  })
})
