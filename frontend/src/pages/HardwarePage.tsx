import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listHardware, getHardwareDetail } from '../api/hardware'
import LoadingSpinner from '../components/LoadingSpinner'
import AddHardwareModal from '../components/AddHardwareModal'
import LogMaintenanceModal from '../components/LogMaintenanceModal'
import EditHardwareModal from '../components/EditHardwareModal'
import Chip from '../components/Chip'
import { Button, EmptyState, GlassCard, PageHeader, SectionHeading } from '../components/ui'
import type { HardwareItem } from '../types/entities'
import { useHouseholdQueryScope } from '../contexts/AuthContext'
import { householdKeys } from '../api/queryKeys'

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

  const { data: hardware, isLoading, isError, error, refetch } = useQuery({
    queryKey: householdKeys.hardware(activeHouseholdId),
    queryFn: listHardware,
  })

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: householdKeys.hardwareDetail(activeHouseholdId, selectedId),
    queryFn: () => getHardwareDetail(selectedId!),
    enabled: !!selectedId,
  })

  if (isLoading) return <LoadingSpinner />
  if (isError) return (
    <div className="p-4 md:p-6">
      <GlassCard padding="lg" className="text-center">
        <p className="text-lg font-semibold text-amber-200">Couldn't load hardware</p>
        <p className="mt-2 text-sm text-amber-400/70">{(error as Error)?.message}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="mt-4 border-amber-600 text-amber-200"
        >
          Retry
        </Button>
      </GlassCard>
    </div>
  )

  const grouped = CATEGORY_ORDER.reduce<Record<string, HardwareItem[]>>((acc, cat) => {
    acc[cat] = (hardware ?? []).filter((h) => h.category === cat)
    return acc
  }, {})

  const selectedItem = detail?.item

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Hardware"
        actions={(
          <Button variant="primary" size="sm" onClick={() => setAddModal({ open: true })}>
            Add hardware
          </Button>
        )}
      />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div
          data-testid="hardware-list"
          className={`w-full max-w-full sm:w-80 lg:w-96 xl:w-full space-y-6 ${selectedId ? 'hidden lg:block' : 'block'}`}
        >
          {CATEGORY_ORDER.map((cat) => {
            const items = grouped[cat]
            return (
              <section key={cat} className="space-y-3">
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
                <div className="space-y-3">
                  {items.map((item) => (
                    <GlassCard
                      interactive
                      padding="none"
                      data-testid="hardware-card"
                      key={item.hardware_id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedId(item.hardware_id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setSelectedId(item.hardware_id)
                        }
                      }}
                      className="overflow-hidden w-full text-left"
                    >
                      <div className="liquid-card-figure hardware">
                        {item.image_path ? (
                          <>
                            <img
                              src={item.image_path}
                              alt={item.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none'
                                const icon = e.currentTarget.nextElementSibling as HTMLElement | null
                                if (icon) icon.style.display = 'flex'
                              }}
                            />
                            <span aria-hidden="true" style={{ display: 'none' }} className="w-full h-full items-center justify-center">
                              <HardwareIcon category={item.category} />
                            </span>
                          </>
                        ) : (
                          <HardwareIcon category={item.category} />
                        )}
                      </div>
                      <div className="liquid-card-body">
                        <h3 className="font-display text-base font-bold leading-snug text-white">
                          {item.name}
                        </h3>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <Chip label={item.category} />
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditModal({ open: true, hardware: item })
                            }}
                            className="text-amber-300 hover:text-amber-200 tracking-wide"
                          >
                            Edit
                          </Button>
                        </div>
                      </div>
                    </GlassCard>
                  ))}
                </div>
              </section>
            )
          })}

          {!hardware?.length && (
            <EmptyState
              icon={(
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-10 w-10"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={0.8}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
              )}
              title="No hardware added yet"
              description="Add your espresso machine, grinder, and baskets to get started."
              action={(
                <Button variant="primary" size="sm" onClick={() => setAddModal({ open: true })}>
                  Add hardware
                </Button>
              )}
            />
          )}
        </div>

        <div
          data-testid="hardware-detail-panel"
          className={`min-w-0 ${selectedId ? 'block' : 'hidden lg:block'}`}
        >
          {selectedId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedId(null)}
              className="mb-4 px-0 text-amber-300 lg:hidden"
            >
              ← Back
            </Button>
          )}

          {!selectedId ? (
            <EmptyState
              icon={(
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={0.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
              title="Select a piece of hardware to see details"
            />
          ) : detailLoading ? (
            <GlassCard padding="lg" className="flex min-h-[22rem] items-center justify-center">
              <LoadingSpinner />
            </GlassCard>
          ) : selectedItem ? (
            <GlassCard padding="lg" className="space-y-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <span className="text-sm uppercase tracking-widest text-amber-400/60">
                    {selectedItem.category}
                  </span>
                  <h2 className="font-display text-2xl font-bold text-amber-100">
                    {selectedItem.name}
                  </h2>
                </div>
                {(selectedItem.category === 'Machine' || selectedItem.category === 'Grinder') && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setLogModal({ open: true, hardware: selectedItem })}
                    className="shrink-0"
                  >
                    Log maintenance
                  </Button>
                )}
              </div>

              {selectedItem.image_path && (
                <img
                  src={selectedItem.image_path}
                  alt={selectedItem.name}
                  className="w-full max-h-56 rounded-lg object-contain opacity-80"
                />
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
            </GlassCard>
          ) : null}
        </div>
      </div>

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
