import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { listBrewLog } from '../api/brewLog'
import { getDashboard } from '../api/dashboard'
import { brewLogListQueryKey, dashboardQueryKey } from '../api/queryKeys'
import type { BrewLogPage } from '../api/brewLog'
import DashboardHeroMotion from '../components/motion/DashboardHeroMotion'
import { Badge, Button, EmptyState, GlassCard, PageHeader, SectionHeading } from '../components/ui'
import { COPY, LOCKED_LABELS } from '../copy/registry'
import type { BrewLogEntry } from '../types/entities'
import { useAuth, useHouseholdQueryScope } from '../contexts/AuthContext'
import { useKaapiMotion } from '../lib/motion'

export default function Dashboard() {
  const navigate = useNavigate()
  const activeHouseholdId = useHouseholdQueryScope()
  const { memberships } = useAuth()
  const routeRef = useRef<HTMLDivElement>(null)
  const cardListRef = useRef<HTMLDivElement>(null)
  const fabRef = useRef<HTMLButtonElement>(null)
  const { routeEnter, staggerCards, fabMount, pressFeedback } = useKaapiMotion({ scope: routeRef })

  const { data: bags, isLoading, isError, error, refetch } = useQuery({
    queryKey: dashboardQueryKey(activeHouseholdId),
    queryFn: getDashboard,
  })

  const { data: recentShots = [] } = useQuery({
    queryKey: brewLogListQueryKey(activeHouseholdId, 1, 5),
    queryFn: () => listBrewLog(1, 5),
    select: (page: BrewLogPage) => page.items.slice(0, 5),
  })

  useEffect(() => {
    if (routeRef.current) routeEnter(routeRef.current)
  }, [routeEnter])

  useEffect(() => {
    const cards = cardListRef.current?.querySelectorAll('.kaapi-motion-card')
    if (cards?.length) staggerCards(cards)
  }, [bags, recentShots, staggerCards])

  useEffect(() => {
    if (fabRef.current) fabMount(fabRef.current)
  }, [fabMount])

  if (isLoading) return (
    <div className="p-4 md:p-6 space-y-3" data-testid="motion-card-list">
      {[1, 2, 3].map((i) => (
        <GlassCard key={i} variant="content" className="animate-pulse">
          <div className="mb-2 h-4 w-3/4 rounded bg-[var(--kaapi-content-border)]" />
          <div className="h-3 w-1/2 rounded bg-[var(--kaapi-content-border)]" />
        </GlassCard>
      ))}
    </div>
  )

  if (isError) return (
    <div className="p-4 md:p-6">
      <GlassCard variant="content" padding="lg" className="text-center">
        <p className="font-medium">{COPY.dashboard.loadError}</p>
        <p className="mt-1 text-sm text-[var(--kaapi-content-muted)]">{(error as Error)?.message}</p>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-3">
          {COPY.actions.retry}
        </Button>
      </GlassCard>
    </div>
  )

  const hasBags = Boolean(bags?.length)
  const hasRecentShots = recentShots.length > 0
  const showFreshEmpty = !hasBags && !hasRecentShots
  const householdCount = memberships.length

  return (
    <div ref={routeRef} data-testid="motion-route-boundary" className="p-4 md:p-6 space-y-6 md:space-y-8">
      <PageHeader title={COPY.nav.home} testId="dashboard-heading" />

      <GlassCard variant="content" data-testid="dashboard-hero-card" padding="lg" className="overflow-hidden">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.75fr)] lg:items-center">
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-2 sm:max-w-lg">
              <div className="kaapi-content-surface kaapi-content-surface--elevated p-3">
                <p className="text-3xl font-bold">{bags?.length ?? 0}</p>
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--kaapi-content-muted)]">Active bags</p>
              </div>
              <div className="kaapi-content-surface kaapi-content-surface--elevated p-3">
                <p className="text-3xl font-bold">{recentShots.length}</p>
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--kaapi-content-muted)]">{COPY.dashboard.recent}</p>
              </div>
              <div className="kaapi-content-surface kaapi-content-surface--elevated p-3">
                <p className="text-3xl font-bold">{householdCount}</p>
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--kaapi-content-muted)]">{COPY.household.label}</p>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button variant="primary" onClick={() => navigate('/brew-log/add')}>{LOCKED_LABELS.logAShot}</Button>
              <Button variant="outline" onClick={() => navigate('/catalog')}>{COPY.dashboard.manageCatalog}</Button>
            </div>
          </div>
          <DashboardHeroMotion maxHeight={240} />
        </div>
      </GlassCard>

      <div ref={cardListRef} data-testid="motion-card-list" className="space-y-6">
        <section>
          <SectionHeading title="Active bags" testId="dashboard-active-bags-heading" />
          {showFreshEmpty ? (
            <div data-testid="dashboard-empty-state">
              <div data-testid="fresh-household-empty-dashboard">
                <EmptyState
                  icon={<span aria-hidden="true" className="text-3xl">☕</span>}
                  title={COPY.dashboard.emptyTitle}
                  description={COPY.dashboard.emptyBody}
                  action={(
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button variant="primary" size="sm" onClick={() => navigate('/catalog')}>{COPY.dashboard.addFirstBag}</Button>
                      <Button variant="outline" size="sm" onClick={() => navigate('/import')}>{COPY.dashboard.importCsv}</Button>
                    </div>
                  )}
                />
              </div>
            </div>
          ) : hasBags ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {bags?.map((bag) => (
                <GlassCard
                  key={bag.bag_id}
                  variant="content"
                  interactive
                  className="kaapi-motion-card"
                  onClick={() => navigate(`/brew-log/add?bag_id=${encodeURIComponent(bag.bag_id)}`)}
                >
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--kaapi-content-muted)]">{COPY.dashboard.readyToBrew}</p>
                  <p className="mt-2 font-display text-lg font-bold leading-snug">{bag.display_name}</p>
                  {bag.roast_level && <Badge tone="neutral" emphasis="solid" className="mt-3">{bag.roast_level}</Badge>}
                  {bag.days_since_last_shot != null && (
                    <p className="mt-3 text-sm text-[var(--kaapi-content-muted)]">
                      {bag.days_since_last_shot === 0 ? 'Last shot: today' : `Last shot: ${bag.days_since_last_shot}d ago`}
                    </p>
                  )}
                  {bag.last_shot?.dose_in_g && bag.last_shot?.yield_out_g && (
                    <p className="mt-2 font-mono text-sm">
                      {bag.last_shot.dose_in_g}g → {bag.last_shot.yield_out_g}g
                    </p>
                  )}
                </GlassCard>
              ))}
            </div>
          ) : (
            <EmptyState
              title={COPY.dashboard.noActiveBagsTitle}
              description={COPY.dashboard.noActiveBagsBody}
              action={<Button variant="primary" size="sm" onClick={() => navigate('/catalog')}>{COPY.dashboard.goToCatalog}</Button>}
            />
          )}
        </section>

        <section>
          <SectionHeading title="Recent shots" />
          {!hasRecentShots ? (
            <GlassCard variant="content" className="kaapi-motion-card">
              <p className="text-sm text-[var(--kaapi-content-muted)]">{COPY.dashboard.noShots}</p>
            </GlassCard>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {recentShots.map((shot: BrewLogEntry) => (
                <Link key={shot.shot_id} to={`/brew-log/${shot.shot_id}`} className="kaapi-motion-card block no-underline">
                  <GlassCard variant="content" interactive className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{shot.bag_display}</p>
                      <p className="text-xs text-[var(--kaapi-content-muted)]">{shot.date}</p>
                    </div>
                    {shot.dose_in_g != null && shot.yield_out_g != null && (
                      <span className="shrink-0 rounded-[var(--bevel-radius)] bg-[var(--kaapi-content-surface-2)] px-2.5 py-1 font-mono text-xs text-[var(--kaapi-content-muted)]">
                        {shot.dose_in_g}g → {shot.yield_out_g}g
                      </span>
                    )}
                  </GlassCard>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      {createPortal(
        <Button
          ref={fabRef}
          data-testid="dashboard-fab"
          aria-label={LOCKED_LABELS.logAShot}
          className="btn-circle fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[var(--mobile-fab-offset)] z-50 lg:hidden"
          size="lg"
          variant="primary"
          onMouseDown={() => fabRef.current && pressFeedback(fabRef.current)}
          onClick={() => navigate('/brew-log/add')}
          icon={(
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          )}
        >
          <span className="sr-only">{LOCKED_LABELS.logAShot}</span>
        </Button>,
        document.body,
      )}
    </div>
  )
}
