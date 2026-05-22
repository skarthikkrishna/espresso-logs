/**
 * HouseholdGuestView page — read-only guest household view stub.
 */

import { Link, useParams, useSearchParams } from 'react-router-dom'

export default function HouseholdGuestView() {
  const { householdId } = useParams<{ householdId: string }>()
  const [searchParams] = useSearchParams()
  const guestToken = searchParams.get('key') ?? searchParams.get('guest')

  return (
    <div className="min-h-screen bg-base-100 px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="alert alert-warning shadow-sm">
          <span>
            You&apos;re viewing household <strong>{householdId ?? 'unknown'}</strong> as a guest. Sign in or create an account to log shots.
          </span>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link to="/login" className="btn btn-primary btn-sm btn-bevel no-underline">
            Sign in
          </Link>
          <Link to="/register" className="btn btn-outline btn-sm btn-bevel no-underline">
            Create an account
          </Link>
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-xl border border-base-300/50 bg-base-200/60 p-5 shadow-sm">
            <h1 className="text-lg font-display text-amber-100">Guest household view</h1>
            <p className="mt-2 text-sm text-base-content/70">
              This public route is wired for read-only household browsing. Interactive write actions remain hidden for guests.
            </p>
          </article>
          <article className="rounded-xl border border-base-300/50 bg-base-200/60 p-5 shadow-sm">
            <h2 className="text-sm font-medium uppercase tracking-wide text-amber-200/80">Brew log</h2>
            <p className="mt-2 text-sm text-base-content/70">Read-only brew history will render here.</p>
          </article>
          <article className="rounded-xl border border-base-300/50 bg-base-200/60 p-5 shadow-sm">
            <h2 className="text-sm font-medium uppercase tracking-wide text-amber-200/80">Catalog</h2>
            <p className="mt-2 text-sm text-base-content/70">Shared catalog data will render here.</p>
          </article>
        </section>

        <p className="text-xs text-base-content/50 break-all">
          Guest access token: {guestToken ?? 'Missing guest token'}
        </p>
      </div>
    </div>
  )
}
