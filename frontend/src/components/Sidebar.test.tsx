/**
 * T007 — Sidebar: the Kaapi Kadai brand appears exactly once on desktop.
 *
 * Part of the shell-normalization contract (brand once, household once per hierarchy,
 * h1 once per view). With a single membership the desktop HouseholdSwitcher collapses
 * to nothing, so the only brand surface is the sidebar wordmark + mark.
 */

import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import Sidebar from './Sidebar'
import type { Membership } from '../types/entities'

const memberships: Membership[] = [
  { household_id: 'h1', household_name: 'Home', role: 'admin', joined_at: '2024-01-01', member_count: 2 },
]

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { username: 'sam', display_name: 'Sam Roaster', email: 'sam@example.com', picture_url: null },
    memberships,
    activeHouseholdId: 'h1',
    activeMembership: memberships[0],
    switchHousehold: vi.fn(),
  }),
}))

describe('Sidebar — brand appears once on desktop', () => {
  it('renders exactly one brand mark and one brand wordmark', () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    )
    const wordmarks = screen.getAllByLabelText('Kaapi Kadai')
    expect(screen.getAllByTestId('brand-mark')).toHaveLength(1)
    expect(wordmarks).toHaveLength(1)
    expect(wordmarks[0].querySelector('.kk-sidebar-wordmark__kaapi')).toHaveTextContent('Kaapi')
    expect(wordmarks[0].querySelector('.kk-sidebar-wordmark__kadai')).toHaveTextContent('Kadai')
    expect(wordmarks[0].querySelector('svg')).toBeInTheDocument()
    expect(wordmarks[0].querySelector('img')).toBeNull()
  })
})
