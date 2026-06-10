import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import HouseholdSettings from './HouseholdSettings'
import { createInvitation, getHousehold, renameHousehold } from '../api/households'

vi.mock('../api/households', () => ({
  getHousehold: vi.fn(),
  renameHousehold: vi.fn(),
  updateMemberRole: vi.fn(),
  removeMember: vi.fn(),
  createInvitation: vi.fn(),
  revokeInvitation: vi.fn(),
  resendInvitation: vi.fn(),
  generateGuestToken: vi.fn(),
  revokeGuestToken: vi.fn(),
  deleteHousehold: vi.fn(),
}))

vi.mock('../api/auth', () => ({
  getMe: vi.fn(),
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    activeHouseholdId: 'hh-1',
    activeMembership: { household_id: 'hh-1', household_name: 'Home', role: 'admin', joined_at: '' },
    user: { id: 'user-1' },
    setUser: vi.fn(),
  }),
}))

function renderSettings() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <HouseholdSettings />
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

describe('HouseholdSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getHousehold).mockResolvedValue({
      id: 'hh-1',
      name: 'Home',
      created_at: '2026-06-01T00:00:00Z',
      role: 'admin',
      member_count: 1,
      member_limit: { current: 1, max: 10, can_invite: true },
      members: [{ user_id: 'user-1', username: 'alice', display_name: 'Alice', email: null, picture_url: null, role: 'admin', joined_at: '2026-06-01T00:00:00Z', is_self: true }],
      pending_invitations: [],
      guest_access: { is_active: false, guest_url: null, created_at: null, revoked_at: null, can_copy: false },
      permissions: { can_rename: true, can_delete: true, can_manage_members: true, can_manage_invites: true, can_manage_guest_access: true },
    })
    vi.mocked(renameHousehold).mockResolvedValue({ id: 'hh-1', name: 'Home Bar', created_at: '2026-06-01T00:00:00Z', role: 'admin' })
    vi.mocked(createInvitation).mockResolvedValue({
      invitation_id: 'invite-internal-id',
      invite_url: 'http://localhost/invite/accept?token=safe-test-token',
      expires_at: '2026-06-12T00:00:00Z',
      invited_email: null,
      invited_role: 'member',
      status: 'pending',
      delivery: { email_configured: false, email_attempted: false, email_sent: false },
    })
  })

  it('wires rename and link-only invitation creation without TODO placeholders', async () => {
    renderSettings()

    await waitFor(() => expect(screen.getByRole('heading', { name: /household settings/i })).toBeInTheDocument())
    expect(screen.queryByText(/TODO|placeholder|will be available/i)).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/household name/i), { target: { value: 'Home Bar' } })
    fireEvent.click(screen.getByRole('button', { name: /save name/i }))
    await waitFor(() => expect(renameHousehold).toHaveBeenCalledWith('hh-1', 'Home Bar'))

    fireEvent.click(screen.getByRole('button', { name: /create invite/i }))
    await waitFor(() => expect(createInvitation).toHaveBeenCalledWith({ invited_email: null, invited_role: 'member' }))
    expect(screen.getByText(/latest invitation link/i)).toBeInTheDocument()
  })
})
