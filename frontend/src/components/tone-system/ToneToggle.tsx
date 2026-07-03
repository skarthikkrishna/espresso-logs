/**
 * ToneToggle — the Light / Dark tone toggle button.
 *
 * Principle 1 (Dual-Tone Surface): the visible entry-point for switching tone;
 * reads and writes via ToneContext (localStorage-persisted).
 * Principle 12 (No One-Offs): shared across all Shell-A pages; replaces
 * per-page inline `useState<'dark'|'beige'>` + toggle button one-offs.
 */
import { useTone } from '../../contexts/ToneContext'

export function ToneToggle() {
  const { tone, toggleTone } = useTone()
  return (
    <div className="kk-tc-tone-toolbar">
      <button
        type="button"
        className="kk-tc-tone-btn"
        onClick={toggleTone}
        aria-label={`Switch to ${tone === 'dark' ? 'light' : 'dark'} tone`}
      >
        {tone === 'dark' ? '☀️ Light' : '🌑 Dark'}
      </button>
    </div>
  )
}
