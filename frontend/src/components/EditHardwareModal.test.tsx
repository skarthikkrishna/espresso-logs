import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import EditHardwareModal from './EditHardwareModal'
import * as hardwareApi from '../api/hardware'
import type { HardwareItem } from '../types/entities'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

const mockHardware: HardwareItem = {
  hardware_id: 'M01',
  category: 'Machine',
  name: 'Rocket Mozzafiato',
}

const defaultProps = {
  hardware: mockHardware,
  onClose: vi.fn(),
  onSaved: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('EditHardwareModal', () => {
  it('Name field is pre-populated with hardware.name on mount', () => {
    render(<EditHardwareModal {...defaultProps} />, { wrapper })
    const nameInput = screen.getByDisplayValue('Rocket Mozzafiato')
    expect(nameInput).toBeInTheDocument()
  })

  it('Save button is disabled when Name field is cleared', () => {
    render(<EditHardwareModal {...defaultProps} />, { wrapper })
    const nameInput = screen.getByDisplayValue('Rocket Mozzafiato')
    fireEvent.change(nameInput, { target: { value: '' } })
    const saveBtn = screen.getByRole('button', { name: /save changes/i })
    expect(saveBtn).toBeDisabled()
  })

  it('calls updateHardware with hardware_id, corrected name, and category on save', async () => {
    const mockUpdated: HardwareItem = {
      hardware_id: 'M01',
      category: 'Machine',
      name: 'Breville Barista Express',
    }
    vi.spyOn(hardwareApi, 'updateHardware').mockResolvedValueOnce(mockUpdated)

    render(<EditHardwareModal {...defaultProps} />, { wrapper })

    const nameInput = screen.getByDisplayValue('Rocket Mozzafiato')
    fireEvent.change(nameInput, { target: { value: 'Breville Barista Express' } })
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(hardwareApi.updateHardware).toHaveBeenCalledWith('M01', {
        name: 'Breville Barista Express',
        category: 'Machine',
      })
    })
    expect(defaultProps.onSaved).toHaveBeenCalled()
    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('shows error message on API failure without closing modal', async () => {
    vi.spyOn(hardwareApi, 'updateHardware').mockRejectedValueOnce(new Error('Network error'))

    render(<EditHardwareModal {...defaultProps} />, { wrapper })

    // Name is pre-populated so Save is enabled
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(screen.getByText("Couldn't update hardware. Please try again.")).toBeInTheDocument()
    })
    expect(defaultProps.onClose).not.toHaveBeenCalled()
    expect(defaultProps.onSaved).not.toHaveBeenCalled()
  })
})
