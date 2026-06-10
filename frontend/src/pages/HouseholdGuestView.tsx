import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { getGuestHouseholdView, type GuestViewResponse } from '../api/guest'
import StandaloneHouseholdShell from '../components/StandaloneHouseholdShell'
import Chip from '../components/Chip'

function guestErrorMessage(error: unknown): string {
  if (!axios.isAxiosError(error)) return 'We could not load this guest view. Ask the household admin to share a fresh link.'
  if (error.response?.status === 401 || error.response?.status === 404 || error.response?.status === 410) {
    return 'This guest link is no longer valid. Ask the household admin to share a new one.'
  }
  return 'We could not load this guest view. Check your connection and try again.'
}

function StatGrid({ stats }: { stats?: Record<string, number | string | null> }) {
  const entries = Object.entries(stats ?? {}).filter(([, value]) => value !== null && value !== undefined)
  if (entries.length === 0) return null
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {entries.slice(0, 6).map(([label, value]) => (
        <div key={label} className="glass-card card-bevel p-4">
          <p className="text-xs uppercase tracking-wide text-base-content/50">{label.replace(/_/g, ' ')}</p>
          <p className="mt-1 text-lg font-semibold text-amber-100">{String(value)}</p>
        </div>
      ))}
    </div>
  )
}

export default function HouseholdGuestView() {
  const { householdId } = useParams<{ householdId: string }>()
  const [searchParams] = useSearchParams()
  const guestKey = searchParams.get('key') ?? ''
  const missingGuestKey = !householdId || !guestKey
  const [data, setData] = useState<GuestViewResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (missingGuestKey) return undefined

    let cancelled = false
    void getGuestHouseholdView(householdId, guestKey)
      .then((payload) => {
        if (!cancelled) setData(payload)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(guestErrorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => { cancelled = true }
  }, [guestKey, householdId, missingGuestKey])

  if (missingGuestKey) {
    return (
      <StandaloneHouseholdShell background="bg-state-error" align="center" labelledBy="guest-error-heading">
        <div className="w-full max-w-md">
          <div className="glass-card card-bevel p-6 text-center space-y-4" role="alert">
            <p className="text-xs uppercase tracking-[0.22em] text-error/80">Guest access</p>
            <h1 id="guest-error-heading" className="font-display text-2xl text-amber-100">Guest link unavailable</h1>
            <p className="text-sm text-base-content/75">This guest link is no longer valid. Ask the household admin to share a new one.</p>
            <Link to="/login" className="btn btn-primary btn-bevel no-underline">Sign in</Link>
          </div>
        </div>
      </StandaloneHouseholdShell>
    )
  }

  if (isLoading) {
    return (
      <StandaloneHouseholdShell background="bg-guest" align="wide">
        <div className="mx-auto w-full max-w-xl p-4">
          <div className="glass-card card-bevel p-6 text-center" role="status" aria-live="polite">
            <span className="loading loading-spinner loading-lg text-primary" aria-label="Preparing guest view" />
            <p className="mt-3 text-sm text-base-content/70">Preparing guest view…</p>
          </div>
        </div>
      </StandaloneHouseholdShell>
    )
  }

  if (error || !data) {
    return (
      <StandaloneHouseholdShell background="bg-state-error" align="center" labelledBy="guest-error-heading">
        <div className="w-full max-w-md">
          <div className="glass-card card-bevel p-6 text-center space-y-4" role="alert">
            <p className="text-xs uppercase tracking-[0.22em] text-error/80">Guest access</p>
            <h1 id="guest-error-heading" className="font-display text-2xl text-amber-100">Guest link unavailable</h1>
            <p className="text-sm text-base-content/75">{error}</p>
            <Link to="/login" className="btn btn-primary btn-bevel no-underline">Sign in</Link>
          </div>
        </div>
      </StandaloneHouseholdShell>
    )
  }

  const activeBags = data.dashboard.active_bags ?? []
  const recentShots = data.dashboard.recent_shots ?? data.brew_log.entries.slice(0, 5)
  const beans = data.catalog.beans ?? []

  return (
    <StandaloneHouseholdShell background="bg-guest" align="wide" labelledBy="guest-heading">
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-2">
        <div className="alert alert-warning card-bevel">
          <span>{data.banner || `You're viewing ${data.household.name} as a guest. Sign in or create an account to log shots.`}</span>
        </div>

        <header className="glass-card card-bevel p-6 md:p-8">
          <p className="text-xs uppercase tracking-[0.22em] text-amber-300/70">Read-only household view</p>
          <h1 id="guest-heading" className="mt-2 font-display text-4xl text-amber-100 md:text-5xl">{data.household.name}</h1>
          <p className="mt-3 max-w-2xl text-sm text-base-content/70">Browse shared coffee activity without account access. Write actions, settings, imports, edits, and hardware management are hidden for guests.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/login" className="btn btn-primary btn-bevel no-underline">Sign in</Link>
            <Link to="/register" className="btn btn-outline btn-bevel no-underline">Create an account</Link>
          </div>
        </header>

        <StatGrid stats={data.dashboard.stats} />

        <section className="grid gap-4 lg:grid-cols-3">
          <article className="glass-card card-bevel p-5 lg:col-span-1">
            <h2 className="text-sm font-medium uppercase tracking-wide text-amber-200/80">Active bags</h2>
            {activeBags.length === 0 ? (
              <p className="mt-3 text-sm text-base-content/60">No active bags are shared yet.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {activeBags.slice(0, 6).map((bag, index) => (
                  <li key={bag.display_name || `bag-${index}`} className="rounded-xl border border-amber-900/30 p-3">
                    <p className="text-sm font-medium text-amber-100">{bag.display_name}</p>
                    <Chip label={bag.roast_level} className="mt-2" />
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="glass-card card-bevel p-5 lg:col-span-1">
            <h2 className="text-sm font-medium uppercase tracking-wide text-amber-200/80">Recent shots</h2>
            {recentShots.length === 0 ? (
              <p className="mt-3 text-sm text-base-content/60">No shots are shared yet.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {recentShots.slice(0, 6).map((shot, index) => (
                  <li key={`shot-${shot.date}-${index}`} className="rounded-xl border border-amber-900/30 p-3">
                    <p className="text-sm font-medium text-amber-100">{shot.bag_display}</p>
                    <p className="text-xs text-base-content/55">{shot.date}</p>
                    {shot.taste_summary ? <p className="mt-2 text-sm text-base-content/70">{shot.taste_summary}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="glass-card card-bevel p-5 lg:col-span-1">
            <h2 className="text-sm font-medium uppercase tracking-wide text-amber-200/80">Catalog</h2>
            {beans.length === 0 ? (
              <p className="mt-3 text-sm text-base-content/60">No beans are shared yet.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {beans.slice(0, 6).map((bean, index) => (
                  <li key={`bean-${bean.roaster}-${bean.bean_name}-${index}`} className="rounded-xl border border-amber-900/30 p-3">
                    <p className="text-sm font-medium text-amber-100">{bean.roaster}</p>
                    <p className="text-xs text-base-content/60">{bean.bean_name}</p>
                    <Chip label={bean.roast_level} className="mt-2" />
                  </li>
                ))}
              </ul>
            )}
          </article>
        </section>
      </div>
    </StandaloneHouseholdShell>
  )
}
