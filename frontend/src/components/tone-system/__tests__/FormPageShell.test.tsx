import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { ToneProvider } from '../../../contexts/ToneContext'
import { FormPageShell } from '../FormPageShell'

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <ToneProvider>
      <MemoryRouter>{children}</MemoryRouter>
    </ToneProvider>
  )
}

describe('FormPageShell', () => {
  it('renders the canonical route nav, single h1, form landmark, slots, and live regions', () => {
    const handleSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault())

    const { container } = render(
      <Wrapper>
        <FormPageShell
          backTo="/catalog"
          eyebrow="Catalog"
          title="Add coffee"
          subtitle="Create a new bean profile."
          chips={<span>Draft</span>}
          status={<p>Autosaved draft.</p>}
          errorSummary={<p>Bean name is required.</p>}
          actions={<button type="submit">Save coffee</button>}
          headingId="coffee-form-heading"
          onSubmit={handleSubmit}
        >
          <label htmlFor="bean-name">Bean name</label>
          <input id="bean-name" name="bean-name" />
        </FormPageShell>
      </Wrapper>
    )

    expect(screen.getByRole('link', { name: '← Back' })).toHaveAttribute('href', '/catalog')
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Add coffee')
    expect(screen.getByRole('form')).toHaveAttribute('aria-labelledby', 'coffee-form-heading')
    expect(screen.getByRole('status')).toHaveTextContent('Autosaved draft.')
    expect(screen.getByRole('alert')).toHaveTextContent('Bean name is required.')
    expect(screen.getByRole('button', { name: 'Save coffee' })).toBeInTheDocument()
    expect(container.querySelector('.kk-detail-header--unified')).toBeInTheDocument()
  })
})
