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
import { useKaapiMotion } from '../lib/motion'

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
    if (routeRef.current) routeEnter(routeRef.current)
  }, [routeEnter])

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
      <GlassCard padding="lg" className="text-center">
        <p className="font-medium text-amber-200">Couldn't load catalog</p>
        <p className="mt-1 text-sm text-amber-400/70">{(error as Error)?.message}</p>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-3 border-amber-600 text-amber-200">
          Retry
        </Button>
      </GlassCard>
    </div>
  )

  return (
    <div ref={routeRef} data-testid="motion-route-boundary" className="p-4 md:p-6 space-y-6">
      <PageHeader title="Catalog" subtitle="BEANS / INVENTORY" />
      <SectionHeading title="Coffee library" testId="catalog-section-heading" />

      {data?.length === 0 ? (
        <div data-testid="fresh-household-empty-catalog">
          <EmptyState
            icon={<span aria-hidden="true" className="text-3xl">☕</span>}
            title="No beans in catalog yet"
            description="Add the first coffee this household brews. Fresh households start empty."
            action={<Button variant="primary" size="sm" onClick={() => setModalOpen(true)}>Add coffee</Button>}
          />
        </div>
      ) : (
        <>
          <GlassCard padding="sm" className="max-w-md">
            <Input
              type="text"
              placeholder="Search roaster or bean…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search catalog"
              className="placeholder-amber-200/40"
            />
          </GlassCard>
          {!filtered.length ? (
            <GlassCard>
              <p className="text-sm text-amber-200/70">No results found.</p>
            </GlassCard>
          ) : (
            <div ref={cardListRef} data-testid="catalog-grid" className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
              {filtered.map((item) => (
                <Link
                  key={item.catalog_id}
                  to={`/catalog/${item.catalog_id}`}
                  data-testid="catalog-card"
                  className="kaapi-motion-card liquid-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
                >
                  <div className="liquid-card-figure">
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
                          className="liquid-card-monogram"
                          style={{ display: 'none', alignItems: 'center', justifyContent: 'center' }}
                        >
                          {((item.roaster || item.bean_name || '?').slice(0, 2)).toUpperCase()}
                        </span>
                      </>
                    ) : (
                      <span data-monogram="true" aria-hidden="true" className="liquid-card-monogram">
                        {((item.roaster || item.bean_name || '?').slice(0, 2)).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="liquid-card-body">
                    <p className="text-xs uppercase tracking-[0.16em] text-amber-300/50">Roaster</p>
                    <h3 className="truncate font-display text-base font-bold leading-snug text-amber-100">
                      {item.roaster}
                    </h3>
                    <p className="truncate text-sm leading-snug text-amber-200/60">
                      {item.bean_name}
                    </p>
                    {item.roast_level && <Badge className="mt-3">{item.roast_level}</Badge>}
                  </div>
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
