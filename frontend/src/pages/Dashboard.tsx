import { useEffect, useRef, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { listBrewLog } from '../api/brewLog'
import { getDashboard } from '../api/dashboard'
import { brewLogListQueryKey, dashboardQueryKey } from '../api/queryKeys'
import type { BrewLogPage } from '../api/brewLog'
import { COPY } from '../copy/registry'
import type { BrewLogEntry } from '../types/entities'
import { useAuth, useHouseholdQueryScope } from '../contexts/AuthContext'
import { useKaapiMotion } from '../lib/motion'
import { ToneProvider } from '../contexts/ToneContext'
import {
  AddBagAction,
  BagCard,
  ImmersiveEmptyState,
  ImmersiveListShell,
  ListPageHeader,
  LogShotAction,
  SectionHeader,
  ShotCard,
  ShotRowSkeleton,
  StatTile,
  StatTileSkeleton,
  ToneButton,
  ToneToggle,
} from '../components/tone-system'

function HomeWordmark() {
  const [kaapi, kadai] = COPY.shell.brand.split(' ')
  return (
    <span className="kk-home-wordmark" aria-label={COPY.shell.brand}>
      <span className="kk-home-wordmark__line kk-home-wordmark__kaapi">{kaapi}</span>
      <span className="kk-home-wordmark__line kk-home-wordmark__kadai">{kadai}</span>
    </span>
  )
}


function HomeHeroHeader() {
  return (
    <ListPageHeader
      title={<HomeWordmark />}
      section="Personal Shot Journal"
      titleTestId="dashboard-heading"
      className="dashboard-page-header"
    />
  )
}

function DashboardStatsPanel({ children }: { children: ReactNode }) {
  return (
    <div
      className="dashboard-stats-panel dashboard-stats-panel--underbar"
      aria-label={COPY.dashboard.summaryAria}
    >
      {children}
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const activeHouseholdId = useHouseholdQueryScope()
  const { memberships } = useAuth()
  const routeRef = useRef<HTMLDivElement>(null)
  const cardListRef = useRef<HTMLDivElement>(null)
  const { routeEnter, staggerCards } = useKaapiMotion({ scope: routeRef })

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

  const householdCount = memberships.length
  const heroGridClass = 'dashboard-hero-grid dashboard-hero-grid--stats-underbar'

  if (isLoading) return (
    <ToneProvider>
      <ImmersiveListShell ref={routeRef} testId="motion-route-boundary" className="dashboard-home">
        <div className="immersive-nav-row">
          <ToneToggle />
        </div>
        <div className={heroGridClass}>
          <div className="dashboard-hero-copy">
            <HomeHeroHeader />
            <DashboardStatsPanel>
              <StatTileSkeleton />
              <StatTileSkeleton />
              <StatTileSkeleton />
            </DashboardStatsPanel>
          </div>
        </div>
        <div className="dashboard-layout">
          <div className="dashboard-rails">
            <section data-testid="dashboard-hero-card" className="dashboard-card-section dashboard-card-section--active">
              <SectionHeader testId="dashboard-active-bags-heading">Active bags</SectionHeader>
              <div className="dashboard-fit-rail dashboard-fit-rail--bags entity-card-grid">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="entity-card--skeleton" aria-hidden="true">
                    <div className="entity-card__skeleton-line" style={{ width: '75%' }} />
                    <div className="entity-card__skeleton-line" style={{ width: '50%' }} />
                  </div>
                ))}
              </div>
            </section>
            <section className="dashboard-card-section dashboard-card-section--recent">
              <SectionHeader>Recent shots</SectionHeader>
              <div className="dashboard-fit-rail dashboard-fit-rail--shots shot-row-list">
                {[1, 2, 3, 4, 5].map((i) => (
                  <ShotRowSkeleton key={i} />
                ))}
              </div>
            </section>
          </div>
        </div>
      </ImmersiveListShell>
    </ToneProvider>
  )

  if (isError) return (
    <ToneProvider>
      <ImmersiveListShell ref={routeRef} testId="motion-route-boundary" className="dashboard-home">
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
  const allBagsRoute = '/catalog'

  return (
    <ToneProvider>
      <ImmersiveListShell ref={routeRef} testId="motion-route-boundary" className="dashboard-home">
        <div className="immersive-nav-row">
          <ToneToggle />
        </div>

        <div className={heroGridClass}>
          <div className="dashboard-hero-copy">
            <HomeHeroHeader />
            <div className="hero-actions">
              <LogShotAction variant="hero" />
              <ToneButton variant="edit" onClick={() => navigate('/catalog')}>
                {COPY.dashboard.manageCatalog}
              </ToneButton>
            </div>
            <DashboardStatsPanel>
              <StatTile value={bags?.length ?? 0} label="Active bags" />
              <StatTile value={recentShots.length} label="Recent" />
              <StatTile value={householdCount} label="Household" />
            </DashboardStatsPanel>
          </div>
        </div>

        <div className="dashboard-layout">
          <div ref={cardListRef} className="dashboard-rails" data-testid="motion-card-list">
            <section
              data-testid="dashboard-hero-card"
              className="dashboard-card-section dashboard-card-section--active"
            >
              <div className="dashboard-section-header-row">
                <SectionHeader testId="dashboard-active-bags-heading">Active bags</SectionHeader>
                <Link className="dashboard-view-all-link" to={allBagsRoute}>{COPY.dashboard.viewAll}</Link>
              </div>
              {showFreshEmpty ? (
                <div data-testid="dashboard-empty-state">
                  <div data-testid="fresh-household-empty-dashboard">
                    <ImmersiveEmptyState
                      icon={<span aria-hidden="true" className="text-3xl">☕</span>}
                      title={COPY.dashboard.emptyTitle}
                      description={COPY.dashboard.emptyBody}
                      action={
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <AddBagAction variant="empty" />
                          <ToneButton variant="edit" onClick={() => navigate('/import')}>
                            {COPY.dashboard.importCsv}
                          </ToneButton>
                        </div>
                      }
                    />
                  </div>
                </div>
              ) : hasBags ? (
                <div className="bag-card-stack dashboard-fit-rail dashboard-fit-rail--bags dashboard-entity-card-stack">
                  {bags?.map((bag) => {
                    return (
                      <BagCard
                        key={bag.bag_id}
                        bag={bag}
                        variant="card"
                      />
                    )
                  })}
                </div>
              ) : (
                <ImmersiveEmptyState
                  title={COPY.dashboard.noActiveBagsTitle}
                  description={COPY.dashboard.noActiveBagsBody}
                  action={
                    <AddBagAction variant="empty" />
                  }
                />
              )}
            </section>
            <section className="dashboard-card-section dashboard-card-section--recent">
              <div className="dashboard-section-header-row">
                <SectionHeader>Recent shots</SectionHeader>
                <Link className="dashboard-view-all-link" to="/brew-log">{COPY.dashboard.viewAll}</Link>
              </div>

              {!hasRecentShots ? (
                <ImmersiveEmptyState title={COPY.dashboard.noShots} />
              ) : (
                <div className="shot-row-list dashboard-fit-rail dashboard-fit-rail--shots dashboard-entity-card-stack">
                  {recentShots.map((shot: BrewLogEntry) => (
                    <ShotCard
                      key={shot.shot_id}
                      shot={shot}
                      variant="summary"
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </ImmersiveListShell>
    </ToneProvider>
  )
}
