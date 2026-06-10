import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { brewLogDetailQueryKey, listBrewLog, getBrewLogDetail } from '../api/brewLog'
import { brewLogListQueryKey } from '../api/queryKeys'
import LoadingSpinner from '../components/LoadingSpinner'
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
      <h1 className="font-display text-3xl md:text-4xl font-bold text-white/80 mb-4">Brew log</h1>
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
        <p className="text-amber-200/60 text-sm">No shots logged yet.</p>
      ) : (
        <>
          <div data-testid="brew-log-list" className="space-y-2">
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
                className="frosted-brew-card hover:border-amber-500/40 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm md:text-base text-amber-100 truncate">{entry.bag_display}</p>
                  <p className="text-xs md:text-sm text-amber-200/50">{entry.date}</p>
                </div>
                {entry.dose_in_g != null && entry.yield_out_g != null && (
                  <span className="text-xs md:text-sm text-amber-300 font-mono ml-3 shrink-0">
                    {entry.dose_in_g}g → {entry.yield_out_g}g
                  </span>
                )}
              </Link>
            ))}
          </div>
          <nav aria-label="Brew log pagination" className="flex justify-center mt-4">
            <div className="join">
              <button
                className="join-item btn btn-sm"
                disabled={page <= 1 || isPlaceholderData}
                onClick={() => setSearchParams({ page: String(page - 1) })}
              >
                Previous
              </button>
              <span
                className="join-item btn btn-sm btn-active"
                aria-current="page"
              >
                {page}
              </span>
              <button
                className="join-item btn btn-sm"
                disabled={!data?.has_next || isPlaceholderData}
                onClick={() => setSearchParams({ page: String(page + 1) })}
              >
                Next
              </button>
            </div>
          </nav>
        </>
      )}

      {/* Add shot FAB — portalled to document.body so backdrop-filter on #main-content
          does not create a new containing block and break position:fixed */}
      {createPortal(
        <button
          onClick={() => navigate('/brew-log/add')}
          className="btn btn-circle btn-lg btn-primary btn-bevel fixed bottom-20 right-4 md:bottom-6 z-50"
          aria-label="Add shot"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>,
        document.body
      )}
    </div>
  )
}
