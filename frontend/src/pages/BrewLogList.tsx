import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { brewLogDetailQueryKey, listBrewLog, getBrewLogDetail } from '../api/brewLog'
import { brewLogListQueryKey } from '../api/queryKeys'
import Pagination from '../components/ui/Pagination'
import { useHouseholdQueryScope } from '../contexts/AuthContext'
import { ToneProvider } from '../contexts/ToneContext'
import { useKaapiMotion } from '../lib/motion'
import { COPY } from '../copy'
import {
  ImmersiveEmptyState,
  ImmersiveListShell,
  ListPageHeader,
  LogShotAction,
  ShotCard,
  ShotRowSkeleton,
  ToneButton,
  ToneStateCard,
  ToneToggle,
} from '../components/tone-system'

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
  const fabRef = useRef<HTMLButtonElement>(null)
  const { routeEnter, staggerCards, fabMount, pressFeedback } = useKaapiMotion({ scope: routeRef })

  const { data, isLoading, isPlaceholderData, error, refetch } = useQuery({
    queryKey: brewLogListQueryKey(activeHouseholdId, page, 100),
    queryFn: () => listBrewLog(page, 100),
    placeholderData: keepPreviousData,
  })

  useEffect(() => {
    if (toastParam === 'shot-saved') {
      /* eslint-disable react-hooks/set-state-in-effect -- URL-to-state bridge: setSearchParams clears the trigger param in the same batch so toastParam is null on the next render; no cascade risk. */
      setToast(COPY.brewLogList.shotSaved)
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

  useEffect(() => {
    if (fabRef.current) fabMount(fabRef.current)
  }, [fabMount])

  const perPage = data?.per_page || 100
  const pageCount = Math.max(1, Math.ceil((data?.total_count ?? 0) / perPage))

  return (
    <ImmersiveListShell ref={routeRef} testId="motion-route-boundary" className="brew-log-list-page">
      <div className="immersive-nav-row">
        <ToneToggle />
      </div>

      <ListPageHeader
        title={COPY.nav.brewLog}
        section="SHOTS / HISTORY"
        sectionTestId="brew-log-section-heading"
      />

      {toast && createPortal(
        <ToneStateCard
          state="success"
          title={toast}
          compact
          live
          className="tone-state-toast"
          action={
            <ToneButton variant="ghost" onClick={() => setToast(null)} aria-label="✕">
              ✕
            </ToneButton>
          }
        />,
        document.body
      )}

      {data?.sync_alert && !syncAlertDismissed && (
        <ToneStateCard
          state="warning"
          title={COPY.brewLogList.syncAlertTitle}
          message={COPY.brewLogList.syncAlert}
          compact
          action={
            <ToneButton variant="ghost" onClick={() => setSyncAlertDismissed(true)} aria-label="✕">
              ✕
            </ToneButton>
          }
        />
      )}

      {isLoading ? (
        <ToneStateCard state="loading" title={COPY.brewLogList.loading} live>
          <div className="shot-row-list brew-log-loading-list" aria-hidden="true">
            {[1, 2, 3].map((i) => (
              <ShotRowSkeleton key={i} />
            ))}
          </div>
        </ToneStateCard>
      ) : error ? (
        <ToneStateCard
          state="error"
          title={COPY.brewLogList.loadError}
          message={COPY.brewLogList.retryBody}
          action={
            <ToneButton variant="edit" onClick={() => refetch()}>
              {COPY.actions.retry}
            </ToneButton>
          }
        />
      ) : !data?.items?.length ? (
        <div data-testid="fresh-household-empty-brew-log">
          <ImmersiveEmptyState
            icon={<span aria-hidden="true" className="text-3xl">☕</span>}
            title={COPY.brewLogList.emptyTitle}
            description={COPY.brewLogList.emptyBody}
            action={<LogShotAction variant="empty" />}
          />
        </div>
      ) : (
        <>
          <div ref={cardListRef} data-testid="brew-log-list" className="brew-log-card-grid">
            {data.items.map((entry) => (
              <ShotCard
                data-testid="brew-log-entry"
                key={entry.shot_id}
                shot={entry}
                variant="summary"
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
          />
        </>
      )}

      <LogShotAction
        variant="fab"
        ref={fabRef}
        onMouseDown={() => fabRef.current && pressFeedback(fabRef.current)}
      />
    </ImmersiveListShell>
  )
}
