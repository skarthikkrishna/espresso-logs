import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getHardwareDetail, listHardware } from '../api/hardware'
import LoadingSpinner from '../components/LoadingSpinner'
import AddHardwareModal from '../components/AddHardwareModal'
import LogMaintenanceModal from '../components/LogMaintenanceModal'
import EditHardwareModal from '../components/EditHardwareModal'
import { Badge, Button, EmptyState, GlassCard, PageHeader, SectionHeading } from '../components/ui'
import type { HardwareItem } from '../types/entities'
import { useHouseholdQueryScope } from '../contexts/AuthContext'
import { householdKeys } from '../api/queryKeys'
import { useKaapiMotion } from '../lib/motion'

function HardwareIcon({ category }: { category: string }) {
  if (category === 'Machine') return (
    <svg xmlns="http://www.w3.org/2000/svg" className="liquid-card-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  )
  if (category === 'Grinder') return (
    <svg xmlns="http://www.w3.org/2000/svg" className="liquid-card-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
    </svg>
  )
  if (category === 'Storage') return (
    <svg xmlns="http://www.w3.org/2000/svg" className="liquid-card-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
    </svg>
  )
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="liquid-card-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
      <circle cx="12" cy="12" r="3" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 2v3m0 14v3M2 12h3m14 0h3" />
    </svg>
  )
}

const CATEGORY_ORDER: HardwareItem['category'][] = ['Machine', 'Grinder', 'Basket', 'Storage']

export default function HardwarePage() {
  const activeHouseholdId = useHouseholdQueryScope()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [addModal, setAddModal] = useState<{ open: boolean; initialCategory?: HardwareItem['category'] }>({ open: false })
  const [logModal, setLogModal] = useState<{ open: boolean; hardware?: HardwareItem }>({ open: false })
  const [editModal, setEditModal] = useState<{ open: boolean; hardware?: HardwareItem }>({ open: false })
  const routeRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const detailRef = useRef<HTMLDivElement>(null)
  const { routeEnter, staggerCards, detailOnSelect, pressFeedback } = useKaapiMotion({ scope: routeRef })

  const { data: hardware, isLoading, isError, error, refetch } = useQuery({
    queryKey: householdKeys.hardware(activeHouseholdId),
    queryFn: listHardware,
  })

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: householdKeys.hardwareDetail(activeHouseholdId, selectedId),
    queryFn: () => getHardwareDetail(selectedId!),
    enabled: !!selectedId,
  })

  useEffect(() => {
    if (routeRef.current) routeEnter(routeRef.current)
  }, [routeEnter])

  useEffect(() => {
    const cards = gridRef.current?.querySelectorAll('.kaapi-motion-card')
    if (cards?.length) staggerCards(cards)
  }, [hardware, staggerCards])

  useEffect(() => {
    if (!selectedId || !detailRef.current) return
    detailOnSelect(detailRef.current)
    detailRef.current.focus()
  }, [detailOnSelect, selectedId, detail])

  const closeDetail = () => {
    const selectedButton = selectedId ? document.querySelector<HTMLElement>(`[data-hardware-id="${selectedId}"]`) : null
    setSelectedId(null)
    requestAnimationFrame(() => selectedButton?.focus())
  }

  if (isLoading) return <LoadingSpinner />
  if (isError) return (
    <div className="p-4 md:p-6">
      <GlassCard padding="lg" className="text-center">
        <p className="text-lg font-semibold text-amber-200">Couldn't load hardware</p>
        <p className="mt-2 text-sm text-amber-400/70">{(error as Error)?.message}</p>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-4 border-amber-600 text-amber-200">Retry</Button>
      </GlassCard>
    </div>
  )

  const grouped = CATEGORY_ORDER.reduce<Record<HardwareItem['category'], HardwareItem[]>>((acc, cat) => {
    acc[cat] = (hardware ?? []).filter((h) => h.category === cat)
    return acc
  }, { Machine: [], Grinder: [], Basket: [], Storage: [] })
  const categoriesWithItems = CATEGORY_ORDER.filter((cat) => grouped[cat].length > 0)
  const selectedItem = detail?.item ?? hardware?.find((item) => item.hardware_id === selectedId)

  return (
    <div ref={routeRef} data-testid="motion-route-boundary" className="p-4 md:p-6 space-y-6">
      <PageHeader
        title="Hardware"
        subtitle="GEAR / MAINTENANCE"
        actions={<Button variant="primary" size="sm" onClick={() => setAddModal({ open: true })}>Add hardware</Button>}
      />

      {!hardware?.length ? (
        <div data-testid="hardware-empty-state">
          <div data-testid="fresh-household-empty-hardware">
            <EmptyState
              icon={<HardwareIcon category="Machine" />}
              title="No hardware yet"
              description="Add the machine, grinder, basket, and storage this household uses. Fresh households start empty."
              action={<Button variant="primary" size="sm" onClick={() => setAddModal({ open: true })}>Add hardware</Button>}
            />
          </div>
        </div>
      ) : (
        <div data-testid="hardware-list" className="space-y-7">
          <div ref={gridRef} data-testid="hardware-grid" className="space-y-7">
            {categoriesWithItems.map((cat) => (
              <section key={cat} data-testid="hardware-category-section" className="space-y-3">
                <SectionHeading
                  title={cat}
                  actions={(
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => setAddModal({ open: true, initialCategory: cat })}
                      aria-label={`Add ${cat}`}
                      className="text-amber-300 hover:text-amber-200"
                    >
                      Add
                    </Button>
                  )}
                />
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
                  {grouped[cat].map((item) => {
                    const selected = item.hardware_id === selectedId
                    return (
                      <GlassCard
                        interactive
                        padding="none"
                        data-testid="hardware-card"
                        data-hardware-id={item.hardware_id}
                        key={item.hardware_id}
                        role="button"
                        tabIndex={0}
                        onClick={(event) => {
                          pressFeedback(event.currentTarget)
                          setSelectedId(item.hardware_id)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            pressFeedback(e.currentTarget)
                            setSelectedId(item.hardware_id)
                          }
                        }}
                        className={`kaapi-motion-card overflow-hidden text-left outline-none focus-visible:ring-2 focus-visible:ring-amber-300/80 ${selected ? 'border-amber-400/60 shadow-[var(--kaapi-glow-amber)]' : ''}`}
                      >
                        <div className="liquid-card-figure hardware">
                          {item.image_path ? (
                            <>
                              <img
                                src={item.image_path}
                                alt={item.name}
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none'
                                  const icon = e.currentTarget.nextElementSibling as HTMLElement | null
                                  if (icon) icon.style.display = 'flex'
                                }}
                              />
                              <span aria-hidden="true" style={{ display: 'none' }} className="h-full w-full items-center justify-center">
                                <HardwareIcon category={item.category} />
                              </span>
                            </>
                          ) : (
                            <HardwareIcon category={item.category} />
                          )}
                        </div>
                        <div className="liquid-card-body">
                          <div className="flex items-center justify-between gap-2">
                            <Badge>{item.category}</Badge>
                            {selected && <span className="text-xs font-medium text-amber-200">Selected</span>}
                          </div>
                          <h3 className="mt-3 font-display text-base font-bold leading-snug text-white">{item.name}</h3>
                          <p className="mt-1 text-xs text-amber-200/55">Select for details and maintenance.</p>
                        </div>
                      </GlassCard>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>

          {selectedId && (
            <div
              ref={detailRef}
              data-testid="hardware-detail-panel"
              tabIndex={-1}
              className="scroll-mt-4 outline-none"
            >
              <GlassCard padding="lg" className="space-y-6">
                <Button data-testid="hardware-back-to-grid" variant="ghost" size="sm" onClick={closeDetail} className="px-0 text-amber-300">
                  ← Back to hardware
                </Button>
                {detailLoading ? (
                  <LoadingSpinner />
                ) : selectedItem ? (
                  <>
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <Badge>{selectedItem.category}</Badge>
                        <h2 className="font-display text-2xl font-bold text-amber-100">{selectedItem.name}</h2>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setEditModal({ open: true, hardware: selectedItem })}>Edit</Button>
                        {(selectedItem.category === 'Machine' || selectedItem.category === 'Grinder') && (
                          <Button variant="secondary" size="sm" onClick={() => setLogModal({ open: true, hardware: selectedItem })}>
                            Log maintenance
                          </Button>
                        )}
                      </div>
                    </div>

                    {selectedItem.image_path && (
                      <img src={selectedItem.image_path} alt={selectedItem.name} className="max-h-56 w-full rounded-[var(--bevel-radius)] object-contain opacity-80" />
                    )}

                    {selectedItem.category !== 'Basket' && selectedItem.category !== 'Storage' && (
                      detail?.maintenance?.length ? (
                        <div className="space-y-3">
                          <SectionHeading title="Maintenance log" />
                          <div className="space-y-0">
                            {detail.maintenance.map((m) => (
                              <div key={m.maintenance_id} className="border-b border-amber-900/20 py-3 last:border-0">
                                <p className="text-sm font-medium text-amber-300">{m.date}</p>
                                <p className="mt-1 text-sm text-amber-200/70">
                                  {m.action_type}
                                  {m.notes && <span className="text-amber-200/50"> · {m.notes}</span>}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-base text-amber-200/50">No maintenance records.</p>
                      )
                    )}
                  </>
                ) : null}
              </GlassCard>
            </div>
          )}
        </div>
      )}

      {addModal.open && (
        <AddHardwareModal
          initialCategory={addModal.initialCategory}
          onClose={() => setAddModal({ open: false })}
          onSaved={(newId) => { setAddModal({ open: false }); setSelectedId(newId) }}
        />
      )}
      {logModal.open && logModal.hardware && (
        <LogMaintenanceModal hardware={logModal.hardware}
          onClose={() => setLogModal({ open: false })}
          onSaved={() => setLogModal({ open: false })} />
      )}
      {editModal.open && editModal.hardware && (
        <EditHardwareModal hardware={editModal.hardware}
          onClose={() => setEditModal({ open: false })}
          onSaved={() => setEditModal({ open: false })} />
      )}
    </div>
  )
}
