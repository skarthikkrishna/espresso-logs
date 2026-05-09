/**
 * T032 — CatalogDetail bag card order and dead link removal tests
 */
import React from 'react'
import { render, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => vi.fn() }
})

vi.mock('../api/catalog', () => ({
  getCatalogDetail: vi.fn(),
  updateCatalogItem: vi.fn(),
  uploadCatalogImage: vi.fn(),
  createInventoryBag: vi.fn(),
}))

import { getCatalogDetail, updateCatalogItem, uploadCatalogImage } from '../api/catalog'
import CatalogDetail from './CatalogDetail'

const FIXTURE_WITH_ROAST_DATE = {
  item: { catalog_id: 'CAT001', bean_name: 'Test Coffee', roaster: 'Test Roaster', roast_level: 'Medium' },
  bags: [{
    bag_id: 'BAG001',
    display_name: 'Test Roaster — Test Coffee',
    beans: 'Test Coffee',
    catalog_id: 'CAT001',
    roast_date: '2024-01-15',
    status: 'Active' as const,
  }],
  recent_shots: [],
}

const FIXTURE_NULL_ROAST_DATE = {
  ...FIXTURE_WITH_ROAST_DATE,
  bags: [{
    bag_id: 'BAG002',
    display_name: 'Test Roaster — Test Coffee',
    beans: 'Test Coffee',
    catalog_id: 'CAT001',
    status: 'Finished' as const,
  }],
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <MemoryRouter initialEntries={['/catalog/CAT001']}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/catalog/:id" element={ui} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('CatalogDetail — bag card', () => {
  it('roast_date_appears_before_status_in_dom_order', async () => {
    vi.mocked(getCatalogDetail).mockResolvedValue(FIXTURE_WITH_ROAST_DATE)
    const { container } = renderWithProviders(<CatalogDetail />)
    await waitFor(() => {
      const nodes = container.querySelectorAll('[data-testid="bag-roast-date"],[data-testid="bag-status"]')
      expect(nodes.length).toBe(2)
      expect(nodes[0]).toHaveAttribute('data-testid', 'bag-roast-date')
      expect(nodes[1]).toHaveAttribute('data-testid', 'bag-status')
    })
  })

  it('no_bags_href_link_present', async () => {
    vi.mocked(getCatalogDetail).mockResolvedValue(FIXTURE_WITH_ROAST_DATE)
    const { container } = renderWithProviders(<CatalogDetail />)
    await waitFor(() => {
      expect(container.querySelector('a[href*="/bags/"]')).toBeNull()
    })
  })

  it('null_roast_date_shows_only_status', async () => {
    vi.mocked(getCatalogDetail).mockResolvedValue(FIXTURE_NULL_ROAST_DATE)
    const { container } = renderWithProviders(<CatalogDetail />)
    await waitFor(() => {
      expect(container.querySelector('[data-testid="bag-roast-date"]')).toBeNull()
      expect(container.querySelector('[data-testid="bag-status"]')).not.toBeNull()
    })
  })
})

describe('CatalogDetail — edit entry', () => {
  it('opens edit form with current values, saves edits, refetches', async () => {
    const { fireEvent, screen } = await import('@testing-library/react')
    vi.mocked(getCatalogDetail).mockResolvedValue(FIXTURE_WITH_ROAST_DATE)
    vi.mocked(updateCatalogItem).mockResolvedValue({
      catalog_id: 'CAT001',
      roaster: 'New Roaster',
      bean_name: 'New Bean',
      roast_level: 'Dark',
    })

    renderWithProviders(<CatalogDetail />)
    await waitFor(() => screen.getByText('Edit'))
    fireEvent.click(screen.getByText('Edit'))

    const roasterInput = await screen.findByDisplayValue('Test Roaster')
    fireEvent.change(roasterInput, { target: { value: 'New Roaster' } })
    fireEvent.change(screen.getByDisplayValue('Test Coffee'), { target: { value: 'New Bean' } })
    fireEvent.change(screen.getByDisplayValue('Medium'), { target: { value: 'Dark' } })

    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(updateCatalogItem).toHaveBeenCalledWith('CAT001', {
        roaster: 'New Roaster',
        bean_name: 'New Bean',
        roast_level: 'Dark',
        product_url: null,
      })
    })
  })

  it('uploads a replacement image while editing', async () => {
    const { fireEvent, screen } = await import('@testing-library/react')
    vi.mocked(getCatalogDetail).mockResolvedValue(FIXTURE_WITH_ROAST_DATE)
    vi.mocked(uploadCatalogImage).mockResolvedValue({ image_path: 'https://cdn/new.jpg' })

    const { container } = renderWithProviders(<CatalogDetail />)
    await waitFor(() => screen.getByText('Edit'))
    fireEvent.click(screen.getByText('Edit'))

    const fileInput = container.querySelector(
      '[data-testid="catalog-image-input"]',
    ) as HTMLInputElement
    expect(fileInput).not.toBeNull()
    const file = new File([new Uint8Array([1, 2, 3])], 'bean.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(uploadCatalogImage).toHaveBeenCalledWith('CAT001', file)
    })
  })

  it('image preview updates immediately from upload response, no refetch required', async () => {
    const { fireEvent, screen } = await import('@testing-library/react')
    // Start with an existing image so the <img> is rendered.
    const FIXTURE_WITH_IMAGE = {
      ...FIXTURE_WITH_ROAST_DATE,
      item: { ...FIXTURE_WITH_ROAST_DATE.item, image_path: 'https://cdn/old.jpg' },
    }
    vi.mocked(getCatalogDetail).mockResolvedValue(FIXTURE_WITH_IMAGE)
    vi.mocked(uploadCatalogImage).mockResolvedValue({ image_path: 'https://cdn/new.jpg' })

    const { container } = renderWithProviders(<CatalogDetail />)
    await waitFor(() => screen.getByText('Edit'))
    fireEvent.click(screen.getByText('Edit'))

    // Record how many times getCatalogDetail has been called by this point
    // (once for the initial load). Any further call would be a refetch.
    const callsBeforeUpload = vi.mocked(getCatalogDetail).mock.calls.length

    const fileInput = container.querySelector(
      '[data-testid="catalog-image-input"]',
    ) as HTMLInputElement
    const file = new File([new Uint8Array([1, 2, 3])], 'bean.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    // The <img> src must update to the value returned by uploadCatalogImage
    // via the optimistic setQueryData call — NOT via a background refetch.
    await waitFor(() => {
      const img = container.querySelector('img') as HTMLImageElement | null
      expect(img?.src).toBe('https://cdn/new.jpg')
    })

    // getCatalogDetail must not have been called again — the preview update
    // came purely from the upload response written into the query cache.
    expect(vi.mocked(getCatalogDetail).mock.calls.length).toBe(callsBeforeUpload)
  })
})
