import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import LogMaintenanceModal from './LogMaintenanceModal'
import * as hardwareApi from '../api/hardware'
import * as maintenanceApi from '../api/maintenance'
import type { HardwareItem } from '../types/entities'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

const mockActionTypes = {
  action_types: {
    Machine: ['Backflush', 'Descale', 'Steam Wand Clean'],
    Grinder: ['Re-zero'],
    Basket: [],
    Storage: [],
  },
}

const machineHardware: HardwareItem = {
  hardware_id: 'M01',
  category: 'Machine',
  name: 'Rocket Mozzafiato',
}

const grinderHardware: HardwareItem = {
  hardware_id: 'G01',
  category: 'Grinder',
  name: 'Niche Zero',
}

const defaultProps = {
  hardware: machineHardware,
  onClose: vi.fn(),
  onSaved: vi.fn(),
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(hardwareApi, 'getActionTypes').mockResolvedValue(mockActionTypes)
})

describe('LogMaintenanceModal', () => {
  it('renders hardware name as a read-only label (not in an input)', async () => {
    render(<LogMaintenanceModal {...defaultProps} />, { wrapper })
    await waitFor(() => {
      expect(screen.getByText('Rocket Mozzafiato')).toBeInTheDocument()
    })
    // The name must NOT be in an input element
    const inputs = screen.queryAllByDisplayValue('Rocket Mozzafiato')
    expect(inputs).toHaveLength(0)
  })

  it('action type dropdown shows only Machine options for Machine hardware', async () => {
    render(<LogMaintenanceModal {...defaultProps} />, { wrapper })
    await waitFor(() => {
      expect(screen.getByText('Backflush')).toBeInTheDocument()
      expect(screen.getByText('Descale')).toBeInTheDocument()
      expect(screen.getByText('Steam Wand Clean')).toBeInTheDocument()
    })
    expect(screen.queryByText('Re-zero')).not.toBeInTheDocument()
  })

  it('action type dropdown shows only Grinder options for Grinder hardware', async () => {
    render(<LogMaintenanceModal {...defaultProps} hardware={grinderHardware} />, { wrapper })
    await waitFor(() => {
      expect(screen.getByText('Re-zero')).toBeInTheDocument()
    })
    expect(screen.queryByText('Backflush')).not.toBeInTheDocument()
    expect(screen.queryByText('Descale')).not.toBeInTheDocument()
  })

  it('Save button is disabled when no action type is selected', async () => {
    render(<LogMaintenanceModal {...defaultProps} />, { wrapper })
    await waitFor(() => {
      expect(screen.getByText('Backflush')).toBeInTheDocument()
    })
    const saveBtn = screen.getByRole('button', { name: /^save$/i })
    expect(saveBtn).toBeDisabled()
  })

  it('future date input disables Save and shows the future-date warning message', async () => {
    render(<LogMaintenanceModal {...defaultProps} />, { wrapper })
    await waitFor(() => {
      expect(screen.getByText('Backflush')).toBeInTheDocument()
    })

    // Select an action type first
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'Backflush' } })

    // Set a future date (year 9999)
    const dateInput = screen.getByDisplayValue(new Date().toISOString().split('T')[0])
    fireEvent.change(dateInput, { target: { value: '9999-12-31' } })

    expect(screen.getByText(/date cannot be in the future/i)).toBeInTheDocument()
    const saveBtn = screen.getByRole('button', { name: /^save$/i })
    expect(saveBtn).toBeDisabled()
  })

  it('past date input is accepted with no validation error', async () => {
    render(<LogMaintenanceModal {...defaultProps} />, { wrapper })
    await waitFor(() => {
      expect(screen.getByText('Backflush')).toBeInTheDocument()
    })

    const dateInput = screen.getByDisplayValue(new Date().toISOString().split('T')[0])
    fireEvent.change(dateInput, { target: { value: '2024-01-01' } })

    expect(screen.queryByText(/date cannot be in the future/i)).not.toBeInTheDocument()
  })

  it('shows loading spinner while getActionTypes is in-flight; dropdown is absent', () => {
    // Use a promise that never resolves to keep loading state
    vi.spyOn(hardwareApi, 'getActionTypes').mockReturnValue(new Promise(() => {}))

    render(<LogMaintenanceModal {...defaultProps} />, { wrapper })

    expect(screen.getByText(/loading action types/i)).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('shows error message and Save is disabled when getActionTypes fails', async () => {
    vi.spyOn(hardwareApi, 'getActionTypes').mockRejectedValue(new Error('API error'))

    render(<LogMaintenanceModal {...defaultProps} />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText(/couldn't load action types/i)).toBeInTheDocument()
    })
    const saveBtn = screen.getByRole('button', { name: /^save$/i })
    expect(saveBtn).toBeDisabled()
  })

  it('calls createMaintenance and onSaved on successful save', async () => {
    const mockEvent = {
      maintenance_id: 'MAINT01',
      hardware_id: 'M01',
      hardware_name: 'Rocket Mozzafiato',
      date: '2024-06-01',
      action_type: 'Backflush',
    }
    vi.spyOn(maintenanceApi, 'createMaintenance').mockResolvedValueOnce(mockEvent)

    render(<LogMaintenanceModal {...defaultProps} />, { wrapper })
    await waitFor(() => {
      expect(screen.getByText('Backflush')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Backflush' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(maintenanceApi.createMaintenance).toHaveBeenCalled()
      expect(defaultProps.onSaved).toHaveBeenCalled()
    })
  })
})
