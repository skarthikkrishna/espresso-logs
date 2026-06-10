import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import HouseholdGuestView from './HouseholdGuestView'
import { getGuestHouseholdView } from '../api/guest'

vi.mock('../api/guest', () => ({
  getGuestHouseholdView: vi.fn(),
}))

describe('HouseholdGuestView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getGuestHouseholdView).mockResolvedValue({
      household: { name: 'Home Espresso Bar' },
      banner: "You're viewing Home Espresso Bar as a guest. Sign in or create an account to log shots.",
      dashboard: {
        active_bags: [{
          display_name: 'Roaster — Bean',
          beans: 'Roaster — Bean',
          roast_level: 'Light',
          status: 'Active',
          storage_method: 'Frozen',
        }],
        recent_shots: [{
          date: '2026-06-01',
          bag_display: 'Roaster — Bean',
          roast_level: 'Light',
          machine_name: 'Bambino Plus',
          grinder_name: 'Niche Zero',
          basket_name: 'IMS 18g',
          storage_method: 'Frozen',
          dose_in_g: 18,
          yield_out_g: 36,
          time_sec: 28,
          shot_eligibility: 'Dialing In',
          taste_summary: 'Bright citrus',
        }],
        stats: { active_bags: 1 },
      },
      brew_log: { entries: [], pagination: { page: 1, per_page: 25, total: 0 } },
      catalog: {
        beans: [{
          roaster: 'Sample Roaster',
          bean_name: 'House Blend',
          roast_level: 'Medium',
          image_path: null,
        }],
        compass_summary: {},
      },
      capabilities: { can_write: false },
    })
  })

  it('renders read-only guest data without visible route IDs or guest keys', async () => {
    render(
      <MemoryRouter initialEntries={["/households/11111111-1111-4111-8111-111111111111/view?key=guest-secret-key"]}>
        <Routes>
          <Route path="/households/:householdId/view" element={<HouseholdGuestView />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByRole('heading', { name: /home espresso bar/i })).toBeInTheDocument())
    expect(screen.getByText(/read-only household view/i)).toBeInTheDocument()
    expect(screen.queryByText(/guest-secret-key/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/11111111-1111-4111-8111-111111111111/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /add shot/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /settings/i })).not.toBeInTheDocument()
    expect(screen.getAllByText('Roaster — Bean')).toHaveLength(2)
    expect(screen.getByText('Bright citrus')).toBeInTheDocument()
    expect(screen.getByText('Sample Roaster')).toBeInTheDocument()
  })
})
