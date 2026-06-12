import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { brewLogDetailQueryKey, listBrewLog, getBrewLogDetail } from '../api/brewLog'
import { brewLogListQueryKey } from '../api/queryKeys'
import LoadingSpinner from '../components/LoadingSpinner'
import { Button, EmptyState, GlassCard, PageHeader } from '../components/ui'
import { useHouseholdQueryScope } from '../contexts/AuthContext'

export default function BrewLogList() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const toastParam = searchParams.get('toast')
  const pageParam = searchParams.get('page')
  const _p = pageParam ? parseInt(pageParam, 10) : 1
  const page = Number.isFinite(_p) && _p >= 1 ? _p : 1
  const [toast, setToast] = useState<string | null>(null)
  const [syncAlertDismissed, setSyncAlertDismissed] = useState(false)
  const queryClient = useQueryClient()
  const activeHouseholdId = useHouseholdQueryScope()

  const { data, isLoading, isPlaceholderData, error } = useQuery({
    queryKey: brewLogListQueryKey(activeHouseholdId, page, 100),
    queryFn: () => listBrewLog(page, 100),
    placeholderData: keepPreviousData,
  })

  useEffect(() => {
    if (toastParam === 'shot-saved') {
      /* eslint-disable react-hooks/set-state-in-effect -- URL-to-state bridge: setSearchParams clears the trigger param in the same batch so toastParam is null on the next render; no cascade risk. */
      setToast('Shot saved!')
      setSearchParams({}, { replace: true })
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [toastParam, setSearchParams])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  if (isLoading) return <LoadingSpinner />
  if (error) return <div className="p-6 text-error">Failed to load brew log.</div>

  return (
    <div className="p-4 md:p-6 relative">
      <PageHeader title="Brew log" />
      {toast && createPortal(
        <div
          className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-amber-700 text-white text-sm px-4 py-2 rounded-full shadow-lg z-50"
          onClick={() => setToast(null)}
        >
          {toast}
        </div>,
        document.body
      )}
      {data?.sync_alert && !syncAlertDismissed && (
        <div role="alert" className="alert alert-warning mb-4">
          <span>Your brew log history may be incomplete. Contact support or run the sync check.</span>
          <button className="btn btn-sm btn-ghost" onClick={() => setSyncAlertDismissed(true)}>✕</button>
        </div>
      )}
      {!data?.items?.length ? (
        <div data-testid="fresh-household-empty-brew-log">
          <EmptyState
            icon={<span aria-hidden="true" className="text-3xl">☕</span>}
            title="No shots logged yet."
            description="Your recent brews will appear here once you start logging shots. Fresh households start empty."
          />
        </div>
      ) : (
        <>
          <div data-testid="brew-log-list" className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.items.map((entry) => (
              <Link
                data-testid="brew-log-entry"
                key={entry.shot_id}
                to={`/brew-log/${entry.shot_id}`}
                onMouseEnter={() => {
                  queryClient.prefetchQuery({
                    queryKey: brewLogDetailQueryKey(entry.shot_id, activeHouseholdId),
                    queryFn: () => getBrewLogDetail(entry.shot_id),
                    staleTime: 60_000,
                  })
                }}
                className="block h-full"
              >
                <GlassCard
                  padding="sm"
                  interactive
                  className={`frosted-brew-card !flex-col !items-start !p-3 md:!p-3 h-full gap-3 border-l-4 ${
                    entry.shot_eligibility === 'Good Espresso' || entry.shot_eligibility === 'God Shot'
                      ? 'border-l-amber-400/70'
                      : 'border-l-white/10'
                  }`}
                >
                  <div className="flex w-full items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-xs uppercase tracking-[0.22em] text-amber-300/50">{entry.date}</p>
                      <p className="text-sm md:text-base leading-snug text-amber-100 break-words">{entry.bag_display}</p>
                    </div>
                    {entry.shot_eligibility && (
                      <span className="badge badge-sm shrink-0 border border-amber-400/30 bg-amber-400/10 text-amber-200">
                        {entry.shot_eligibility}
                      </span>
                    )}
                  </div>

                  <div className="flex w-full flex-wrap gap-2">
                    {entry.dose_in_g != null && entry.yield_out_g != null && (
                      <span className="rounded-full border border-white/10 bg-black/10 px-2.5 py-1 text-xs font-mono text-amber-300">
                        {entry.dose_in_g}g → {entry.yield_out_g}g
                      </span>
                    )}
                    {entry.time_sec != null && (
                      <span className="rounded-full border border-white/10 bg-black/10 px-2.5 py-1 text-xs text-amber-200/80">
                        {entry.time_sec}s
                      </span>
                    )}
                    {entry.grind_setting && (
                      <span className="rounded-full border border-white/10 bg-black/10 px-2.5 py-1 text-xs text-amber-200/80">
                        Grind {entry.grind_setting}
                      </span>
                    )}
                  </div>

                  {(entry.machine_name || entry.grinder_name || entry.basket_name) && (
                    <div className="flex w-full flex-wrap gap-x-3 gap-y-1 text-xs text-amber-200/60">
                      {entry.machine_name && <span>Machine: {entry.machine_name}</span>}
                      {entry.grinder_name && <span>Grinder: {entry.grinder_name}</span>}
                      {entry.basket_name && <span>Basket: {entry.basket_name}</span>}
                    </div>
                  )}
                </GlassCard>
              </Link>
            ))}
          </div>
          <nav aria-label="Brew log pagination" className="flex justify-center mt-4">
            <div className="join">
              <Button
                variant="ghost"
                size="sm"
                className="join-item"
                disabled={page <= 1 || isPlaceholderData}
                onClick={() => setSearchParams({ page: String(page - 1) })}
              >
                Previous
              </Button>
              <span
                className="join-item btn btn-sm btn-active"
                aria-current="page"
              >
                {page}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="join-item"
                disabled={!data?.has_next || isPlaceholderData}
                onClick={() => setSearchParams({ page: String(page + 1) })}
              >
                Next
              </Button>
            </div>
          </nav>
        </>
      )}

      {/* Add shot FAB — portalled to document.body so backdrop-filter on #main-content
          does not create a new containing block and break position:fixed */}
      {createPortal(
        <Button
          onClick={() => navigate('/brew-log/add')}
          className="btn-circle fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[var(--mobile-fab-offset)] md:bottom-6 z-50"
          size="lg"
          variant="primary"
          aria-label="Add shot"
          icon={(
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          )}
        >
          <span className="sr-only">Add shot</span>
        </Button>,
        document.body
      )}
    </div>
  )
}
