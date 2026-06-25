import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getHardwareDetail, listHardware, uploadHardwareImage } from '../api/hardware'
import LoadingSpinner from '../components/LoadingSpinner'
import AddHardwareModal from '../components/AddHardwareModal'
import LogMaintenanceModal from '../components/LogMaintenanceModal'
import EditHardwareModal from '../components/EditHardwareModal'
import { Button, GlassCard } from '../components/ui'
import {
  Chip,
  DetailHeader,
  HardwareCard,
  ImmersiveEmptyState,
  ImmersiveListShell,
  ListPageHeader,
  ParamGrid,
  ParamPair,
  Section,
  SectionHeader,
  ToneButton,
  TonePageWrapper,
  ToneProvider,
  ToneToggle,
} from '../components/tone-system'
import type { HardwareDetail, HardwareItem } from '../types/entities'
import { useHouseholdQueryScope } from '../contexts/AuthContext'
import { householdKeys } from '../api/queryKeys'
import { useKaapiMotion } from '../lib/motion'
import { formatIsoDate } from '../utils/dates'
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
 * Hero image + image-upload control for a single hardware item. Held in its own component
 * and remounted via `key={item.hardware_id}` by the parent, so the transient
 * upload/preview state resets cleanly when a different item is opened — no reset effect.
 */
function HardwareHeroImage({ item, householdId }: { item: HardwareItem; householdId: string | null | undefined }) {
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
    <>
      {imagePath ? (
        <img src={imagePath} alt={item.name} onError={() => setBrokenSrc(item.image_path ?? null)} />
      ) : (
        <div className="kk-detail-header__media-placeholder" data-testid="hardware-image-placeholder">
          <HardwareIcon category={item.category} className="h-12 w-12" />
        </div>
      )}
      <ToneButton
        variant="edit"
        className="hardware-detail-image-action"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        aria-label={item.image_path ? 'Replace image' : 'Upload image'}
      >
        {uploading ? 'Uploading…' : item.image_path ? 'Replace image' : 'Upload image'}
      </ToneButton>
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
        <p role="status" className="hardware-detail-image-status kk-tc-body-muted">{COPY.hardware.uploadingImage}</p>
      )}
      {success && !uploading && (
        <p role="status" data-testid="hardware-image-success" className="hardware-detail-image-status kk-tc-body-muted">
          {COPY.hardware.imageUpdated}
        </p>
      )}
      {error && (
        <p role="alert" data-testid="hardware-image-error" className="hardware-detail-image-status kk-tc-error">{error}</p>
      )}
    </>
  )
}

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
    if (!isLoading && !isError && routeRef.current) routeEnter(routeRef.current)
  }, [isLoading, isError, routeEnter])

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

  const selectedItem = detail?.item ?? hardware?.find((item) => item.hardware_id === selectedId)
  const selectedPurchaseDate = formatIsoDate(selectedItem?.purchase_date)

  const modalLayer = (
    <>
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
    </>
  )

  return (
    <ToneProvider>
      {selectedId ? (
        <TonePageWrapper ref={routeRef} testId="motion-route-boundary" className="kk-detail-page hardware-detail-page">
          <div className="kk-b-page__nav">
            <button
              type="button"
              data-testid="hardware-back-to-grid"
              className="kk-tc-back-link"
              onClick={closeDetail}
            >
              {COPY.hardware.backToHardware}
            </button>
            <ToneToggle />
          </div>
          {detailLoading && !selectedItem ? (
            <LoadingSpinner />
          ) : selectedItem ? (
            <div data-testid="hardware-detail-panel" className="kk-detail-shell">
              <DetailHeader
                title={selectedItem.name}
                eyebrow={selectedItem.maker}
                media={<HardwareHeroImage key={selectedItem.hardware_id} item={selectedItem} householdId={activeHouseholdId} />}
                chips={<Chip>{selectedItem.category}</Chip>}
                actions={(
                  <>
                    <ToneButton variant="edit" onClick={() => setEditModal({ open: true, hardware: selectedItem })}>Edit</ToneButton>
                    {(selectedItem.category === 'Machine' || selectedItem.category === 'Grinder') && (
                      <ToneButton variant="primary" onClick={() => setLogModal({ open: true, hardware: selectedItem })}>
                        Log maintenance
                      </ToneButton>
                    )}
                  </>
                )}
              />

                {(selectedItem.purchase_date || selectedItem.product_url) && (
                  <Section>
                    <SectionHeader>{COPY.hardware.details}</SectionHeader>
                    <div className="detail-panel">
                      <div className="hardware-detail-compact-params">
                        <ParamGrid>
                          {selectedPurchaseDate && (
                            <ParamPair
                              label="Purchase date"
                              value={<time dateTime={selectedItem.purchase_date ?? undefined}>{selectedPurchaseDate}</time>}
                            />
                          )}
                          {selectedItem.product_url && (
                            <ParamPair
                              label="Product URL"
                              value={(
                                <a
                                  href={selectedItem.product_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="kk-tc-roaster-link"
                                >
                                  {COPY.hardware.viewProduct}
                                </a>
                              )}
                            />
                          )}
                        </ParamGrid>
                      </div>
                    </div>
                  </Section>
                )}

                {selectedItem.notes && (
                  <Section className="hardware-detail-notes">
                    <SectionHeader level="h3">Notes</SectionHeader>
                    <p className="kk-tc-body">{selectedItem.notes}</p>
                  </Section>
                )}

                {selectedItem.category !== 'Basket' && selectedItem.category !== 'Storage' && (
                  <Section>
                    <SectionHeader>{COPY.hardware.maintenanceLog}</SectionHeader>
                    <div className="detail-panel">
                      {detail?.maintenance?.length ? (
                        <div className="hardware-maintenance-list">
                          {detail.maintenance.map((m) => (
                            <div key={m.maintenance_id} className="hardware-maintenance-row">
                              <p className="hardware-maintenance-date kk-tc-body">{m.date}</p>
                              <div className="hardware-maintenance-copy">
                                <Chip data-testid="hardware-maintenance-action-chip">{m.action_type}</Chip>
                                {m.notes && <p className="kk-tc-body-muted">{m.notes}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="kk-tc-body-muted">{COPY.hardware.noMaintenance}</p>
                      )}
                    </div>
                  </Section>
                )}
            </div>
          ) : (
            <div className="kk-detail-shell">
              <div className="detail-panel">
                <p className="kk-tc-body-muted">{COPY.hardware.unavailable}</p>
              </div>
            </div>
          )}
          {modalLayer}
        </TonePageWrapper>
      ) : (
        <ImmersiveListShell ref={routeRef} testId="motion-route-boundary" className="hardware-list-page">
          <div className="immersive-nav-row">
            <ToneToggle />
          </div>

          <ListPageHeader title="Hardware" section="GEAR / MAINTENANCE">
            <ToneButton variant="primary" onClick={() => setAddModal({ open: true })}>
              Add hardware
            </ToneButton>
          </ListPageHeader>

          {!hardware?.length ? (
            <div data-testid="hardware-empty-state">
              <div data-testid="fresh-household-empty-hardware">
                <ImmersiveEmptyState
                  icon={<HardwareIcon category="Machine" />}
                  title={COPY.hardware.emptyTitle}
                  description={COPY.hardware.emptyBody}
                  action={<ToneButton variant="primary" onClick={() => setAddModal({ open: true })}>Add hardware</ToneButton>}
                />
              </div>
            </div>
          ) : (
            <div ref={gridRef} data-testid="hardware-grid" className="entity-card-grid">
              {hardware.map((item) => (
                <HardwareCard
                  key={item.hardware_id}
                  item={item}
                  data-testid="hardware-card"
                  onPress={pressFeedback}
                  onSelect={(selected) => openDetail(selected.hardware_id)}
                />
              ))}
            </div>
          )}

          {modalLayer}
        </ImmersiveListShell>
      )}
    </ToneProvider>
  )
}
