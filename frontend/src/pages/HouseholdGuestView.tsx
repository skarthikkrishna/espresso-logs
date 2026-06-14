import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { getGuestHouseholdView, type GuestViewResponse } from '../api/guest'
import StandaloneHouseholdShell from '../components/StandaloneHouseholdShell'
import { Badge } from '../components/ui'
import { COPY } from '../copy'

function guestErrorMessage(error: unknown): string {
  if (!axios.isAxiosError(error)) return COPY.guest.loadErrorAuth
  if (error.response?.status === 401 || error.response?.status === 404 || error.response?.status === 410) {
    return COPY.guest.linkInvalid
  }
  return COPY.guest.loadErrorNetwork
}

function StatGrid({ stats }: { stats?: Record<string, number | string | null> }) {
  const entries = Object.entries(stats ?? {}).filter(([, value]) => value !== null && value !== undefined)
  if (entries.length === 0) return null
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {entries.slice(0, 6).map(([label, value]) => (
        <div key={label} className="kaapi-content-surface p-4">
          <p className="text-xs uppercase tracking-wide text-[var(--kaapi-content-muted)]">{label.replace(/_/g, ' ')}</p>
          <p className="mt-1 text-lg font-semibold text-[var(--kaapi-content-content)]">{String(value)}</p>
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
          <div className="kaapi-content-surface p-6 text-center space-y-4" role="alert">
            <p className="text-xs uppercase tracking-[0.22em] text-error">{COPY.guest.accessEyebrow}</p>
            <h1 id="guest-error-heading" className="font-display text-2xl text-[var(--kaapi-content-content)]">{COPY.guest.linkUnavailableTitle}</h1>
            <p className="text-sm text-[var(--kaapi-content-muted)]">{COPY.guest.linkInvalid}</p>
            <Link to="/login" className="btn btn-primary btn-bevel no-underline">{COPY.guest.signIn}</Link>
          </div>
        </div>
      </StandaloneHouseholdShell>
    )
  }

  if (isLoading) {
    return (
      <StandaloneHouseholdShell background="bg-guest" align="wide">
        <div className="mx-auto w-full max-w-xl p-4">
          <div className="kaapi-content-surface p-6 text-center" role="status" aria-live="polite">
            <span className="loading loading-spinner loading-lg text-primary" aria-label={COPY.guest.preparing} />
            <p className="mt-3 text-sm text-[var(--kaapi-content-muted)]">{COPY.guest.preparingBody}</p>
          </div>
        </div>
      </StandaloneHouseholdShell>
    )
  }

  if (error || !data) {
    return (
      <StandaloneHouseholdShell background="bg-state-error" align="center" labelledBy="guest-error-heading">
        <div className="w-full max-w-md">
          <div className="kaapi-content-surface p-6 text-center space-y-4" role="alert">
            <p className="text-xs uppercase tracking-[0.22em] text-error">{COPY.guest.accessEyebrow}</p>
            <h1 id="guest-error-heading" className="font-display text-2xl text-[var(--kaapi-content-content)]">{COPY.guest.linkUnavailableTitle}</h1>
            <p className="text-sm text-[var(--kaapi-content-muted)]">{error}</p>
            <Link to="/login" className="btn btn-primary btn-bevel no-underline">{COPY.guest.signIn}</Link>
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
          <span>{data.banner || COPY.guest.banner(data.household.name)}</span>
        </div>

        <header className="kaapi-content-surface p-6 md:p-8">
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--kaapi-content-muted)]">{COPY.guest.readonlyEyebrow}</p>
          <h1 id="guest-heading" className="mt-2 font-display text-4xl text-[var(--kaapi-content-content)] md:text-5xl">{data.household.name}</h1>
          <p className="mt-3 max-w-2xl text-sm text-[var(--kaapi-content-muted)]">{COPY.guest.readonlyBody}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/login" className="btn btn-primary btn-bevel no-underline">{COPY.guest.signIn}</Link>
            <Link to="/register" className="btn btn-outline btn-bevel no-underline">{COPY.guest.createAccount}</Link>
          </div>
        </header>

        <StatGrid stats={data.dashboard.stats} />

        <section className="grid gap-4 lg:grid-cols-3">
          <article className="kaapi-content-surface p-5 lg:col-span-1">
            <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--kaapi-content-muted)]">{COPY.guest.activeBags}</h2>
            {activeBags.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--kaapi-content-muted)]">{COPY.guest.activeBagsEmpty}</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {activeBags.slice(0, 6).map((bag, index) => (
                  <li key={bag.display_name || `bag-${index}`} className="rounded-xl border border-[var(--kaapi-content-border)] bg-[var(--kaapi-content-surface-2)] p-3">
                    <p className="text-sm font-medium text-[var(--kaapi-content-content)]">{bag.display_name}</p>
                    <Badge tone="neutral" emphasis="solid" className="mt-2">{bag.roast_level}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="kaapi-content-surface p-5 lg:col-span-1">
            <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--kaapi-content-muted)]">{COPY.guest.recentShots}</h2>
            {recentShots.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--kaapi-content-muted)]">{COPY.guest.recentShotsEmpty}</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {recentShots.slice(0, 6).map((shot, index) => (
                  <li key={`shot-${shot.date}-${index}`} className="rounded-xl border border-[var(--kaapi-content-border)] bg-[var(--kaapi-content-surface-2)] p-3">
                    <p className="text-sm font-medium text-[var(--kaapi-content-content)]">{shot.bag_display}</p>
                    <p className="text-xs text-[var(--kaapi-content-muted)]">{shot.date}</p>
                    {shot.taste_summary ? <p className="mt-2 text-sm text-[var(--kaapi-content-muted)]">{shot.taste_summary}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="kaapi-content-surface p-5 lg:col-span-1">
            <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--kaapi-content-muted)]">{COPY.guest.catalog}</h2>
            {beans.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--kaapi-content-muted)]">{COPY.guest.catalogEmpty}</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {beans.slice(0, 6).map((bean, index) => (
                  <li key={`bean-${bean.roaster}-${bean.bean_name}-${index}`} className="rounded-xl border border-[var(--kaapi-content-border)] bg-[var(--kaapi-content-surface-2)] p-3">
                    <p className="text-sm font-medium text-[var(--kaapi-content-content)]">{bean.roaster}</p>
                    <p className="text-xs text-[var(--kaapi-content-muted)]">{bean.bean_name}</p>
                    <Badge tone="neutral" emphasis="solid" className="mt-2">{bean.roast_level}</Badge>
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
