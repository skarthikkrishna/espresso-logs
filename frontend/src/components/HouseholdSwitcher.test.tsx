/**
 * T007 — HouseholdSwitcher: long household names truncate accessibly.
 *
 * The switcher previously JS-sliced the active household name, cutting the DOM text
 * from assistive tech. T007 normalizes this: the FULL name is rendered (so the
 * accessible name and `title` carry it in full) while CSS `.truncate` handles the
 * visual clamp — matching how the popover options already render.
 */

import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import HouseholdSwitcher from './HouseholdSwitcher'
import type { Membership } from '../types/entities'

const longName = 'The Extremely Long Household Name That Overflows The Sidebar Switcher'

const memberships: Membership[] = [
  { household_id: 'h1', household_name: longName, role: 'admin', joined_at: '2024-01-01', member_count: 3 },
  { household_id: 'h2', household_name: 'Second Home', role: 'member', joined_at: '2024-01-01', member_count: 2 },
]

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    memberships,
    activeHouseholdId: 'h1',
    activeMembership: memberships[0],
    switchHousehold: vi.fn(),
  }),
}))

describe('HouseholdSwitcher — accessible truncation', () => {
  it('renders the full household name and exposes it via title (visual clamp only)', () => {
    render(<HouseholdSwitcher variant="desktop" />)
    // Full name present in the DOM → accessible to assistive tech (not JS-sliced).
    const name = screen.getByText(longName)
    expect(name).toBeInTheDocument()
    // Visual truncation is CSS-only.
    expect(name).toHaveClass('truncate')
    // The trigger carries the full name as a hover affordance for sighted users.
    expect(screen.getByRole('button')).toHaveAttribute('title', longName)
  })
})
