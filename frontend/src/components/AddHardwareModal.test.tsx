import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AddHardwareModal from './AddHardwareModal'
import * as hardwareApi from '../api/hardware'

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ activeHouseholdId: 'hh-1' }),
  useHouseholdQueryScope: () => 'hh-1',
}))

function renderModal(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const result = render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
  return { ...result, qc }
}

const defaultProps = {
  onClose: vi.fn(),
  onSaved: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AddHardwareModal', () => {
  it('renders with no pre-selected category when initialCategory is undefined', () => {
    renderModal(<AddHardwareModal {...defaultProps} />)
    const select = screen.getByRole('combobox')
    expect((select as HTMLSelectElement).value).toBe('')
  })

  it('renders with Category dropdown pre-selected to Grinder when initialCategory="Grinder"', () => {
    renderModal(<AddHardwareModal {...defaultProps} initialCategory="Grinder" />)
    const select = screen.getByRole('combobox')
    expect((select as HTMLSelectElement).value).toBe('Grinder')
  })

  it('Save button is disabled when Name field is empty', () => {
    renderModal(<AddHardwareModal {...defaultProps} initialCategory="Machine" />)
    const saveBtn = screen.getByRole('button', { name: /save hardware/i })
    expect(saveBtn).toBeDisabled()
  })

  it('Save button is disabled when Category is not selected', () => {
    renderModal(<AddHardwareModal {...defaultProps} />)
    const nameInput = screen.getByPlaceholderText(/breville barista express/i)
    fireEvent.change(nameInput, { target: { value: 'Some Machine' } })
    const saveBtn = screen.getByRole('button', { name: /save hardware/i })
    expect(saveBtn).toBeDisabled()
  })

  it('calls createHardware with correct payload and invalidates hardware on successful save', async () => {
    const mockItem = { hardware_id: 'G01', category: 'Grinder' as const, name: 'Niche Zero' }
    vi.spyOn(hardwareApi, 'createHardware').mockResolvedValueOnce(mockItem)
    const { qc } = renderModal(<AddHardwareModal {...defaultProps} initialCategory="Grinder" />)
    const invalidateQueriesSpy = vi.spyOn(qc, 'invalidateQueries').mockResolvedValue(undefined)

    const nameInput = screen.getByPlaceholderText(/breville barista express/i)
    fireEvent.change(nameInput, { target: { value: 'Niche Zero' } })

    const urlInput = screen.getByPlaceholderText('https://…')
    fireEvent.change(urlInput, { target: { value: 'https://nichecoffee.co.uk' } })

    fireEvent.click(screen.getByRole('button', { name: /save hardware/i }))

    await waitFor(() => {
      expect(hardwareApi.createHardware).toHaveBeenCalledWith({
        category: 'Grinder',
        name: 'Niche Zero',
        product_url: 'https://nichecoffee.co.uk',
      })
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['households', 'hh-1', 'hardware'], refetchType: 'inactive' })
    })

    expect(defaultProps.onSaved).toHaveBeenCalledWith('G01')
  })

  it('shows error message on API failure without closing modal', async () => {
    vi.spyOn(hardwareApi, 'createHardware').mockRejectedValueOnce(new Error('Network error'))

    renderModal(<AddHardwareModal {...defaultProps} initialCategory="Basket" />)

    const nameInput = screen.getByPlaceholderText(/breville barista express/i)
    fireEvent.change(nameInput, { target: { value: 'IMS 20g' } })
    fireEvent.click(screen.getByRole('button', { name: /save hardware/i }))

    await waitFor(() => {
      expect(screen.getByText("Couldn't save hardware. Please try again.")).toBeInTheDocument()
    })
    expect(defaultProps.onClose).not.toHaveBeenCalled()
    expect(defaultProps.onSaved).not.toHaveBeenCalled()
  })

  it('closes modal (calls onClose) on Cancel button click', () => {
    renderModal(<AddHardwareModal {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
  })
})
