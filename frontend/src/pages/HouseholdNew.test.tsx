/**
 * HouseholdNew creation-form tests.
 *
 * FR4: household creation on the tone system; breaks: an authenticated user with
 * no household can't name and create one (validation, 409 dup, offline, success nav).
 * D11 / NFR3: the single TakeoverCard is the data-tone emitter locked to dark;
 * breaks: a beige-persisted user gets a beige card on the dark onboarding background.
 */

import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AxiosError } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockNavigate = vi.hoisted(() => vi.fn())
const mockUseAuth = vi.hoisted(() => vi.fn())
const mockApiPost = vi.hoisted(() => vi.fn())
const mockGetMe = vi.hoisted(() => vi.fn())
const mockSetUser = vi.hoisted(() => vi.fn())

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../contexts/AuthContext', () => ({
  useAuth: mockUseAuth,
}))

vi.mock('../api/client', () => ({
  apiClient: {
    post: mockApiPost,
  },
}))

vi.mock('../api/auth', () => ({
  getMe: mockGetMe,
}))

import HouseholdNew from './HouseholdNew'

function renderHouseholdNew() {
  return render(
    <MemoryRouter initialEntries={['/household/new']}>
      <Routes>
        <Route path="/household/new" element={<HouseholdNew />} />
        <Route path="/" element={<div data-testid="dashboard-page">dashboard page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

function axiosErrorWithStatus(status: number): AxiosError {
  const err = new AxiosError('request failed')
  err.response = { status, data: {}, statusText: '', headers: {}, config: {} as never }
  return err
}

function axiosNetworkError(): AxiosError {
  return new AxiosError('Network Error')
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue({ setUser: mockSetUser })
})

describe('HouseholdNew creation form', () => {
  it('renders the create-household form', () => {
    renderHouseholdNew()

    expect(screen.getByRole('heading', { name: 'Create a household' })).toBeInTheDocument()
    expect(screen.getByLabelText('Household name')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create household' })).toBeInTheDocument()
  })

  // D11 / NFR3: standalone pages lock to dark regardless of persisted tone.
  it('locks the takeover card to dark tone', () => {
    const { container } = renderHouseholdNew()
    const card = container.querySelector('.kk-takeover-card')
    expect(card).not.toBeNull()
    expect(card?.getAttribute('data-tone')).toBe('dark')
  })

  it('empty name shows validation error and does not submit', async () => {
    renderHouseholdNew()

    fireEvent.click(screen.getByRole('button', { name: 'Create household' }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Household name is required'),
    )
    expect(mockApiPost).not.toHaveBeenCalled()
  })

  it('name over 64 chars shows validation error and does not submit', async () => {
    renderHouseholdNew()

    fireEvent.change(screen.getByLabelText('Household name'), { target: { value: 'a'.repeat(65) } })
    fireEvent.click(screen.getByRole('button', { name: 'Create household' }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Name must be 64 characters or less'),
    )
    expect(mockApiPost).not.toHaveBeenCalled()
  })

  it('valid name creates household, refreshes auth, and navigates to dashboard', async () => {
    mockApiPost.mockResolvedValueOnce({ data: { id: 'hh-9' } })
    mockGetMe.mockResolvedValueOnce({ id: 'user-1', memberships: [] })

    renderHouseholdNew()

    fireEvent.change(screen.getByLabelText('Household name'), { target: { value: 'Home' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create household' }))

    await waitFor(() => expect(mockApiPost).toHaveBeenCalledWith('/households', { name: 'Home' }))
    expect(mockGetMe).toHaveBeenCalled()
    expect(mockSetUser).toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true })
  })

  it('409 duplicate name surfaces a field error and does not navigate', async () => {
    mockApiPost.mockRejectedValueOnce(axiosErrorWithStatus(409))

    renderHouseholdNew()

    fireEvent.change(screen.getByLabelText('Household name'), { target: { value: 'Home' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create household' }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'A household with this name already exists.',
      ),
    )
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('network error surfaces the offline message', async () => {
    mockApiPost.mockRejectedValueOnce(axiosNetworkError())

    renderHouseholdNew()

    fireEvent.change(screen.getByLabelText('Household name'), { target: { value: 'Home' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create household' }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Unable to connect. Please check your connection.',
      ),
    )
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('cancel navigates back', () => {
    renderHouseholdNew()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(mockNavigate).toHaveBeenCalledWith(-1)
  })
})
