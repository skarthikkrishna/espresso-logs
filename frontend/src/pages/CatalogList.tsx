import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listCatalog } from '../api/catalog'
import { catalogDetailQueryKey, catalogListQueryKey } from '../api/queryKeys'
import LoadingSpinner from '../components/LoadingSpinner'
import AddBeanModal from '../components/AddBeanModal'
import type { CatalogItem } from '../types/entities'
import { useHouseholdQueryScope } from '../contexts/AuthContext'
import { Badge, Button, EmptyState, GlassCard, Input, PageHeader, SectionHeading } from '../components/ui'
import { COPY } from '../copy'
import { useKaapiMotion } from '../lib/motion'

function CatalogCardFigure({ item }: { item: CatalogItem }) {
  const monogram = ((item.roaster || item.bean_name || '?').slice(0, 2)).toUpperCase()
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--kaapi-content-surface-2)]">
      {item.image_path ? (
        <>
          <img
            src={item.image_path}
            alt={item.bean_name}
            className="h-full w-full object-cover"
            onError={(e) => {
              const img = e.currentTarget
              img.style.display = 'none'
              const mono = img.nextElementSibling as HTMLElement | null
              if (mono?.dataset.monogram) mono.style.display = 'flex'
            }}
          />
          <span
            data-monogram="true"
            aria-hidden="true"
            className="absolute inset-0 items-center justify-center font-display text-3xl font-bold text-[var(--kaapi-content-muted)]"
            style={{ display: 'none' }}
          >
            {monogram}
          </span>
        </>
      ) : (
        <span
          data-monogram="true"
          aria-hidden="true"
          className="flex h-full w-full items-center justify-center font-display text-3xl font-bold text-[var(--kaapi-content-muted)]"
        >
          {monogram}
        </span>
      )}
    </div>
  )
}

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
    <div className="p-4 md:p-6">
      <GlassCard variant="content" padding="lg" className="text-center">
        <p className="font-medium">{COPY.catalog.listLoadError}</p>
        <p className="mt-1 text-sm text-[var(--kaapi-content-muted)]">{(error as Error)?.message}</p>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-3">
          Retry
        </Button>
      </GlassCard>
    </div>
  )

  return (
    <div ref={routeRef} data-testid="motion-route-boundary" className="p-4 md:p-6 space-y-6">
      <PageHeader title="Catalog" subtitle="BEANS / INVENTORY" />
      <SectionHeading title={COPY.catalog.library} testId="catalog-section-heading" />

      {data?.length === 0 ? (
        <div data-testid="fresh-household-empty-catalog">
          <EmptyState
            icon={<span aria-hidden="true" className="text-3xl">☕</span>}
            title={COPY.catalog.emptyTitle}
            description={COPY.catalog.emptyBody}
            action={<Button variant="primary" size="sm" onClick={() => setModalOpen(true)}>{COPY.catalog.addCoffee}</Button>}
          />
        </div>
      ) : (
        <>
          <div className="kaapi-content-surface max-w-md p-2.5">
            <Input
              type="text"
              placeholder={COPY.catalog.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={COPY.catalog.searchAria}
            />
          </div>
          {!filtered.length ? (
            <GlassCard variant="content">
              <p className="text-sm text-[var(--kaapi-content-muted)]">{COPY.catalog.noResults}</p>
            </GlassCard>
          ) : (
            <div ref={cardListRef} data-testid="catalog-grid" className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
              {filtered.map((item) => (
                <Link
                  key={item.catalog_id}
                  to={`/catalog/${item.catalog_id}`}
                  data-testid="catalog-card"
                  className="kaapi-motion-card block no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
                >
                  <GlassCard variant="content" padding="none" interactive className="h-full">
                    <CatalogCardFigure item={item} />
                    <div className="min-w-0 p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-[var(--kaapi-content-muted)]">Roaster</p>
                      <h3
                        title={item.roaster}
                        className="truncate font-display text-base font-bold leading-snug text-[var(--kaapi-content-content)]"
                      >
                        {item.roaster}
                      </h3>
                      <p title={item.bean_name} className="truncate text-sm leading-snug text-[var(--kaapi-content-muted)]">
                        {item.bean_name}
                      </p>
                      {item.roast_level && (
                        <Badge tone="neutral" emphasis="solid" className="mt-3 max-w-full">
                          <span className="truncate">{item.roast_level}</span>
                        </Badge>
                      )}
                    </div>
                  </GlassCard>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      {createPortal(
        <Button
          ref={fabRef}
          onClick={() => setModalOpen(true)}
          onMouseDown={() => fabRef.current && pressFeedback(fabRef.current)}
          className="btn-circle fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[var(--mobile-fab-offset)] md:bottom-6 z-50"
          aria-label="Add bean"
          size="lg"
          icon={(
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          )}
        >
          <span className="sr-only">Add bean</span>
        </Button>,
        document.body,
      )}

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
    </div>
  )
}
