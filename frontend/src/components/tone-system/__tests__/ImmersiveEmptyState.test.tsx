/**
 * ImmersiveEmptyState tests — icon, title, description, action rendering.
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ImmersiveEmptyState } from '../ImmersiveEmptyState'
import { ToneProvider } from '../../../contexts/ToneContext'

function Wrapper({ children }: { children: React.ReactNode }) {
  return <ToneProvider>{children}</ToneProvider>
}

describe('ImmersiveEmptyState', () => {
  it('renders the title text', () => {
    render(
      <Wrapper>
        <ImmersiveEmptyState title="No beans yet" />
      </Wrapper>
    )
    expect(screen.getByText('No beans yet')).toBeInTheDocument()
  })

  it('renders description when provided', () => {
    render(
      <Wrapper>
        <ImmersiveEmptyState title="No beans yet" description="Add your first coffee bean." />
      </Wrapper>
    )
    expect(screen.getByText('Add your first coffee bean.')).toBeInTheDocument()
  })

  it('does not render description element when omitted', () => {
    const { container } = render(
      <Wrapper>
        <ImmersiveEmptyState title="No beans yet" />
      </Wrapper>
    )
    expect(container.querySelector('.immersive-empty-state-description')).toBeNull()
  })

  it('renders icon when provided', () => {
    render(
      <Wrapper>
        <ImmersiveEmptyState title="No beans yet" icon={<span data-testid="icon">☕</span>} />
      </Wrapper>
    )
    expect(screen.getByTestId('icon')).toBeInTheDocument()
  })

  it('does not render icon slot when icon is omitted', () => {
    const { container } = render(
      <Wrapper>
        <ImmersiveEmptyState title="No beans yet" />
      </Wrapper>
    )
    expect(container.querySelector('.immersive-empty-state-icon')).toBeNull()
  })

  it('renders action content when provided', () => {
    render(
      <Wrapper>
        <ImmersiveEmptyState
          title="No beans yet"
          action={<button>Add coffee</button>}
        />
      </Wrapper>
    )
    expect(screen.getByRole('button', { name: 'Add coffee' })).toBeInTheDocument()
  })

  it('applies immersive-empty-state class', () => {
    const { container } = render(
      <Wrapper>
        <ImmersiveEmptyState title="No beans yet" />
      </Wrapper>
    )
    expect(container.querySelector('.immersive-empty-state')).toBeInTheDocument()
  })
})
