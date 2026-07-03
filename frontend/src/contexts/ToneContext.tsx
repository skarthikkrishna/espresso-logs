/**
 * ToneContext — global dual-tone preference provider.
 *
 * Principles satisfied:
 * - P1 (Dual-Tone Surface): exposes the canonical 'dark' | 'beige' preference.
 * - P12 (No One-Offs): single shared source of truth for tone state, replacing
 *   per-page `useState<'dark'|'beige'>` one-offs in BrewLogDetail / CatalogDetail.
 *
 * Persistence: the user's choice is written to localStorage under
 * STORAGE_KEY so it survives navigation and page refresh. Reading on init
 * and writing on every change means the preference is always in sync.
 *
 * Scope during Phase 2a: each Shell-A page wraps itself with ToneProvider,
 * keeping the toggle isolated from the app shell / nav. The provider will be
 * promoted to app-level in a later phase once all pages are migrated.
 */
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

export type Tone = 'dark' | 'beige'

const STORAGE_KEY = 'kaapi-tone-preference'

interface ToneContextValue {
  tone: Tone
  setTone: (t: Tone) => void
  toggleTone: () => void
}

const ToneContext = createContext<ToneContextValue | null>(null)

function readStoredTone(): Tone {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'beige') return 'beige'
  } catch {
    // localStorage unavailable (e.g. SSR / privacy mode) — default to dark
  }
  return 'dark'
}

export function ToneProvider({ children }: { children: ReactNode }) {
  const [tone, setToneState] = useState<Tone>(readStoredTone)

  const setTone = useCallback((next: Tone) => {
    setToneState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore localStorage write failures
    }
  }, [])

  const toggleTone = useCallback(() => {
    setTone(tone === 'dark' ? 'beige' : 'dark')
  }, [tone, setTone])

  return (
    <ToneContext.Provider value={{ tone, setTone, toggleTone }}>
      {children}
    </ToneContext.Provider>
  )
}

/** Must be called inside a <ToneProvider>. */
// eslint-disable-next-line react-refresh/only-export-components
export function useTone(): ToneContextValue {
  const ctx = useContext(ToneContext)
  if (!ctx) throw new Error('useTone() must be used within a <ToneProvider>')
  return ctx
}
