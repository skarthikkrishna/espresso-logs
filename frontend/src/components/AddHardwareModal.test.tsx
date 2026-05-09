import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AddHardwareModal from './AddHardwareModal'
import * as hardwareApi from '../api/hardware'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
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
    render(<AddHardwareModal {...defaultProps} />, { wrapper })
    const select = screen.getByRole('combobox')
    expect((select as HTMLSelectElement).value).toBe('')
  })

  it('renders with Category dropdown pre-selected to Grinder when initialCategory="Grinder"', () => {
    render(<AddHardwareModal {...defaultProps} initialCategory="Grinder" />, { wrapper })
    const select = screen.getByRole('combobox')
    expect((select as HTMLSelectElement).value).toBe('Grinder')
  })

  it('Save button is disabled when Name field is empty', () => {
    render(<AddHardwareModal {...defaultProps} initialCategory="Machine" />, { wrapper })
    const saveBtn = screen.getByRole('button', { name: /save hardware/i })
    expect(saveBtn).toBeDisabled()
  })

  it('Save button is disabled when Category is not selected', () => {
    render(<AddHardwareModal {...defaultProps} />, { wrapper })
    const nameInput = screen.getByPlaceholderText(/breville barista express/i)
    fireEvent.change(nameInput, { target: { value: 'Some Machine' } })
    const saveBtn = screen.getByRole('button', { name: /save hardware/i })
    expect(saveBtn).toBeDisabled()
  })

  it('calls createHardware with correct payload on successful save', async () => {
    const mockItem = { hardware_id: 'G01', category: 'Grinder' as const, name: 'Niche Zero' }
    vi.spyOn(hardwareApi, 'createHardware').mockResolvedValueOnce(mockItem)

    render(<AddHardwareModal {...defaultProps} initialCategory="Grinder" />, { wrapper })

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
    })
    expect(defaultProps.onSaved).toHaveBeenCalledWith('G01')
  })

  it('shows error message on API failure without closing modal', async () => {
    vi.spyOn(hardwareApi, 'createHardware').mockRejectedValueOnce(new Error('Network error'))

    render(<AddHardwareModal {...defaultProps} initialCategory="Basket" />, { wrapper })

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
    render(<AddHardwareModal {...defaultProps} />, { wrapper })
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
  })
})
