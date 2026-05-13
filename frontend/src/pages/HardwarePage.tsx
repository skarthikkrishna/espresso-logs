import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listHardware, getHardwareDetail } from '../api/hardware'
import LoadingSpinner from '../components/LoadingSpinner'
import AddHardwareModal from '../components/AddHardwareModal'
import LogMaintenanceModal from '../components/LogMaintenanceModal'
import EditHardwareModal from '../components/EditHardwareModal'
import type { HardwareItem } from '../types/entities'

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
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [addModal, setAddModal] = useState<{ open: boolean; initialCategory?: HardwareItem['category'] }>({ open: false })
  const [logModal, setLogModal] = useState<{ open: boolean; hardware?: HardwareItem }>({ open: false })
  const [editModal, setEditModal] = useState<{ open: boolean; hardware?: HardwareItem }>({ open: false })

  const { data: hardware, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['hardware'],
    queryFn: listHardware,
  })

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['hardware', selectedId],
    queryFn: () => getHardwareDetail(selectedId!),
    enabled: !!selectedId,
  })

  if (isLoading) return <LoadingSpinner />
  if (isError) return (
    <div className="p-4">
      <div className="glass-card card-bevel p-6 text-center">
        <p className="text-amber-200 font-medium">Couldn't load hardware</p>
        <p className="text-amber-400/70 text-sm mt-1">{(error as Error)?.message}</p>
        <button onClick={() => refetch()} className="btn btn-sm btn-outline border-amber-600 text-amber-200 mt-3 btn-bevel">
          Retry
        </button>
      </div>
    </div>
  )

  const grouped = CATEGORY_ORDER.reduce<Record<string, HardwareItem[]>>((acc, cat) => {
    acc[cat] = (hardware ?? []).filter((h) => h.category === cat)
    return acc
  }, {})

  const selectedItem = detail?.item

  return (
    <div className="p-4 md:p-6">
      <h1 className="font-display text-3xl md:text-4xl font-bold text-white/80 mb-4">Hardware</h1>
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left panel — card list */}
        <div data-testid="hardware-list" className={`w-72 shrink-0 space-y-5 ${selectedId ? 'hidden lg:block' : 'block'}`}>
          {CATEGORY_ORDER.map((cat) => {
            const items = grouped[cat]
            return (
              <div key={cat}>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xs uppercase tracking-widest text-amber-400/60">{cat}</h2>
                  <button
                    onClick={() => setAddModal({ open: true, initialCategory: cat })}
                    className="text-xs text-amber-400 hover:text-amber-300 transition-colors font-medium"
                    aria-label={`Add ${cat}`}
                  >+ Add</button>
                </div>
                <div className="space-y-2">
                  {items.map((item) => (
                    // div+role="button" avoids nested <button> (invalid HTML spec)
                    <div
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
                      className="liquid-card w-full text-left cursor-pointer"
                    >
                      {/* Figure */}
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
                      {/* Body */}
                      <div className="liquid-card-body">
                        <h3 className="font-display text-sm font-bold leading-snug text-white">
                          {item.name}
                        </h3>
                        <div className="flex items-center justify-between mt-3">
                          <span className="badge badge-sm bg-stone-900/30 text-stone-400 border border-stone-600/30">
                            {item.category}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditModal({ open: true, hardware: item })
                            }}
                            className="text-xs text-amber-400 hover:text-amber-300 transition-colors font-medium tracking-wide"
                          >
                            EDIT
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
          {!hardware?.length && (
            <div className="glass-card card-bevel p-8 flex flex-col items-center justify-center gap-3 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-amber-400/40"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={0.8}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <p className="text-amber-200/60 text-sm">No hardware added yet</p>
              <button onClick={() => setAddModal({ open: true })}
                className="btn btn-sm btn-primary btn-bevel mt-1">
                Add hardware
              </button>
            </div>
          )}
        </div>

        {/* Right panel — detail */}
        <div
          data-testid="hardware-detail-panel"
          className={`flex-1 min-w-0 lg:self-start ${selectedId ? 'block' : 'hidden lg:block'}`}
        >
          {selectedId && (
            <button
              onClick={() => setSelectedId(null)}
              className="btn btn-ghost btn-sm text-amber-300 pl-0 mb-4 lg:hidden"
            >
              ← Back
            </button>
          )}
          {!selectedId ? (
            <div className="glass-card card-bevel p-8 flex flex-col items-center justify-center gap-3 min-h-48 text-stone-500/40">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={0.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              <p className="text-sm">Select a piece of hardware to see details</p>
            </div>
          ) : detailLoading ? (
            <LoadingSpinner />
          ) : selectedItem ? (
            <div className="glass-card card-bevel p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-xs uppercase tracking-widest text-amber-400/60">
                    {selectedItem.category}
                  </span>
                  <h2 className="text-xl font-display text-amber-100 mt-1">{selectedItem.name}</h2>
                </div>
                {(selectedItem.category === 'Machine' || selectedItem.category === 'Grinder') && (
                  <button onClick={() => setLogModal({ open: true, hardware: selectedItem })}
                    className="btn btn-sm bg-amber-800/60 hover:bg-amber-700/60 border border-amber-600/30 text-amber-200 shrink-0 btn-bevel">
                    Log maintenance
                  </button>
                )}
              </div>

              {selectedItem.image_path && (
                <img src={selectedItem.image_path} alt={selectedItem.name}
                  className="w-full max-h-40 object-contain rounded-lg opacity-80" />
              )}

              {selectedItem.category !== 'Basket' && selectedItem.category !== 'Storage' && (
                detail?.maintenance?.length ? (
                  <div>
                    <h3 className="text-sm font-semibold text-amber-300 mb-2">Maintenance log</h3>
                    <div className="space-y-3">
                      {detail.maintenance.map((m) => (
                        <div key={m.maintenance_id} className="text-xs text-amber-200/70 py-3 border-b border-amber-900/20 last:border-0">
                          <span className="text-amber-300">{m.date}</span>
                          {' — '}
                          {m.action_type}
                          {m.notes && <span className="text-amber-200/50"> · {m.notes}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-amber-200/50 text-sm">No maintenance records.</p>
                )
              )}
            </div>
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

