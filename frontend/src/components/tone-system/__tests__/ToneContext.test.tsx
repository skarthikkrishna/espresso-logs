/**
 * ToneContext tests — component behavior and toggle logic.
 *
 * NOTE: localStorage persistence is NOT unit-tested here because the jsdom
 * environment in Vitest v4 uses a custom localStorage that silently swallows
 * errors when `getItem`/`setItem` are not available (ToneContext wraps them
 * in try/catch). Persistence is an integration concern; these tests cover the
 * component contract: default value, setTone, and toggle.
 */
import { act, render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ToneProvider, useTone } from '../../../contexts/ToneContext'

function ToneReadout() {
  const { tone, toggleTone, setTone } = useTone()
  return (
    <div>
      <span data-testid="tone-value">{tone}</span>
      <button type="button" onClick={toggleTone} data-testid="toggle-btn">Toggle</button>
      <button type="button" onClick={() => setTone('beige')} data-testid="set-beige-btn">Set beige</button>
      <button type="button" onClick={() => setTone('dark')} data-testid="set-dark-btn">Set dark</button>
    </div>
  )
}

describe('ToneProvider', () => {
  it('defaults to dark on first render', () => {
    render(<ToneProvider><ToneReadout /></ToneProvider>)
    expect(screen.getByTestId('tone-value')).toHaveTextContent('dark')
  })

  it('setTone("beige") updates the displayed tone', () => {
    render(<ToneProvider><ToneReadout /></ToneProvider>)
    act(() => { screen.getByTestId('set-beige-btn').click() })
    expect(screen.getByTestId('tone-value')).toHaveTextContent('beige')
  })

  it('setTone("dark") updates the displayed tone', () => {
    render(<ToneProvider><ToneReadout /></ToneProvider>)
    act(() => { screen.getByTestId('set-beige-btn').click() })
    act(() => { screen.getByTestId('set-dark-btn').click() })
    expect(screen.getByTestId('tone-value')).toHaveTextContent('dark')
  })

  it('toggles from dark to beige', () => {
    render(<ToneProvider><ToneReadout /></ToneProvider>)
    act(() => { screen.getByTestId('toggle-btn').click() })
    expect(screen.getByTestId('tone-value')).toHaveTextContent('beige')
  })

  it('toggles dark → beige → dark (double toggle)', () => {
    render(<ToneProvider><ToneReadout /></ToneProvider>)
    act(() => { screen.getByTestId('toggle-btn').click() })
    expect(screen.getByTestId('tone-value')).toHaveTextContent('beige')
    act(() => { screen.getByTestId('toggle-btn').click() })
    expect(screen.getByTestId('tone-value')).toHaveTextContent('dark')
  })

  it('throws when useTone is called outside ToneProvider', () => {
    function Orphan() { useTone(); return null }
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => render(<Orphan />)).toThrow('useTone() must be used within a <ToneProvider>')
    consoleSpy.mockRestore()
  })
})

// NFR3 / D11: standalone (non-AppShell) pages lock tone to dark; breaks: a
// beige-persisted user lands on a beige auth/invite/404 card on the dark bg.
describe('ToneProvider lockedTone (D11)', () => {
  it('renders the locked tone', () => {
    render(<ToneProvider lockedTone="dark"><ToneReadout /></ToneProvider>)
    expect(screen.getByTestId('tone-value')).toHaveTextContent('dark')
  })

  it('setTone is a no-op while locked', () => {
    render(<ToneProvider lockedTone="dark"><ToneReadout /></ToneProvider>)
    act(() => { screen.getByTestId('set-beige-btn').click() })
    expect(screen.getByTestId('tone-value')).toHaveTextContent('dark')
  })

  it('toggleTone is a no-op while locked', () => {
    render(<ToneProvider lockedTone="dark"><ToneReadout /></ToneProvider>)
    act(() => { screen.getByTestId('toggle-btn').click() })
    expect(screen.getByTestId('tone-value')).toHaveTextContent('dark')
  })

  it('ignores a persisted beige preference (no localStorage read)', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('beige')
    render(<ToneProvider lockedTone="dark"><ToneReadout /></ToneProvider>)
    expect(screen.getByTestId('tone-value')).toHaveTextContent('dark')
    getItem.mockRestore()
  })

  it('never writes localStorage while locked (toggle attempt)', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    render(<ToneProvider lockedTone="dark"><ToneReadout /></ToneProvider>)
    act(() => { screen.getByTestId('toggle-btn').click() })
    act(() => { screen.getByTestId('set-beige-btn').click() })
    expect(setItem).not.toHaveBeenCalled()
    setItem.mockRestore()
  })
})





