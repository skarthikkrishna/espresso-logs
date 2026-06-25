import { useEffect, useState, useRef } from 'react'
import axios from 'axios'
import { useParams, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getCatalogDetail, createInventoryBag, updateCatalogItem, uploadCatalogImage } from '../api/catalog'
import { updateInventoryBagStatus } from '../api/inventory'
import {
  brewLogListQueryKey,
  catalogDetailQueryKey,
  catalogListQueryKey,
  dashboardQueryKey,
  defaultsBagQueryKey,
  inventoryQueryKey,
} from '../api/queryKeys'
import type { CatalogDetail as CatalogDetailData, CatalogItem, InventoryBag } from '../types/entities'
import LoadingSpinner from '../components/LoadingSpinner'
import { ROAST_LEVELS } from '../utils/roastLevels'
import { useHouseholdQueryScope } from '../contexts/AuthContext'
import { ToneProvider } from '../contexts/ToneContext'
import { useKaapiMotion } from '../lib/motion'
import { COPY } from '../copy'
import {
  AddBagAction,
  BackLink,
  BagCard,
  DetailHeader,
  FormSection,
  RoastChip,
  Section,
  SectionHeader,
  ToneButton,
  ToneInput,
  TonePageWrapper,
  ToneSelect,
  ToneToggle,
} from '../components/tone-system'

export default function CatalogDetail() {
  return (
    <ToneProvider>
      <CatalogDetailPage />
    </ToneProvider>
  )
}

function CatalogDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const activeHouseholdId = useHouseholdQueryScope()

  const [addingBag, setAddingBag] = useState(false)
  const [bagRoastDate, setBagRoastDate] = useState('')
  const [bagRoastLevel, setBagRoastLevel] = useState('')
  const [bagSaving, setBagSaving] = useState(false)
  const [bagError, setBagError] = useState<string | null>(null)
  const [statusErrors, setStatusErrors] = useState<Record<string, string | undefined>>({})

  const [editing, setEditing] = useState(false)
  const [editRoaster, setEditRoaster] = useState('')
  const [editBeanName, setEditBeanName] = useState('')
  const [editRoastLevel, setEditRoastLevel] = useState('')
  const [editProductUrl, setEditProductUrl] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [imageUploading, setImageUploading] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  // Track per-URL image-load failures via state (not direct DOM mutation) so
  // that swapping `src` after a Replace upload re-attempts to load.
  const [brokenImageSrc, setBrokenImageSrc] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const routeRef = useRef<HTMLDivElement>(null)
  const cardListRef = useRef<HTMLDivElement>(null)
  const { routeEnter, staggerCards } = useKaapiMotion({ scope: routeRef })

  /**
   * Invalidate every query whose data could embed the catalog entry's
   * roaster/bean name (e.g. inventory bag display names, dashboard cards,
   * brew log rows). Without this, a rename only updates the catalog views
   * until the React Query staleTime (60s) elapses.
   */
  const invalidateAllCatalogConsumers = () => {
    if (!id) return
    queryClient.invalidateQueries({ queryKey: catalogDetailQueryKey(id, activeHouseholdId) })
    queryClient.invalidateQueries({ queryKey: catalogListQueryKey(activeHouseholdId) })
    queryClient.invalidateQueries({ queryKey: inventoryQueryKey(activeHouseholdId) })
    queryClient.invalidateQueries({ queryKey: dashboardQueryKey(activeHouseholdId) })
    queryClient.invalidateQueries({ queryKey: brewLogListQueryKey(activeHouseholdId) })
  }

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: catalogDetailQueryKey(id ?? '', activeHouseholdId),
    queryFn: () => getCatalogDetail(id!),
    enabled: !!id,
  })

  useEffect(() => {
    if (!isLoading && !isError && routeRef.current) routeEnter(routeRef.current)
  }, [isLoading, isError, routeEnter])

  useEffect(() => {
    const cards = cardListRef.current?.querySelectorAll('.kaapi-motion-card')
    if (cards?.length) staggerCards(cards)
  }, [data?.bags.length, data?.recent_shots.length, staggerCards])

  const bagStatusMutation = useMutation({
    mutationFn: ({ bagId, status }: { bagId: string; status: InventoryBag['status'] }) =>
      updateInventoryBagStatus(bagId, status),
    onMutate: ({ bagId }) => {
      setStatusErrors((prev) => ({ ...prev, [bagId]: undefined }))
    },
    onSuccess: (updatedBag) => {
      if (!id) return
      queryClient.setQueryData<CatalogDetailData>(
        catalogDetailQueryKey(id, activeHouseholdId),
        (old) => old
          ? { ...old, bags: old.bags.map((bag) => bag.bag_id === updatedBag.bag_id ? { ...bag, ...updatedBag } : bag) }
          : old,
      )
      queryClient.invalidateQueries({ queryKey: catalogDetailQueryKey(id, activeHouseholdId) })
      queryClient.invalidateQueries({ queryKey: inventoryQueryKey(activeHouseholdId) })
      queryClient.invalidateQueries({ queryKey: dashboardQueryKey(activeHouseholdId) })
      queryClient.invalidateQueries({ queryKey: defaultsBagQueryKey(updatedBag.bag_id, activeHouseholdId) })
      queryClient.invalidateQueries({ queryKey: brewLogListQueryKey(activeHouseholdId) })
    },
    onError: (_error, variables) => {
      setStatusErrors((prev) => ({
        ...prev,
        [variables.bagId]: `Failed to ${variables.status === 'Finished' ? 'finish' : 'reactivate'} bag. Please try again.`,
      }))
    },
  })

  if (isLoading) return <LoadingSpinner />
  if (isError) return (
    <div className="p-6 text-center">
      <p className="font-medium">{COPY.catalog.detailLoadError}</p>
      <button type="button" className="mt-3 rounded-md border px-3 py-1.5 text-sm font-medium" onClick={() => refetch()}>Retry</button>
    </div>
  )
  if (!data) return null

  const { item, bags, recent_shots } = data
  const lockedCatalogRoast = item.roast_level?.trim() ?? ''

  const addBagRoastLevel = lockedCatalogRoast || bagRoastLevel

  const openAddBagForm = () => {
    setAddingBag(true)
    setBagError(null)
    setBagRoastLevel(lockedCatalogRoast)
  }

  const resetAddBagForm = () => {
    setAddingBag(false)
    setBagRoastDate('')
    setBagRoastLevel('')
    setBagError(null)
  }

  const errorMessage = (err: unknown, fallback: string) => {
    if (!axios.isAxiosError(err)) return fallback
    const detail = err.response?.data?.detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail) && detail.length > 0) return 'Validation failed. Please check the bag details.'
    return fallback
  }

  const imageOverlay = editing ? (
    <>
      <ToneButton
        variant="edit"
        className="absolute -bottom-2 -right-2"
        style={{ padding: '3px 8px', fontSize: '11px' }}
        onClick={() => fileInputRef.current?.click()}
        disabled={imageUploading || editSaving}
        aria-label={COPY.catalog.replaceImage}
      >
        {imageUploading ? <span className="loading loading-spinner loading-xs" /> : 'Replace'}
      </ToneButton>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        data-testid="catalog-image-input"
        onChange={async (e) => {
          const f = e.target.files?.[0]
          if (!f || !id) return
          setImageUploading(true)
          setImageError(null)
          try {
            const { image_path } = await uploadCatalogImage(id, f)
            // Clear any prior broken-image marker so the new src gets a fresh load attempt.
            setBrokenImageSrc(null)
            // Write the new image_path directly into both caches so the
            // detail preview and the catalog-list thumbnail update immediately
            // without waiting for a background refetch to complete.
            queryClient.setQueryData<Awaited<ReturnType<typeof getCatalogDetail>>>(
              catalogDetailQueryKey(id, activeHouseholdId),
              (old) => old ? { ...old, item: { ...old.item, image_path } } : old
            )
            // Use the exact list key (not a prefix match) to avoid invoking
            // the updater with CatalogDetail objects from ['catalog', id] queries.
            queryClient.setQueryData<CatalogItem[]>(
              catalogListQueryKey(activeHouseholdId),
              (old) => old?.map((c) => c.catalog_id === id ? { ...c, image_path } : c)
            )
            // Invalidate non-catalog consumers immediately; for catalog queries
            // use refetchType:'inactive' so they only refetch on next mount —
            // this prevents a stale Cloud Run instance from returning old data
            // and overwriting the optimistic cache entries above.
            queryClient.invalidateQueries({ queryKey: catalogDetailQueryKey(id, activeHouseholdId), refetchType: 'inactive' })
            queryClient.invalidateQueries({ queryKey: catalogListQueryKey(activeHouseholdId), refetchType: 'inactive' })
            queryClient.invalidateQueries({ queryKey: inventoryQueryKey(activeHouseholdId) })
            queryClient.invalidateQueries({ queryKey: dashboardQueryKey(activeHouseholdId) })
            queryClient.invalidateQueries({ queryKey: brewLogListQueryKey(activeHouseholdId) })
          } catch {
            setImageError('Failed to upload image. Please try again.')
          } finally {
            setImageUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
          }
        }}
      />
    </>
  ) : null

  return (
    <TonePageWrapper ref={routeRef} testId="catalog-detail" className="kk-detail-page catalog-detail-page">

      {/* ── Nav row: back link + tone toggle ─────────────────────────────── */}
      <div className="kk-b-page__nav">
        <BackLink to="/catalog" />
        <ToneToggle />
      </div>

      <div className="kk-detail-shell">

        <DetailHeader
          title={item.bean_name}
          subtitle={item.roaster}
          media={(item.image_path && item.image_path !== brokenImageSrc) || editing ? (
            <>
              {item.image_path && item.image_path !== brokenImageSrc ? (
                <img src={item.image_path} alt={item.bean_name} onError={() => setBrokenImageSrc(item.image_path ?? null)} />
              ) : (
                <div className="kk-detail-header__media-placeholder" aria-hidden="true">
                  {item.bean_name.charAt(0).toUpperCase()}
                </div>
              )}
              {imageOverlay}
            </>
          ) : undefined}
          chips={item.roast_level ? <RoastChip level={item.roast_level} /> : undefined}
          actions={!editing ? (
            <>
              <AddBagAction variant="hero" catalogId={id} onAdd={openAddBagForm} />
              <ToneButton
                variant="edit"
                onClick={() => {
                  setEditRoaster(item.roaster)
                  setEditBeanName(item.bean_name)
                  setEditRoastLevel(item.roast_level)
                  setEditProductUrl(item.product_url ?? '')
                  setEditError(null)
                  setImageError(null)
                  setEditing(true)
                }}
              >
                Edit
              </ToneButton>
            </>
          ) : undefined}
        />

        {/* 2. Identity section — edit form/link only; chips/actions live in the unified header */}
        <Section>
          {editing ? (
            <div className="space-y-4">
              <FormSection>
                <ToneInput
                  id="catalog-edit-roaster"
                  label="Roaster"
                  type="text"
                  value={editRoaster}
                  onChange={(e) => setEditRoaster(e.target.value)}
                />
                <ToneInput
                  id="catalog-edit-bean-name"
                  label="Bean name"
                  type="text"
                  value={editBeanName}
                  onChange={(e) => setEditBeanName(e.target.value)}
                />
                <ToneSelect
                  id="catalog-edit-roast-level"
                  label="Roast level"
                  value={editRoastLevel}
                  onChange={(e) => setEditRoastLevel(e.target.value)}
                >
                  <option value="">{COPY.catalog.selectPlaceholder}</option>
                  {ROAST_LEVELS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </ToneSelect>
                <ToneInput
                  id="catalog-edit-product-url"
                  label="Product URL (optional)"
                  type="url"
                  value={editProductUrl}
                  onChange={(e) => setEditProductUrl(e.target.value)}
                  placeholder="https://..."
                />
              </FormSection>
              {imageError && <p className="text-xs kk-tc-error">{imageError}</p>}
              {editError && <p className="text-xs kk-tc-error">{editError}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <ToneButton
                  variant="edit"
                  onClick={() => { setEditing(false); setEditError(null); setImageError(null) }}
                >
                  Cancel
                </ToneButton>
                <ToneButton
                  variant="edit"
                  disabled={editSaving || imageUploading || !editRoaster.trim() || !editBeanName.trim() || !editRoastLevel}
                  onClick={async () => {
                    if (!id) return
                    setEditSaving(true)
                    setEditError(null)
                    try {
                      await updateCatalogItem(id, {
                        roaster: editRoaster.trim(),
                        bean_name: editBeanName.trim(),
                        roast_level: editRoastLevel,
                        product_url: editProductUrl.trim() || null,
                      })
                      setEditing(false)
                      await queryClient.invalidateQueries({ queryKey: catalogDetailQueryKey(id, activeHouseholdId) })
                      invalidateAllCatalogConsumers()
                    } catch {
                      setEditError('Failed to save. Please try again.')
                    } finally {
                      setEditSaving(false)
                    }
                  }}
                >
                  {editSaving ? <span className="loading loading-spinner loading-xs" /> : 'Save'}
                </ToneButton>
              </div>
            </div>
          ) : (
            <div>
              {item.product_url ? (
                <a
                  href={item.product_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="kk-tc-roaster-link"
                >
                  {COPY.catalog.viewOnRoaster}
                </a>
              ) : (
                <p className="kk-tc-body-muted">{COPY.catalog.noRoasterLink}</p>
              )}
            </div>
          )}
        </Section>

        {/* 3. Add-bag form — trigger lives in the unified header */}
        {!editing && addingBag && (
          <Section>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-3">
                  <div className="min-w-[140px] flex-1">
                    <ToneInput
                      id="add-bag-roast-date"
                      label="Roast date"
                      type="date"
                      value={bagRoastDate}
                      onChange={(e) => setBagRoastDate(e.target.value)}
                    />
                  </div>
                  {lockedCatalogRoast ? (
                    <div className="min-w-[140px] flex-1">
                      <ToneInput
                        id="add-bag-roast-level-locked"
                        label="Roast level"
                        type="text"
                        value={lockedCatalogRoast}
                        readOnly
                        disabled
                        aria-describedby="add-bag-roast-level-locked-note"
                        className="opacity-60"
                      />
                      <p id="add-bag-roast-level-locked-note" className="kk-tc-body-muted mt-1 text-xs">
                        {COPY.catalog.roastLockedPrefix} {lockedCatalogRoast}
                      </p>
                    </div>
                  ) : (
                    <div className="min-w-[140px] flex-1">
                      <ToneSelect
                        id="add-bag-roast-level"
                        label="Roast level"
                        value={bagRoastLevel}
                        onChange={(e) => setBagRoastLevel(e.target.value)}
                      >
                        <option value="">{COPY.catalog.selectPlaceholder}</option>
                        {ROAST_LEVELS.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </ToneSelect>
                    </div>
                  )}
                </div>
                {bagError && <p className="text-xs kk-tc-error">{bagError}</p>}
                <div className="flex justify-end gap-2">
                  <ToneButton variant="edit" onClick={resetAddBagForm}>
                    Cancel
                  </ToneButton>
                  <ToneButton
                    variant="edit"
                    disabled={bagSaving || !bagRoastDate || !addBagRoastLevel}
                    onClick={async () => {
                      setBagSaving(true)
                      setBagError(null)
                      try {
                        await createInventoryBag(id!, { roast_date: bagRoastDate, roast_level: addBagRoastLevel })
                        resetAddBagForm()
                        queryClient.invalidateQueries({ queryKey: catalogDetailQueryKey(id!, activeHouseholdId) })
                        queryClient.invalidateQueries({ queryKey: inventoryQueryKey(activeHouseholdId) })
                        queryClient.invalidateQueries({ queryKey: dashboardQueryKey(activeHouseholdId) })
                        queryClient.invalidateQueries({ queryKey: brewLogListQueryKey(activeHouseholdId) })
                      } catch (err) {
                        setBagError(errorMessage(err, 'Failed to add bag. Please try again.'))
                      } finally {
                        setBagSaving(false)
                      }
                    }}
                  >
                    {bagSaving ? <span className="loading loading-spinner loading-xs" /> : 'Save bag'}
                  </ToneButton>
                </div>
              </div>
          </Section>
        )}

        {/* 4. Bags inventory section */}
        <Section className="catalog-bags-section">
          <SectionHeader>{COPY.catalog.bags}</SectionHeader>
          {bags.length === 0 ? (
            <p className="kk-tc-body-muted">{COPY.catalog.noBags}</p>
          ) : (
            <div ref={cardListRef} data-testid="motion-card-list" className="space-y-2">
              {bags.map((bag) => {
                const nextStatus = bag.status === 'Active' ? 'Finished' : 'Active'
                const pending = bagStatusMutation.isPending && bagStatusMutation.variables?.bagId === bag.bag_id
                const actionLabel = bag.status === 'Active' ? 'Finish bag' : 'Reactivate'
                return (
                  <BagCard
                    key={bag.bag_id}
                    bag={bag}
                    variant="row"
                    showRoast={false}
                    action={(
                      <>
                        {statusErrors[bag.bag_id] ? (
                          <p className="text-xs kk-tc-error">{statusErrors[bag.bag_id]}</p>
                        ) : null}
                        <ToneButton
                          variant="edit"
                          disabled={pending}
                          onClick={() => bagStatusMutation.mutate({ bagId: bag.bag_id, status: nextStatus })}
                        >
                          {pending ? 'Saving…' : actionLabel}
                        </ToneButton>
                      </>
                    )}
                  />
                )
              })}
            </div>
          )}
        </Section>

        {/* 5. Brew history section */}
        <Section>
          <SectionHeader>{COPY.catalog.brewHistory}</SectionHeader>
          <div className="detail-panel">
            {recent_shots.length === 0 ? (
              <p className="kk-tc-body-muted">{COPY.catalog.noShots}</p>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="kk-tc-param-label pb-2 text-left">Date</th>
                    <th className="kk-tc-param-label pb-2 text-left">{COPY.catalog.doseYield}</th>
                    <th className="kk-tc-param-label pb-2 text-left">{COPY.catalog.time}</th>
                  </tr>
                </thead>
                <tbody>
                  {recent_shots.slice(0, 10).map((shot) => (
                    <tr
                      key={shot.shot_id}
                      className="cursor-pointer kk-tc-table-row transition-colors hover:opacity-80"
                      onClick={() => navigate(`/brew-log/${shot.shot_id}?back=/catalog/${id}`)}
                    >
                      <td className="kk-tc-body py-2 text-xs md:text-sm">{shot.date}</td>
                      <td className="kk-tc-body py-2 font-mono text-xs md:text-sm">
                        {shot.dose_in_g != null && shot.yield_out_g != null
                          ? `${shot.dose_in_g}g → ${shot.yield_out_g}g`
                          : '—'}
                      </td>
                      <td className="kk-tc-body py-2 text-xs md:text-sm">{shot.time_sec != null ? `${shot.time_sec}s` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        </Section>

      </div>
    </TonePageWrapper>
  )
}
