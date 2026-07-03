/**
 * ImmersiveListShell tests — data-tone, ref forwarding, content container.
 */
import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ImmersiveListShell } from '../ImmersiveListShell'
import { ToneProvider } from '../../../contexts/ToneContext'

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <ToneProvider>
      {children}
    </ToneProvider>
  )
}

describe('ImmersiveListShell', () => {
  it('renders children inside the content container', () => {
    render(
      <Wrapper>
        <ImmersiveListShell>
          <p>Hello list</p>
        </ImmersiveListShell>
      </Wrapper>
    )
    expect(screen.getByText('Hello list')).toBeInTheDocument()
  })

  it('applies immersive-list-shell class to the outer wrapper', () => {
    const { container } = render(
      <Wrapper>
        <ImmersiveListShell>content</ImmersiveListShell>
      </Wrapper>
    )
    expect(container.querySelector('.immersive-list-shell')).toBeInTheDocument()
  })

  it('sets data-tone attribute (defaults to dark)', () => {
    const { container } = render(
      <Wrapper>
        <ImmersiveListShell>content</ImmersiveListShell>
      </Wrapper>
    )
    const shell = container.querySelector('.immersive-list-shell') as HTMLElement
    expect(shell.dataset.tone).toBe('dark')
  })

  it('wraps children in immersive-list-content container', () => {
    const { container } = render(
      <Wrapper>
        <ImmersiveListShell>content</ImmersiveListShell>
      </Wrapper>
    )
    expect(container.querySelector('.immersive-list-content')).toBeInTheDocument()
  })

  it('accepts extra className', () => {
    const { container } = render(
      <Wrapper>
        <ImmersiveListShell className="extra">content</ImmersiveListShell>
      </Wrapper>
    )
    const shell = container.querySelector('.immersive-list-shell') as HTMLElement
    expect(shell.className).toContain('extra')
  })

  it('applies data-testid when testId prop is provided', () => {
    render(
      <Wrapper>
        <ImmersiveListShell testId="my-shell">content</ImmersiveListShell>
      </Wrapper>
    )
    expect(screen.getByTestId('my-shell')).toBeInTheDocument()
  })

  it('forwards ref to the outer div', () => {
    const ref = createRef<HTMLDivElement>()
    render(
      <Wrapper>
        <ImmersiveListShell ref={ref}>content</ImmersiveListShell>
      </Wrapper>
    )
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
    expect(ref.current?.className).toContain('immersive-list-shell')
  })
})
