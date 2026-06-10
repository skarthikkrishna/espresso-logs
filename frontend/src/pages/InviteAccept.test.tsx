import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import InviteAccept from './InviteAccept'
import { declineInvitation, getInvitationPreview } from '../api/invitations'

const mockNavigate = vi.hoisted(() => vi.fn())

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../api/invitations', () => ({
  getInvitationPreview: vi.fn(),
  acceptInvitation: vi.fn(),
  declineInvitation: vi.fn(),
}))

vi.mock('../api/auth', () => ({
  getMe: vi.fn(),
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    setUser: vi.fn(),
    isAuthenticated: true,
    isLoading: false,
  }),
}))

describe('InviteAccept', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getInvitationPreview).mockResolvedValue({
      household_name: 'Home Espresso Bar',
      inviter_display_name: 'Krishna',
      invited_role: 'member',
      expires_at: '2026-06-12T00:00:00Z',
      status: 'pending',
    })
    vi.mocked(declineInvitation).mockResolvedValue(undefined)
  })

  it('previews an invitation and declines without rendering the raw token', async () => {
    render(
      <MemoryRouter initialEntries={["/invite/accept?token=invite-secret-token"]}>
        <InviteAccept />
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByRole('heading', { name: /join home espresso bar/i })).toBeInTheDocument())
    expect(screen.queryByText(/invite-secret-token/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /decline without accepting/i }))
    await waitFor(() => expect(declineInvitation).toHaveBeenCalledWith('invite-secret-token'))
    expect(screen.getByText(/link was not consumed/i)).toBeInTheDocument()
  })
})
