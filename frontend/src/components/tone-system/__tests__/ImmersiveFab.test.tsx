/**
 * ImmersiveFab tests — portal to body, aria-label, ref forwarding, tone attr.
 */
import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { ImmersiveFab } from '../ImmersiveFab'
import { ToneProvider } from '../../../contexts/ToneContext'

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 4v16m8-8H4" />
  </svg>
)

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <ToneProvider>
      <MemoryRouter>
        {children}
      </MemoryRouter>
    </ToneProvider>
  )
}

describe('ImmersiveFab', () => {
  it('portals the button to document.body', () => {
    const { container } = render(
      <Wrapper>
        <ImmersiveFab icon={<PlusIcon />} label="Add bean" />
      </Wrapper>
    )
    const fab = screen.getByRole('button', { name: /add bean/i })
    expect(fab).toBeInTheDocument()
    expect(container).not.toContainElement(fab)
    expect(document.body).toContainElement(fab)
  })

  it('applies aria-label to the button', () => {
    render(
      <Wrapper>
        <ImmersiveFab icon={<PlusIcon />} label="Add bean" />
      </Wrapper>
    )
    expect(screen.getByRole('button', { name: 'Add bean' })).toBeInTheDocument()
  })

  it('sets data-tone attribute (defaults to dark tone)', () => {
    render(
      <Wrapper>
        <ImmersiveFab icon={<PlusIcon />} label="Add bean" />
      </Wrapper>
    )
    const fab = screen.getByRole('button', { name: /add bean/i }) as HTMLElement
    expect(fab.dataset.tone).toBe('dark')
  })

  it('applies immersive-fab class', () => {
    render(
      <Wrapper>
        <ImmersiveFab icon={<PlusIcon />} label="Add bean" />
      </Wrapper>
    )
    const fab = screen.getByRole('button', { name: /add bean/i })
    expect(fab.className).toContain('immersive-fab')
  })

  it('has type="button" to prevent accidental form submission', () => {
    render(
      <Wrapper>
        <ImmersiveFab icon={<PlusIcon />} label="Add bean" />
      </Wrapper>
    )
    expect(screen.getByRole('button', { name: /add bean/i })).toHaveAttribute('type', 'button')
  })

  it('forwards ref to the button element', () => {
    const ref = createRef<HTMLButtonElement>()
    render(
      <Wrapper>
        <ImmersiveFab ref={ref} icon={<PlusIcon />} label="Add bean" />
      </Wrapper>
    )
    expect(ref.current).toBeInstanceOf(HTMLButtonElement)
    expect(ref.current?.getAttribute('aria-label')).toBe('Add bean')
  })

  it('accepts extra className', () => {
    render(
      <Wrapper>
        <ImmersiveFab icon={<PlusIcon />} label="Add bean" className="extra-class" />
      </Wrapper>
    )
    const fab = screen.getByRole('button', { name: /add bean/i })
    expect(fab.className).toContain('extra-class')
  })
})
