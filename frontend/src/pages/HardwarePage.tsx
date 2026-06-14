import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getHardwareDetail, listHardware, uploadHardwareImage } from '../api/hardware'
import LoadingSpinner from '../components/LoadingSpinner'
import AddHardwareModal from '../components/AddHardwareModal'
import LogMaintenanceModal from '../components/LogMaintenanceModal'
import EditHardwareModal from '../components/EditHardwareModal'
import { Badge, Button, EmptyState, GlassCard, LayerTransition, PageHeader, SectionHeading } from '../components/ui'
import type { HardwareDetail, HardwareItem } from '../types/entities'
import { useHouseholdQueryScope } from '../contexts/AuthContext'
import { householdKeys } from '../api/queryKeys'
import { useKaapiMotion } from '../lib/motion'
import { COPY } from '../copy'

function HardwareIcon({ category, className = 'h-16 w-16' }: { category: string; className?: string }) {
  const svgProps = {
    xmlns: 'http://www.w3.org/2000/svg',
    className,
    fill: 'none',
    viewBox: '0 0 24 24',
    stroke: 'currentColor',
    strokeWidth: 1,
  } as const
  if (category === 'Machine') return (
    <svg {...svgProps}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  )
  if (category === 'Grinder') return (
    <svg {...svgProps}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
    </svg>
  )
  if (category === 'Storage') return (
    <svg {...svgProps}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
    </svg>
  )
  return (
    <svg {...svgProps}>
      <circle cx="12" cy="12" r="3" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 2v3m0 14v3M2 12h3m14 0h3" />
    </svg>
  )
}

/**
 * Photo + image-upload surface for a single hardware item. Held in its own component
 * and remounted via `key={item.hardware_id}` by the parent, so the transient
 * upload/preview state resets cleanly when a different item is opened — no reset effect.
 */
function HardwarePhotoCard({ item, householdId }: { item: HardwareItem; householdId: string | null | undefined }) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null)
  const imagePath = item.image_path && item.image_path !== brokenSrc ? item.image_path : null

  const handleUpload = async (file: File) => {
    setUploading(true)
    setError(null)
    setSuccess(false)
    try {
      const { image_path } = await uploadHardwareImage(item.hardware_id, file)
      setBrokenSrc(null)
      // Write the new path straight into the detail + list caches so the preview and
      // the grid thumbnail update immediately, without waiting for a background refetch.
      queryClient.setQueryData<HardwareDetail>(
        householdKeys.hardwareDetail(householdId, item.hardware_id),
        (old) => old ? { ...old, item: { ...old.item, image_path } } : old,
      )
      queryClient.setQueryData<HardwareItem[]>(
        householdKeys.hardware(householdId),
        (old) => old?.map((h) => h.hardware_id === item.hardware_id ? { ...h, image_path } : h),
      )
      queryClient.invalidateQueries({ queryKey: householdKeys.hardwareDetail(householdId, item.hardware_id), refetchType: 'inactive' })
      queryClient.invalidateQueries({ queryKey: householdKeys.hardware(householdId), refetchType: 'inactive' })
      setSuccess(true)
    } catch {
      setError(COPY.hardware.imageUploadFailed)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <GlassCard variant="content" className="space-y-4">
      <h3 className="text-sm font-semibold">{COPY.hardware.photo}</h3>
      <div className="overflow-hidden rounded-[var(--bevel-radius)] border border-[var(--kaapi-content-border)] bg-[var(--kaapi-content-surface-2)]">
        {imagePath ? (
          <img
            src={imagePath}
            alt={item.name}
            className="max-h-56 w-full object-contain"
            onError={() => setBrokenSrc(item.image_path ?? null)}
          />
        ) : (
          <div className="flex h-40 items-center justify-center text-[var(--kaapi-content-muted)]">
            <HardwareIcon category={item.category} />
          </div>
        )}
      </div>
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          loading={uploading}
          loadingText="Uploading…"
        >
          {item.image_path ? 'Replace image' : 'Upload image'}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          data-testid="hardware-image-input"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleUpload(f)
          }}
        />
        {uploading && (
          <p role="status" className="mt-2 text-xs text-[var(--kaapi-content-muted)]">{COPY.hardware.uploadingImage}</p>
        )}
        {success && !uploading && (
          <p role="status" data-testid="hardware-image-success" className="mt-2 text-xs text-[var(--kaapi-content-muted)]">
            {COPY.hardware.imageUpdated}
          </p>
        )}
        {error && (
          <p role="alert" data-testid="hardware-image-error" className="mt-2 text-xs text-error">{error}</p>
        )}
      </div>
    </GlassCard>
  )
}

const CATEGORY_ORDER: HardwareItem['category'][] = ['Machine', 'Grinder', 'Basket', 'Storage']

export default function HardwarePage() {
  const activeHouseholdId = useHouseholdQueryScope()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedId = searchParams.get('item')

  const [addModal, setAddModal] = useState<{ open: boolean; initialCategory?: HardwareItem['category'] }>({ open: false })
  const [logModal, setLogModal] = useState<{ open: boolean; hardware?: HardwareItem }>({ open: false })
  const [editModal, setEditModal] = useState<{ open: boolean; hardware?: HardwareItem }>({ open: false })

  const routeRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  // Distinct-layer navigation bookkeeping: where the grid was scrolled, which card to
  // refocus on return, and whether WE pushed the detail entry (so the in-page Back can
  // pop it symmetrically with the browser Back button instead of stacking a new entry).
  const gridScrollRef = useRef(0)
  const lastSelectedIdRef = useRef<string | null>(null)
  const openedViaClickRef = useRef(false)
  const { routeEnter, staggerCards, pressFeedback } = useKaapiMotion({ scope: routeRef })

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
    if (selectedId) return
    const cards = gridRef.current?.querySelectorAll('.kaapi-motion-card')
    if (cards?.length) staggerCards(cards)
  }, [hardware, selectedId, staggerCards])

  // Returning to the grid (via in-page Back or the browser Back/Forward buttons):
  // restore the grid scroll position and move focus back to the card just viewed.
  useEffect(() => {
    if (selectedId) return
    const focusId = lastSelectedIdRef.current
    if (!focusId) return
    lastSelectedIdRef.current = null
    const frame = requestAnimationFrame(() => {
      const main = document.getElementById('main-content')
      if (main) main.scrollTop = gridScrollRef.current
      document.querySelector<HTMLElement>(`[data-hardware-id="${focusId}"]`)?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [selectedId])

  const openDetail = (id: string) => {
    const main = document.getElementById('main-content')
    gridScrollRef.current = main?.scrollTop ?? 0
    lastSelectedIdRef.current = id
    openedViaClickRef.current = true
    setSearchParams({ item: id })
    requestAnimationFrame(() => document.getElementById('main-content')?.scrollTo(0, 0))
  }

  const closeDetail = () => {
    if (openedViaClickRef.current) {
      openedViaClickRef.current = false
      navigate(-1)
    } else {
      setSearchParams({}, { replace: true })
    }
  }

  if (isLoading) return <LoadingSpinner />
  if (isError) return (
    <div className="p-4 md:p-6">
      <GlassCard variant="content" padding="lg" className="text-center">
        <p className="text-lg font-semibold">{COPY.hardware.loadError}</p>
        <p className="mt-2 text-sm text-[var(--kaapi-content-muted)]">{(error as Error)?.message}</p>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-4">Retry</Button>
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
        actions={selectedId ? undefined : <Button variant="primary" size="sm" onClick={() => setAddModal({ open: true })}>Add hardware</Button>}
      />

      {!hardware?.length ? (
        <div data-testid="hardware-empty-state">
          <div data-testid="fresh-household-empty-hardware">
            <EmptyState
              icon={<HardwareIcon category="Machine" />}
              title={COPY.hardware.emptyTitle}
              description={COPY.hardware.emptyBody}
              action={<Button variant="primary" size="sm" onClick={() => setAddModal({ open: true })}>Add hardware</Button>}
            />
          </div>
        </div>
      ) : selectedId ? (
        <LayerTransition
          variant="side"
          transitionKey={selectedId}
          focusOnEnter
          data-testid="hardware-detail-panel"
          className="scroll-mt-4"
        >
          {detailLoading && !selectedItem ? (
            <LoadingSpinner />
          ) : selectedItem ? (
            <div className="space-y-6">
              <Button
                data-testid="hardware-back-to-grid"
                variant="ghost"
                size="sm"
                onClick={closeDetail}
                className="px-0 text-amber-300 hover:text-amber-200"
              >
                {COPY.hardware.backToHardware}
              </Button>

              {/* Header block — espresso-dark chrome; operational content sits on the light cards below. */}
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 space-y-2">
                  <Badge tone="neutral" emphasis="solid">{selectedItem.category}</Badge>
                  <h2 className="font-display text-2xl font-bold text-white/90 break-words">{selectedItem.name}</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditModal({ open: true, hardware: selectedItem })}>Edit</Button>
                  {(selectedItem.category === 'Machine' || selectedItem.category === 'Grinder') && (
                    <Button variant="secondary" size="sm" onClick={() => setLogModal({ open: true, hardware: selectedItem })}>
                      Log maintenance
                    </Button>
                  )}
                </div>
              </div>

              <HardwarePhotoCard key={selectedItem.hardware_id} item={selectedItem} householdId={activeHouseholdId} />

              {/* Maintenance — Machine + Grinder only */}
              {selectedItem.category !== 'Basket' && selectedItem.category !== 'Storage' && (
                <GlassCard variant="content" className="space-y-3">
                  <h3 className="text-sm font-semibold">{COPY.hardware.maintenanceLog}</h3>
                  {detail?.maintenance?.length ? (
                    <div>
                      {detail.maintenance.map((m) => (
                        <div key={m.maintenance_id} className="border-b border-[var(--kaapi-content-border)] py-3 last:border-0">
                          <p className="text-sm font-medium text-[var(--kaapi-content-content)]">{m.date}</p>
                          <p className="mt-1 text-sm text-[var(--kaapi-content-muted)]">
                            {m.action_type}
                            {m.notes && <span> · {m.notes}</span>}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--kaapi-content-muted)]">{COPY.hardware.noMaintenance}</p>
                  )}
                </GlassCard>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <Button
                data-testid="hardware-back-to-grid"
                variant="ghost"
                size="sm"
                onClick={closeDetail}
                className="px-0 text-amber-300 hover:text-amber-200"
              >
                {COPY.hardware.backToHardware}
              </Button>
              <GlassCard variant="content" padding="lg" className="text-center">
                <p className="text-sm text-[var(--kaapi-content-muted)]">{COPY.hardware.unavailable}</p>
              </GlassCard>
            </div>
          )}
        </LayerTransition>
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
                      {COPY.hardware.add}
                    </Button>
                  )}
                />
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
                  {grouped[cat].map((item) => (
                    <GlassCard
                      interactive
                      variant="content"
                      padding="none"
                      data-testid="hardware-card"
                      data-hardware-id={item.hardware_id}
                      key={item.hardware_id}
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        pressFeedback(event.currentTarget)
                        openDetail(item.hardware_id)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          pressFeedback(e.currentTarget)
                          openDetail(item.hardware_id)
                        }
                      }}
                      className="kaapi-motion-card overflow-hidden text-left outline-none focus-visible:ring-2 focus-visible:ring-amber-500/80"
                    >
                      <div className="flex h-40 items-center justify-center bg-[var(--kaapi-content-surface-2)]">
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
                            <span aria-hidden="true" style={{ display: 'none' }} className="h-full w-full items-center justify-center text-[var(--kaapi-content-muted)]">
                              <HardwareIcon category={item.category} />
                            </span>
                          </>
                        ) : (
                          <span className="text-[var(--kaapi-content-muted)]">
                            <HardwareIcon category={item.category} />
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 p-4">
                        <Badge tone="neutral" emphasis="solid">{item.category}</Badge>
                        <h3 title={item.name} className="mt-3 truncate font-display text-base font-bold leading-snug text-[var(--kaapi-content-content)]">{item.name}</h3>
                        <p className="mt-1 text-xs text-[var(--kaapi-content-muted)]">{COPY.hardware.selectHint}</p>
                      </div>
                    </GlassCard>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}

      {addModal.open && (
        <AddHardwareModal
          initialCategory={addModal.initialCategory}
          onClose={() => setAddModal({ open: false })}
          onSaved={(newId) => { setAddModal({ open: false }); openDetail(newId) }}
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
