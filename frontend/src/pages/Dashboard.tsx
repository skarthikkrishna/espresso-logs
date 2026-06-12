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
import type { BrewLogEntry } from '../types/entities'
import { useAuth, useHouseholdQueryScope } from '../contexts/AuthContext'
import { useKaapiMotion } from '../lib/motion'

export default function Dashboard() {
  const navigate = useNavigate()
  const activeHouseholdId = useHouseholdQueryScope()
  const { activeMembership } = useAuth()
  const routeRef = useRef<HTMLDivElement>(null)
  const cardListRef = useRef<HTMLDivElement>(null)
  const fabRef = useRef<HTMLButtonElement>(null)
  const { routeEnter, staggerCards, fabMount, pressFeedback } = useKaapiMotion({ scope: routeRef })
  const householdName = activeMembership?.household_name ?? 'your household'

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
        <GlassCard key={i} className="animate-pulse">
          <div className="mb-2 h-4 w-3/4 rounded bg-amber-900/40" />
          <div className="h-3 w-1/2 rounded bg-amber-900/30" />
        </GlassCard>
      ))}
    </div>
  )

  if (isError) return (
    <div className="p-4 md:p-6">
      <GlassCard padding="lg" className="text-center">
        <p className="font-medium text-amber-200">Couldn't load dashboard</p>
        <p className="mt-1 text-sm text-amber-400/70">{(error as Error)?.message}</p>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-3 border-amber-600 text-amber-200">
          Retry
        </Button>
      </GlassCard>
    </div>
  )

  const hasBags = Boolean(bags?.length)
  const hasRecentShots = recentShots.length > 0
  const showFreshEmpty = !hasBags && !hasRecentShots

  return (
    <div ref={routeRef} data-testid="motion-route-boundary" className="p-4 md:p-6 space-y-6 md:space-y-8">
      <PageHeader subtitle={`HOME / ${householdName}`} title="Kaapi Kadai" />

      <GlassCard data-testid="dashboard-hero-card" padding="lg" className="overflow-hidden">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.75fr)] lg:items-center">
          <div className="space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300/65">Today at {householdName}</p>
              <h1
                data-testid="dashboard-heading"
                className="mt-3 font-display font-bold leading-[0.92] tracking-tight text-amber-50 drop-shadow-[0_0_24px_rgba(245,158,11,0.16)] [font-size:clamp(2.5rem,14vw,4.25rem)] md:[font-size:clamp(4rem,8vw,6.5rem)]"
              >
                Brew with intention.
              </h1>
            </div>
            <p className="max-w-2xl text-base leading-7 text-amber-100/78 md:text-lg">
              Track active bags, recent shots, and household context from one warm espresso-dark cockpit.
            </p>
            <div className="grid grid-cols-3 gap-2 sm:max-w-lg">
              <div className="rounded-[var(--bevel-radius)] border border-white/10 bg-black/10 p-3">
                <p className="text-3xl font-bold text-amber-50">{bags?.length ?? 0}</p>
                <p className="text-xs uppercase tracking-[0.16em] text-amber-200/55">Active bags</p>
              </div>
              <div className="rounded-[var(--bevel-radius)] border border-white/10 bg-black/10 p-3">
                <p className="text-3xl font-bold text-amber-50">{recentShots.length}</p>
                <p className="text-xs uppercase tracking-[0.16em] text-amber-200/55">Recent</p>
              </div>
              <div className="rounded-[var(--bevel-radius)] border border-white/10 bg-black/10 p-3">
                <p className="text-3xl font-bold text-amber-50">1</p>
                <p className="text-xs uppercase tracking-[0.16em] text-amber-200/55">Household</p>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button variant="primary" onClick={() => navigate('/brew-log/add')}>Log a shot</Button>
              <Button variant="outline" onClick={() => navigate('/catalog')}>Manage catalog</Button>
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
                  title="No coffee data yet"
                  description="Add your first bag or import a CSV to start this household with clean data."
                  action={(
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button variant="primary" size="sm" onClick={() => navigate('/catalog')}>Add your first bag</Button>
                      <Button variant="outline" size="sm" onClick={() => navigate('/import')}>Import CSV</Button>
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
                  interactive
                  className="kaapi-motion-card"
                  onClick={() => navigate(`/brew-log/add?bag_id=${encodeURIComponent(bag.bag_id)}`)}
                >
                  <p className="text-xs uppercase tracking-[0.18em] text-amber-300/55">Ready to brew</p>
                  <p className="mt-2 font-display text-lg font-bold leading-snug text-amber-50">{bag.display_name}</p>
                  {bag.roast_level && <Badge className="mt-3">{bag.roast_level}</Badge>}
                  {bag.days_since_last_shot != null && (
                    <p className="mt-3 text-sm text-amber-200/60">
                      {bag.days_since_last_shot === 0 ? 'Last shot: today' : `Last shot: ${bag.days_since_last_shot}d ago`}
                    </p>
                  )}
                  {bag.last_shot?.dose_in_g && bag.last_shot?.yield_out_g && (
                    <p className="mt-2 font-mono text-sm text-amber-300/80">
                      {bag.last_shot.dose_in_g}g → {bag.last_shot.yield_out_g}g
                    </p>
                  )}
                </GlassCard>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No active bags yet"
              description="Add a bag from your catalog before logging household shots."
              action={<Button variant="primary" size="sm" onClick={() => navigate('/catalog')}>Go to catalog</Button>}
            />
          )}
        </section>

        <section>
          <SectionHeading title="Recent shots" />
          {!hasRecentShots ? (
            <GlassCard className="kaapi-motion-card">
              <p className="text-sm text-amber-200/70">No shots logged yet.</p>
            </GlassCard>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {recentShots.map((shot: BrewLogEntry) => (
                <Link key={shot.shot_id} to={`/brew-log/${shot.shot_id}`} className="kaapi-motion-card block no-underline">
                  <GlassCard interactive className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-amber-100">{shot.bag_display}</p>
                      <p className="text-xs text-amber-200/50">{shot.date}</p>
                    </div>
                    {shot.dose_in_g != null && shot.yield_out_g != null && (
                      <span className="shrink-0 rounded-[var(--bevel-radius)] border border-amber-400/20 bg-amber-500/10 px-2.5 py-1 font-mono text-xs text-amber-200">
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

      <div data-testid="dashboard-final-cta" className="pb-2">
        <GlassCard className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-display text-xl font-bold text-amber-50">Ready for the next shot?</p>
            <p className="text-sm text-amber-200/65">This in-flow action stays clear of the mobile nav stack.</p>
          </div>
          <Button variant="primary" onClick={() => navigate('/brew-log/add')}>Log shot</Button>
        </GlassCard>
      </div>

      {createPortal(
        <Button
          ref={fabRef}
          data-testid="dashboard-fab"
          aria-label="Log a shot"
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
          <span className="sr-only">Log a shot</span>
        </Button>,
        document.body,
      )}
    </div>
  )
}
