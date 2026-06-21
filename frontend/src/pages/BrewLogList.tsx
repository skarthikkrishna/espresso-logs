import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { brewLogDetailQueryKey, listBrewLog, getBrewLogDetail } from '../api/brewLog'
import { brewLogListQueryKey } from '../api/queryKeys'
import LoadingSpinner from '../components/LoadingSpinner'
import { EmptyState, PageHeader, Pagination } from '../components/ui'
import { useHouseholdQueryScope } from '../contexts/AuthContext'
import { ToneProvider } from '../contexts/ToneContext'
import { useKaapiMotion } from '../lib/motion'
import { COPY } from '../copy'
import { LogShotAction, ShotCard, TonePageWrapper } from '../components/tone-system'

export default function BrewLogList() {
  return (
    <ToneProvider>
      <BrewLogListPage />
    </ToneProvider>
  )
}

function BrewLogListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const toastParam = searchParams.get('toast')
  const pageParam = searchParams.get('page')
  const _p = pageParam ? parseInt(pageParam, 10) : 1
  const page = Number.isFinite(_p) && _p >= 1 ? _p : 1
  const [toast, setToast] = useState<string | null>(null)
  const [syncAlertDismissed, setSyncAlertDismissed] = useState(false)
  const queryClient = useQueryClient()
  const activeHouseholdId = useHouseholdQueryScope()
  const routeRef = useRef<HTMLDivElement>(null)
  const cardListRef = useRef<HTMLDivElement>(null)
  const { routeEnter, staggerCards } = useKaapiMotion({ scope: routeRef })

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

  useEffect(() => {
    if (!isLoading && !error && routeRef.current) routeEnter(routeRef.current)
  }, [isLoading, error, routeEnter])

  useEffect(() => {
    const cards = cardListRef.current?.querySelectorAll('.kaapi-motion-card')
    if (cards?.length) staggerCards(cards)
  }, [data, staggerCards])

  if (isLoading) return <LoadingSpinner />
  if (error) return <div className="p-6 text-error">{COPY.brewLogList.loadError}</div>

  const perPage = data?.per_page || 100
  const pageCount = Math.max(1, Math.ceil((data?.total_count ?? 0) / perPage))

  return (
    <TonePageWrapper ref={routeRef} testId="motion-route-boundary" className="p-4 md:p-6 relative">
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
          <span>{COPY.brewLogList.syncAlert}</span>
          <button className="btn btn-sm btn-ghost" onClick={() => setSyncAlertDismissed(true)}>✕</button>
        </div>
      )}
      {!data?.items?.length ? (
        <div data-testid="fresh-household-empty-brew-log">
          <EmptyState
            icon={<span aria-hidden="true" className="text-3xl">☕</span>}
            title={COPY.brewLogList.emptyTitle}
            description={COPY.brewLogList.emptyBody}
          />
        </div>
      ) : (
        <>
          <div ref={cardListRef} data-testid="brew-log-list" className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.items.map((entry) => (
              <ShotCard
                data-testid="brew-log-entry"
                key={entry.shot_id}
                shot={entry}
                variant="list-card"
                onMouseEnter={() => {
                  queryClient.prefetchQuery({
                    queryKey: brewLogDetailQueryKey(entry.shot_id, activeHouseholdId),
                    queryFn: () => getBrewLogDetail(entry.shot_id),
                    staleTime: 60_000,
                  })
                }}
              />
            ))}
          </div>
          <Pagination
            page={page}
            pageCount={pageCount}
            onPageChange={(next) => {
              if (isPlaceholderData) return
              setSearchParams({ page: String(next) })
            }}
            className="mt-4"
          />
        </>
      )}

      {/* Add shot FAB — portalled to document.body so backdrop-filter on #main-content
          does not create a new containing block and break position:fixed */}
      <LogShotAction variant="fab" />
    </TonePageWrapper>
  )
}
