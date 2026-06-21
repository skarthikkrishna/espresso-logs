import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listCatalog } from '../api/catalog'
import { catalogDetailQueryKey, catalogListQueryKey } from '../api/queryKeys'
import LoadingSpinner from '../components/LoadingSpinner'
import AddBeanModal from '../components/AddBeanModal'
import type { CatalogItem } from '../types/entities'
import { useHouseholdQueryScope } from '../contexts/AuthContext'
import { COPY } from '../copy'
import { useKaapiMotion } from '../lib/motion'
import { ToneProvider } from '../contexts/ToneContext'
import {
  AddBeanAction,
  EntityCard,
  ImmersiveEmptyState,
  ImmersiveListShell,
  ListPageHeader,
  RoastChip,
  ToneToggle,
  ToneButton,
} from '../components/tone-system'

export default function CatalogList() {
  const [search, setSearch] = useState('')
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const activeHouseholdId = useHouseholdQueryScope()
  const routeRef = useRef<HTMLDivElement>(null)
  const cardListRef = useRef<HTMLDivElement>(null)
  const fabRef = useRef<HTMLButtonElement>(null)
  const { routeEnter, staggerCards, fabMount, pressFeedback } = useKaapiMotion({ scope: routeRef })

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: catalogListQueryKey(activeHouseholdId),
    queryFn: listCatalog,
  })

  const filtered = (data ?? []).filter(
    (item) =>
      item.roaster.toLowerCase().includes(search.toLowerCase()) ||
      item.bean_name.toLowerCase().includes(search.toLowerCase()),
  )

  useEffect(() => {
    if (!isLoading && !isError && routeRef.current) routeEnter(routeRef.current)
  }, [isLoading, isError, routeEnter])

  useEffect(() => {
    const cards = cardListRef.current?.querySelectorAll('.kaapi-motion-card')
    if (cards?.length) staggerCards(cards)
  }, [filtered.length, staggerCards])

  useEffect(() => {
    if (fabRef.current) fabMount(fabRef.current)
  }, [fabMount])

  if (isLoading) return <LoadingSpinner />

  if (isError) return (
    <ToneProvider>
      <ImmersiveListShell ref={routeRef} testId="motion-route-boundary">
        <div className="immersive-nav-row">
          <ToneToggle />
        </div>
        <div className="immersive-error-card">
          <p className="immersive-error-message">{COPY.catalog.listLoadError}</p>
          <p className="immersive-error-detail">{(error as Error)?.message}</p>
          <ToneButton variant="edit" onClick={() => refetch()}>Retry</ToneButton>
        </div>
      </ImmersiveListShell>
    </ToneProvider>
  )

  return (
    <ToneProvider>
      <ImmersiveListShell ref={routeRef} testId="motion-route-boundary">
        {/* Nav row — tone toggle only (no back-link on list page) */}
        <div className="immersive-nav-row">
          <ToneToggle />
        </div>

        <ListPageHeader
          title="Catalog"
          section="BEANS / INVENTORY"
          sectionTestId="catalog-section-heading"
        />

        {data?.length === 0 ? (
          <div data-testid="fresh-household-empty-catalog">
            <ImmersiveEmptyState
              icon={<span aria-hidden="true">☕</span>}
              title={COPY.catalog.emptyTitle}
              description={COPY.catalog.emptyBody}
              action={
               <AddBeanAction variant="empty" onAdd={() => setModalOpen(true)} />
              }
            />
          </div>
        ) : (
          <>
            <div className="immersive-search-wrapper">
              <input
                type="text"
                className="immersive-search-input"
                placeholder={COPY.catalog.searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label={COPY.catalog.searchAria}
              />
            </div>

            {!filtered.length ? (
              <ImmersiveEmptyState title={COPY.catalog.noResults} />
            ) : (
              <div ref={cardListRef} data-testid="catalog-grid" className="entity-card-grid">
                {filtered.map((item) => (
                  <EntityCard
                    key={item.catalog_id}
                    href={`/catalog/${item.catalog_id}`}
                    title={item.bean_name}
                    eyebrow={item.roaster}
                    imageUrl={item.image_path ?? undefined}
                    chip={item.roast_level ? <RoastChip level={item.roast_level} /> : undefined}
                    data-testid="catalog-card"
                  />
                ))}
              </div>
            )}
          </>
        )}

        <AddBeanAction
          variant="fab"
          ref={fabRef}
          onAdd={() => setModalOpen(true)}
          onMouseDown={() => fabRef.current && pressFeedback(fabRef.current)}
        />

        {modalOpen && (
          <AddBeanModal
            onClose={() => setModalOpen(false)}
            onSaved={(savedItem?: CatalogItem) => {
              if (savedItem) {
                queryClient.setQueryData<CatalogItem[]>(catalogListQueryKey(activeHouseholdId), (old) => {
                  if (!old) return [savedItem]
                  return old.some((item) => item.catalog_id === savedItem.catalog_id)
                    ? old.map((item) => item.catalog_id === savedItem.catalog_id ? { ...item, ...savedItem } : item)
                    : [savedItem, ...old]
                })
                queryClient.invalidateQueries({ queryKey: catalogDetailQueryKey(savedItem.catalog_id, activeHouseholdId) })
              }
              queryClient.invalidateQueries({ queryKey: catalogListQueryKey(activeHouseholdId) })
            }}
          />
        )}
      </ImmersiveListShell>
    </ToneProvider>
  )
}
