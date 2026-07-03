/**
 * spec-043 T015 — ImportWizard mobile-first rebuild tests.
 *
 * Verifies the rebuild preserves spec-039/spec-042 import behavior while replacing the
 * overflow-prone DaisyUI stepper with an accessible segmented progress (Rule 9 — intent):
 *   1. Accessible stepper exposes progress (nav + aria-current), not steps-horizontal.
 *   2. CSV upload parses rows and unlocks Preview.
 *   3. Preview pairs status with label/icon (Ready / Needs fix) using the validate logic.
 *   4. Import sends valid rows to the existing API and advances to Done; invalid rows skip.
 *   5. Back returns to the Upload step.
 *
 * Updated for spec-043 T023 migration: ImportWizard now uses WizardShell (ToneProvider
 * + BackLink/ToneToggle via react-router-dom). MemoryRouter wrapper added to all renders.
 */
import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../api/catalog', () => ({ createCatalogItem: vi.fn() }))
vi.mock('../api/brewLog', () => ({ submitShot: vi.fn() }))
vi.mock('../contexts/AuthContext', async () => {
  const actual = await vi.importActual<typeof import('../contexts/AuthContext')>('../contexts/AuthContext')
  return { ...actual, useAuth: () => ({ activeMembership: { household_name: 'Test Household' } }) }
})

import { createCatalogItem } from '../api/catalog'
import { submitShot } from '../api/brewLog'
import ImportWizard from './ImportWizard'

const CSV = ['roaster,bean_name,roast_level', 'Blue Tokai,Attikan Estate,Medium', 'solo,,'].join('\n')

function renderWizard() {
  return render(
    <MemoryRouter>
      <ImportWizard />
    </MemoryRouter>,
  )
}

async function uploadCsvAndPreview() {
  const { container } = renderWizard()
  const input = container.querySelector('#import-csv') as HTMLInputElement
  const file = new File([CSV], 'import.csv', { type: 'text/csv' })
  fireEvent.change(input, { target: { files: [file] } })

  const preview = await screen.findByRole('button', { name: /preview 2 rows/i })
  await waitFor(() => expect(preview).not.toBeDisabled())
  fireEvent.click(preview)
  return container
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ImportWizard — accessible stepper', () => {
  it('renders segmented progress with the current step marked', () => {
    renderWizard()
    const nav = screen.getByRole('navigation', { name: /import progress/i })
    expect(nav).toBeInTheDocument()
    for (const label of ['Upload', 'Preview', 'Done']) {
      expect(within(nav).getByText(label)).toBeInTheDocument()
    }
    const current = nav.querySelector('[aria-current="step"]')
    expect(current).toHaveTextContent('Upload')
  })
})

describe('ImportWizard — tone action contract', () => {
  it('renders the example CSV action through the tone secondary/edit grammar', () => {
    const { container } = renderWizard()
    const link = screen.getByTestId('import-example-csv-link')

    expect(link).toHaveClass('kk-tc-btn')
    expect(link).toHaveClass('kk-tc-btn--edit')
    for (const forbidden of ['btn', 'btn-outline', 'btn-sm', 'btn-bevel']) {
      expect(link.classList.contains(forbidden)).toBe(false)
      expect(container.querySelector(`.${forbidden}`)).toBeNull()
    }
  })
})

describe('ImportWizard — preview', () => {
  it('parses an uploaded CSV and pairs each row status with a label', async () => {
    await uploadCsvAndPreview()

    expect(await screen.findByText('Import 1 valid rows')).toBeInTheDocument()
    expect(screen.getByText('Ready')).toBeInTheDocument()
    expect(screen.getByText('Needs fix')).toBeInTheDocument()
    // The invalid row explains itself loudly.
    expect(screen.getAllByTestId('import-validation-message').length).toBeGreaterThan(0)
  })

  it('returns to the Upload step via Back', async () => {
    await uploadCsvAndPreview()
    fireEvent.click(await screen.findByRole('button', { name: /^back$/i }))
    expect(await screen.findByRole('button', { name: /choose csv/i })).toBeInTheDocument()
  })
})

describe('ImportWizard — import behavior (spec-039/spec-042 preserved)', () => {
  it('imports valid rows through the existing API and skips invalid ones', async () => {
    vi.mocked(createCatalogItem).mockResolvedValue({
      catalog_id: 'CAT1',
      roaster: 'Blue Tokai',
      bean_name: 'Attikan Estate',
      roast_level: 'Medium',
    })
    await uploadCsvAndPreview()

    fireEvent.click(await screen.findByRole('button', { name: /import 1 valid rows/i }))

    await waitFor(() => {
      expect(createCatalogItem).toHaveBeenCalledTimes(1)
    })
    expect(createCatalogItem).toHaveBeenCalledWith({
      roaster: 'Blue Tokai',
      bean_name: 'Attikan Estate',
      roast_level: 'Medium',
      product_url: undefined,
    })
    expect(submitShot).not.toHaveBeenCalled()
    expect(await screen.findByText('Import complete')).toBeInTheDocument()
    expect(screen.getByText(/1 row imported successfully/i)).toBeInTheDocument()
  })
})
