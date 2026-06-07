import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../api/catalog', () => ({
  inferCatalogItem: vi.fn(),
  createCatalogItem: vi.fn(),
  uploadCatalogImage: vi.fn(),
}))

import { createCatalogItem, uploadCatalogImage } from '../api/catalog'
import type { CatalogItem } from '../types/entities'
import AddBeanModal from './AddBeanModal'

const savedBean: CatalogItem = {
  catalog_id: 'CAT-IMG-001',
  roaster: 'Manual Roaster',
  bean_name: 'Manual Bean',
  roast_level: 'Medium',
}

function renderModal(overrides: { onClose?: () => void; onSaved?: (item?: CatalogItem) => void } = {}) {
  const onClose = overrides.onClose ?? vi.fn()
  const onSaved = overrides.onSaved ?? vi.fn()
  return {
    onClose,
    onSaved,
    ...render(
      <MemoryRouter>
        <AddBeanModal onClose={onClose} onSaved={onSaved} />
      </MemoryRouter>,
    ),
  }
}

function fillManualBean() {
  fireEvent.click(screen.getByRole('button', { name: /enter manually/i }))
  fireEvent.change(screen.getByLabelText(/roaster/i), { target: { value: 'Manual Roaster' } })
  fireEvent.change(screen.getByLabelText(/bean name/i), { target: { value: 'Manual Bean' } })
  fireEvent.change(screen.getByLabelText(/roast level/i), { target: { value: 'Medium' } })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(createCatalogItem).mockResolvedValue(savedBean)
  vi.mocked(uploadCatalogImage).mockResolvedValue({ image_path: 'https://cdn.local/bean.jpg' })
})

describe('AddBeanModal — manual image selection', () => {
  it('shows a labelled image selector in manual mode with selected-file feedback', () => {
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: /enter manually/i }))

    const imageInput = screen.getByLabelText(/bean image/i) as HTMLInputElement
    const image = new File([new Uint8Array([1, 2, 3])], 'bean.jpg', { type: 'image/jpeg' })
    fireEvent.change(imageInput, { target: { files: [image] } })

    expect(imageInput.accept).toBe('image/*')
    expect(screen.getByText(/selected: bean\.jpg/i)).toBeInTheDocument()
  })

  it('creates the catalog entry first, then uploads the selected image', async () => {
    const onSaved = vi.fn()
    const onClose = vi.fn()
    renderModal({ onSaved, onClose })
    fillManualBean()

    const image = new File([new Uint8Array([1, 2, 3])], 'bean.jpg', { type: 'image/jpeg' })
    fireEvent.change(screen.getByLabelText(/bean image/i), { target: { files: [image] } })
    fireEvent.click(screen.getByRole('button', { name: /save bean/i }))

    await waitFor(() => {
      expect(createCatalogItem).toHaveBeenCalledWith({
        roaster: 'Manual Roaster',
        bean_name: 'Manual Bean',
        roast_level: 'Medium',
        product_url: undefined,
        source_image_url: undefined,
      })
      expect(uploadCatalogImage).toHaveBeenCalledWith('CAT-IMG-001', image)
      expect(onSaved).toHaveBeenCalledWith({ ...savedBean, image_path: 'https://cdn.local/bean.jpg' })
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('keeps the saved item visible with a detail retry path when image upload fails', async () => {
    const onSaved = vi.fn()
    const onClose = vi.fn()
    vi.mocked(uploadCatalogImage).mockRejectedValue(new Error('upload failed'))
    renderModal({ onSaved, onClose })
    fillManualBean()

    const image = new File([new Uint8Array([1, 2, 3])], 'bean.jpg', { type: 'image/jpeg' })
    fireEvent.change(screen.getByLabelText(/bean image/i), { target: { files: [image] } })
    fireEvent.click(screen.getByRole('button', { name: /save bean/i }))

    expect(await screen.findByText(/bean saved, but image upload failed/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /open saved bean detail/i })).toHaveAttribute(
      'href',
      '/catalog/CAT-IMG-001',
    )
    expect(onSaved).toHaveBeenCalledWith(savedBean)
    expect(onClose).not.toHaveBeenCalled()
  })
})
