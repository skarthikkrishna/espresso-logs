import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ToneProvider } from '../../../contexts/ToneContext'
import { ToneStateCard } from '../ToneStateCard'

function Wrapper({ children }: { children: React.ReactNode }) {
  return <ToneProvider>{children}</ToneProvider>
}

describe('ToneStateCard', () => {
  it.each([
    ['empty', 'Empty', '○', undefined, undefined],
    ['loading', 'Loading', '⋯', 'status', 'polite'],
    ['error', 'Error', '!', 'alert', 'assertive'],
    ['success', 'Success', '✓', 'status', 'polite'],
    ['info', 'Information', 'i', 'status', 'polite'],
    ['warning', 'Warning', '!', 'alert', 'assertive'],
    ['not-found', 'Not found', '404', undefined, undefined],
    ['readonly', 'Read only', '↘', undefined, undefined],
  ] as const)(
    'renders %s with its semantic label, icon, role, and default live behavior',
    (state, label, icon, role, ariaLive) => {
      const { container } = render(
        <Wrapper>
          <ToneStateCard state={state} title={`${label} title`} message={`${label} message`}>
            <p>{label} body copy</p>
          </ToneStateCard>
        </Wrapper>,
      )

      const card = container.querySelector('.tone-state-card')
      expect(card).toHaveAttribute('data-state', state)
      if (role) {
        expect(screen.getByRole(role)).toBe(card)
        expect(card).toHaveAttribute('aria-live', ariaLive)
      } else {
        expect(card).not.toHaveAttribute('role')
        expect(card).not.toHaveAttribute('aria-live')
      }
      expect(screen.getByText(label)).toHaveClass('sr-only')
      expect(container.querySelector('.tone-state-card__icon')).toHaveTextContent(icon)
      expect(screen.getByText(`${label} title`)).toBeInTheDocument()
      expect(screen.getByText(`${label} message`)).toBeInTheDocument()
      expect(screen.getByText(`${label} body copy`)).toBeInTheDocument()
    },
  )

  it('announces loading as a busy status and renders skeletons instead of a spinner-only state', () => {
    const { container } = render(
      <Wrapper>
        <ToneStateCard state="loading" title="Loading brew log" live />
      </Wrapper>,
    )

    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-busy', 'true')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByText('Loading brew log')).toBeInTheDocument()
    expect(container.querySelector('.tone-state-card__skeleton')).toBeInTheDocument()
  })

  it('announces error states assertively', () => {
    render(
      <Wrapper>
        <ToneStateCard state="error" title="Failed to load brew log." message="Check your connection." />
      </Wrapper>,
    )

    const alert = screen.getByRole('alert')
    expect(alert).toHaveAttribute('aria-live', 'assertive')
    expect(alert).toHaveTextContent('Error')
    expect(alert).toHaveTextContent('Check your connection.')
  })

  it('renders state label text so meaning is not color-only', () => {
    render(
      <Wrapper>
        <ToneStateCard state="warning" title="Sync check warning" message="History may be incomplete." />
      </Wrapper>,
    )

    expect(screen.getByText('Warning')).toBeInTheDocument()
    expect(screen.getByText('Sync check warning')).toBeInTheDocument()
  })

  it('renders an action slot', () => {
    render(
      <Wrapper>
        <ToneStateCard state="info" title="Guidance" action={<button>Retry</button>} />
      </Wrapper>,
    )

    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('applies compact layout and honors explicit live overrides', () => {
    const { container } = render(
      <Wrapper>
        <ToneStateCard state="success" title="Saved" compact live="assertive" />
      </Wrapper>,
    )

    expect(container.querySelector('.tone-state-card')).toHaveClass('tone-state-card--compact')
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'assertive')
  })
})
