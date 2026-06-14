/**
 * spec-043 T014 — HardwarePage behavior tests.
 *
 * Verifies the Wave-2b migration's load-bearing behavior (Rule 9 — intent, not presence):
 *   1. Browse grid groups items into the four categories.
 *   2. Selecting an item opens a DISTINCT detail layer (grid unmounted, not stacked below).
 *   3. In-page Back returns to the grid.
 *   4. Image upload calls the existing endpoint client and surfaces success state.
 *   5. Image upload failure surfaces a loud error state.
 */
import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../api/hardware', () => ({
  listHardware: vi.fn(),
  getHardwareDetail: vi.fn(),
  uploadHardwareImage: vi.fn(),
}))

vi.mock('../components/AddHardwareModal', () => ({ default: () => null }))
vi.mock('../components/EditHardwareModal', () => ({ default: () => null }))
vi.mock('../components/LogMaintenanceModal', () => ({ default: () => null }))
vi.mock('../components/LoadingSpinner', () => ({ default: () => null }))

import { getHardwareDetail, listHardware, uploadHardwareImage } from '../api/hardware'
import type { HardwareItem } from '../types/entities'
import HardwarePage from './HardwarePage'

const HARDWARE: HardwareItem[] = [
  { hardware_id: 'HW1', category: 'Machine', name: 'Lever Machine One' },
  { hardware_id: 'HW2', category: 'Grinder', name: 'Single Dose Grinder' },
  { hardware_id: 'HW3', category: 'Basket', name: 'Precision Basket 18g' },
  { hardware_id: 'HW4', category: 'Storage', name: 'Airtight Canister' },
]

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <MemoryRouter initialEntries={['/hardware']}>
      <QueryClientProvider client={queryClient}>
        <HardwarePage />
      </QueryClientProvider>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listHardware).mockResolvedValue(HARDWARE)
  vi.mocked(getHardwareDetail).mockImplementation((id: string) =>
    Promise.resolve({ item: HARDWARE.find((h) => h.hardware_id === id)!, maintenance: [] }),
  )
})

describe('HardwarePage — browse grid', () => {
  it('groups items into the four hardware categories', async () => {
    renderPage()
    const sections = await screen.findAllByTestId('hardware-category-section')
    expect(sections).toHaveLength(4)
    for (const label of ['Machine', 'Grinder', 'Basket', 'Storage']) {
      expect(screen.getByRole('heading', { name: label })).toBeInTheDocument()
    }
  })
})

describe('HardwarePage — distinct detail layer', () => {
  it('opens a distinct detail layer and unmounts the grid on select', async () => {
    renderPage()
    const cards = await screen.findAllByTestId('hardware-card')
    fireEvent.click(cards[0])

    await waitFor(() => {
      expect(screen.getByTestId('hardware-detail-panel')).toBeInTheDocument()
    })
    // Distinct layer — the browse grid is gone, not stacked underneath.
    expect(screen.queryByTestId('hardware-grid')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Lever Machine One' })).toBeInTheDocument()
  })

  it('returns to the grid from the in-page Back control', async () => {
    renderPage()
    fireEvent.click((await screen.findAllByTestId('hardware-card'))[0])

    const back = await screen.findByTestId('hardware-back-to-grid')
    fireEvent.click(back)

    await waitFor(() => {
      expect(screen.getByTestId('hardware-grid')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('hardware-detail-panel')).not.toBeInTheDocument()
  })
})

describe('HardwarePage — image upload', () => {
  it('uploads via the existing endpoint client and shows a success state', async () => {
    vi.mocked(uploadHardwareImage).mockResolvedValue({ image_path: 'https://example.test/hw1.jpg' })
    renderPage()
    fireEvent.click((await screen.findAllByTestId('hardware-card'))[0])

    const input = await screen.findByTestId('hardware-image-input')
    const file = new File([new Uint8Array([1, 2, 3])], 'machine.jpg', { type: 'image/jpeg' })
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(uploadHardwareImage).toHaveBeenCalledWith('HW1', file)
    })
    expect(await screen.findByTestId('hardware-image-success')).toBeInTheDocument()
  })

  it('surfaces a loud error state when the upload fails', async () => {
    vi.mocked(uploadHardwareImage).mockRejectedValue(new Error('network'))
    renderPage()
    fireEvent.click((await screen.findAllByTestId('hardware-card'))[0])

    const input = await screen.findByTestId('hardware-image-input')
    const file = new File([new Uint8Array([1, 2, 3])], 'machine.jpg', { type: 'image/jpeg' })
    fireEvent.change(input, { target: { files: [file] } })

    expect(await screen.findByTestId('hardware-image-error')).toBeInTheDocument()
  })
})
