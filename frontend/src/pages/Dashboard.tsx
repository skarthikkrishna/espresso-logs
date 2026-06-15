import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { listBrewLog } from '../api/brewLog'
import { getDashboard } from '../api/dashboard'
import { brewLogListQueryKey, dashboardQueryKey } from '../api/queryKeys'
import type { BrewLogPage } from '../api/brewLog'
import DashboardHeroMotion from '../components/motion/DashboardHeroMotion'
import { COPY, LOCKED_LABELS } from '../copy/registry'
import type { BrewLogEntry } from '../types/entities'
import { useAuth, useHouseholdQueryScope } from '../contexts/AuthContext'
import { useKaapiDepth, useKaapiMotion } from '../lib/motion'
import { ToneProvider } from '../contexts/ToneContext'
import {
  EntityCard,
  ImmersiveEmptyState,
  ImmersiveFab,
  ImmersiveListShell,
  ListPageHeader,
  RoastChip,
  SectionHeader,
  ShotRow,
  ShotRowSkeleton,
  StatTile,
  StatTileSkeleton,
  ToneButton,
  ToneToggle,
} from '../components/tone-system'

export default function Dashboard() {
  const navigate = useNavigate()
  const activeHouseholdId = useHouseholdQueryScope()
  const { memberships } = useAuth()
  const routeRef = useRef<HTMLDivElement>(null)
  const cardListRef = useRef<HTMLDivElement>(null)
  const fabRef = useRef<HTMLButtonElement>(null)
  const { routeEnter, staggerCards, fabMount, pressFeedback } = useKaapiMotion({ scope: routeRef })
  const { ref: heroDepthRef, depthProps } = useKaapiDepth<HTMLElement>()

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
    if (!isLoading && !isError && routeRef.current) routeEnter(routeRef.current)
  }, [isLoading, isError, routeEnter])

  useEffect(() => {
    const cards = cardListRef.current?.querySelectorAll('.kaapi-motion-card')
    if (cards?.length) staggerCards(cards)
  }, [bags, recentShots, staggerCards])

  useEffect(() => {
    if (fabRef.current) fabMount(fabRef.current)
  }, [fabMount])

  const householdCount = memberships.length

  const plusIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  )

  if (isLoading) return (
    <ToneProvider>
      <ImmersiveListShell ref={routeRef} testId="motion-route-boundary">
        <div className="immersive-nav-row">
          <ToneToggle />
        </div>
        <ListPageHeader title={COPY.nav.home} titleTestId="dashboard-heading" section="SUMMARY" />
        <div className="dashboard-hero-section">
          <div className="stat-tile-row">
            <StatTileSkeleton />
            <StatTileSkeleton />
            <StatTileSkeleton />
          </div>
        </div>
        <div data-testid="motion-card-list" className="dashboard-sections">
          <section>
            <div className="entity-card-grid">
              {[1, 2, 3].map((i) => (
                <div key={i} className="entity-card--skeleton" aria-hidden="true">
                  <div className="entity-card__skeleton-line" style={{ width: '75%' }} />
                  <div className="entity-card__skeleton-line" style={{ width: '50%' }} />
                </div>
              ))}
            </div>
          </section>
          <section>
            <div className="shot-row-list">
              <ShotRowSkeleton />
              <ShotRowSkeleton />
              <ShotRowSkeleton />
            </div>
          </section>
        </div>
      </ImmersiveListShell>
    </ToneProvider>
  )

  if (isError) return (
    <ToneProvider>
      <ImmersiveListShell ref={routeRef} testId="motion-route-boundary">
        <div className="immersive-nav-row">
          <ToneToggle />
        </div>
        <ImmersiveEmptyState
          title={COPY.dashboard.loadError}
          description={(error as Error)?.message}
          action={
            <ToneButton variant="edit" onClick={() => refetch()}>
              {COPY.actions.retry}
            </ToneButton>
          }
        />
      </ImmersiveListShell>
    </ToneProvider>
  )

  const hasBags = Boolean(bags?.length)
  const hasRecentShots = recentShots.length > 0
  const showFreshEmpty = !hasBags && !hasRecentShots

  return (
    <ToneProvider>
      <ImmersiveListShell ref={routeRef} testId="motion-route-boundary">
        <div className="immersive-nav-row">
          <ToneToggle />
        </div>

        <ListPageHeader
          title={COPY.nav.home}
          titleTestId="dashboard-heading"
          section="SUMMARY"
        />

        {/* Hero zone: stats + viz + actions directly on frost — no glass card wrapper */}
        <section
          ref={heroDepthRef}
          {...depthProps}
          data-testid="dashboard-hero-card"
          className="dashboard-hero-section"
        >
          <div className="stat-tile-row">
            <StatTile value={bags?.length ?? 0} label="Active bags" />
            <StatTile value={recentShots.length} label="Recent" />
            <StatTile value={householdCount} label="Household" />
          </div>

          <DashboardHeroMotion maxHeight={240} />

          <div className="hero-actions">
            <ToneButton variant="primary" onClick={() => navigate('/brew-log/add')}>
              {LOCKED_LABELS.logAShot}
            </ToneButton>
            <ToneButton variant="edit" onClick={() => navigate('/catalog')}>
              {COPY.dashboard.manageCatalog}
            </ToneButton>
          </div>
        </section>

        {/* Card list: active bags + recent shots */}
        <div ref={cardListRef} data-testid="motion-card-list" className="dashboard-sections">
          <section>
            <SectionHeader testId="dashboard-active-bags-heading">Active bags</SectionHeader>

            {showFreshEmpty ? (
              <div data-testid="dashboard-empty-state">
                <div data-testid="fresh-household-empty-dashboard">
                  <ImmersiveEmptyState
                    icon={<span aria-hidden="true" className="text-3xl">☕</span>}
                    title={COPY.dashboard.emptyTitle}
                    description={COPY.dashboard.emptyBody}
                    action={
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <ToneButton variant="primary" onClick={() => navigate('/catalog')}>
                          {COPY.dashboard.addFirstBag}
                        </ToneButton>
                        <ToneButton variant="edit" onClick={() => navigate('/import')}>
                          {COPY.dashboard.importCsv}
                        </ToneButton>
                      </div>
                    }
                  />
                </div>
              </div>
            ) : hasBags ? (
              <div className="entity-card-grid">
                {bags?.map((bag) => {
                  const hasMeta = bag.days_since_last_shot != null
                    || (bag.last_shot?.dose_in_g != null && bag.last_shot?.yield_out_g != null)
                  const meta = hasMeta ? (
                    <span>
                      {bag.days_since_last_shot != null && (
                        bag.days_since_last_shot === 0 ? 'Today' : `${bag.days_since_last_shot}d ago`
                      )}
                      {bag.days_since_last_shot != null
                        && bag.last_shot?.dose_in_g != null
                        && bag.last_shot?.yield_out_g != null
                        && ' · '}
                      {bag.last_shot?.dose_in_g != null && bag.last_shot?.yield_out_g != null && (
                        `${bag.last_shot.dose_in_g}g → ${bag.last_shot.yield_out_g}g`
                      )}
                    </span>
                  ) : undefined

                  return (
                    <EntityCard
                      key={bag.bag_id}
                      href={`/brew-log/add?bag_id=${encodeURIComponent(bag.bag_id)}`}
                      eyebrow={COPY.dashboard.readyToBrew}
                      title={bag.display_name}
                      chip={bag.roast_level ? <RoastChip level={bag.roast_level} /> : undefined}
                      meta={meta}
                    />
                  )
                })}
              </div>
            ) : (
              <ImmersiveEmptyState
                title={COPY.dashboard.noActiveBagsTitle}
                description={COPY.dashboard.noActiveBagsBody}
                action={
                  <ToneButton variant="primary" onClick={() => navigate('/catalog')}>
                    {COPY.dashboard.goToCatalog}
                  </ToneButton>
                }
              />
            )}
          </section>

          <section>
            <SectionHeader>Recent shots</SectionHeader>

            {!hasRecentShots ? (
              <ImmersiveEmptyState title={COPY.dashboard.noShots} />
            ) : (
              <div className="shot-row-list">
                {recentShots.map((shot: BrewLogEntry) => (
                  <ShotRow
                    key={shot.shot_id}
                    href={`/brew-log/${shot.shot_id}`}
                    bagName={shot.bag_display}
                    date={shot.date}
                    doseYield={
                      shot.dose_in_g != null && shot.yield_out_g != null
                        ? `${shot.dose_in_g}g → ${shot.yield_out_g}g`
                        : undefined
                    }
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        <ImmersiveFab
          ref={fabRef}
          data-testid="dashboard-fab"
          label={LOCKED_LABELS.logAShot}
          onClick={() => navigate('/brew-log/add')}
          onMouseDown={() => fabRef.current && pressFeedback(fabRef.current)}
          icon={plusIcon}
        />
      </ImmersiveListShell>
    </ToneProvider>
  )
}
