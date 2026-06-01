import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import EditHardwareModal from './EditHardwareModal'
import * as hardwareApi from '../api/hardware'
import type { HardwareItem } from '../types/entities'

function renderModal(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const result = render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
  return { ...result, qc }
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
    renderModal(<EditHardwareModal {...defaultProps} />)
    const nameInput = screen.getByDisplayValue('Rocket Mozzafiato')
    expect(nameInput).toBeInTheDocument()
  })

  it('Save button is disabled when Name field is cleared', () => {
    renderModal(<EditHardwareModal {...defaultProps} />)
    const nameInput = screen.getByDisplayValue('Rocket Mozzafiato')
    fireEvent.change(nameInput, { target: { value: '' } })
    const saveBtn = screen.getByRole('button', { name: /save changes/i })
    expect(saveBtn).toBeDisabled()
  })

  it('calls updateHardware with hardware_id, corrected name, and invalidates list/detail queries on save', async () => {
    const mockUpdated: HardwareItem = {
      hardware_id: 'M01',
      category: 'Machine',
      name: 'Breville Barista Express',
    }
    vi.spyOn(hardwareApi, 'updateHardware').mockResolvedValueOnce(mockUpdated)
    const { qc } = renderModal(<EditHardwareModal {...defaultProps} />)
    const invalidateQueriesSpy = vi.spyOn(qc, 'invalidateQueries').mockResolvedValue(undefined)

    const nameInput = screen.getByDisplayValue('Rocket Mozzafiato')
    fireEvent.change(nameInput, { target: { value: 'Breville Barista Express' } })
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(hardwareApi.updateHardware).toHaveBeenCalledWith('M01', {
        name: 'Breville Barista Express',
        category: 'Machine',
      })
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['hardware'], refetchType: 'inactive' })
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['hardware', 'M01'], refetchType: 'inactive' })
    })

    expect(defaultProps.onSaved).toHaveBeenCalled()
    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('shows error message on API failure without closing modal', async () => {
    vi.spyOn(hardwareApi, 'updateHardware').mockRejectedValueOnce(new Error('Network error'))

    renderModal(<EditHardwareModal {...defaultProps} />)

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(screen.getByText("Couldn't update hardware. Please try again.")).toBeInTheDocument()
    })
    expect(defaultProps.onClose).not.toHaveBeenCalled()
    expect(defaultProps.onSaved).not.toHaveBeenCalled()
  })
})
