import { useEffect, useState, useRef } from 'react'
import axios from 'axios'
import { Link, useParams, useNavigate } from 'react-router-dom'
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
import { Badge, Button, FormField, GlassCard, Input, PageHeader, SectionHeading, Select } from '../components/ui'
import { ROAST_LEVELS } from '../utils/roastLevels'
import { useHouseholdQueryScope } from '../contexts/AuthContext'
import { useKaapiMotion } from '../lib/motion'

export default function CatalogDetail() {
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
    if (routeRef.current) routeEnter(routeRef.current)
  }, [routeEnter])

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
    <div className="p-4">
      <GlassCard padding="lg" className="text-center">
        <p className="text-amber-200 font-medium">Couldn't load coffee details</p>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-3 border-amber-600 text-amber-200">Retry</Button>
      </GlassCard>
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

  return (
    <div ref={routeRef} data-testid="catalog-detail" className="p-4 md:p-6 space-y-8 max-w-3xl">
      <Link to="/catalog" className="text-sm text-amber-400 hover:text-amber-300 inline-block">
        ← Back
      </Link>

      {/* Header */}
      <GlassCard padding="lg" className="flex gap-4 items-start">
        <div className="relative shrink-0">
          {item.image_path && item.image_path !== brokenImageSrc ? (
            <img
              src={item.image_path}
              alt={item.bean_name}
              className="w-24 h-24 object-cover rounded-lg border border-amber-700/30"
              onError={() => setBrokenImageSrc(item.image_path ?? null)}
            />
          ) : (
            <div
              data-testid="catalog-image-placeholder"
              className="w-24 h-24 rounded-lg border border-amber-700/30 bg-amber-900/25 flex items-center justify-center text-amber-300 text-xl font-display"
            >
              {((item.roaster || item.bean_name || '?').slice(0, 2)).toUpperCase()}
            </div>
          )}
          {editing && (
            <>
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={imageUploading || editSaving}
                size="xs"
                className="absolute -bottom-2 -right-2"
                aria-label="Replace image"
              >
                {imageUploading ? <span className="loading loading-spinner loading-xs" /> : 'Replace'}
              </Button>
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
          )}
        </div>
        <div className="flex-1">
          {editing ? (
            <div className="space-y-2">
              <div>
                <FormField label="Roaster" htmlFor="catalog-edit-roaster">
                <Input
                  id="catalog-edit-roaster"
                  type="text"
                  inputSize="sm"
                  value={editRoaster}
                  onChange={(e) => setEditRoaster(e.target.value)}
                />
                </FormField>
              </div>
              <div>
                <FormField label="Bean name" htmlFor="catalog-edit-bean-name">
                <Input
                  id="catalog-edit-bean-name"
                  type="text"
                  inputSize="sm"
                  value={editBeanName}
                  onChange={(e) => setEditBeanName(e.target.value)}
                />
                </FormField>
              </div>
              <div>
                <FormField label="Roast level" htmlFor="catalog-edit-roast-level">
                <Select
                  id="catalog-edit-roast-level"
                  selectSize="sm"
                  value={editRoastLevel}
                  onChange={(e) => setEditRoastLevel(e.target.value)}
                >
                  <option value="">Select…</option>
                  {ROAST_LEVELS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </Select>
                </FormField>
              </div>
              <div>
                <FormField label="Product URL (optional)" htmlFor="catalog-edit-product-url">
                <Input
                  id="catalog-edit-product-url"
                  type="url"
                  inputSize="sm"
                  value={editProductUrl}
                  onChange={(e) => setEditProductUrl(e.target.value)}
                  placeholder="https://..."
                />
                </FormField>
              </div>
              {imageError && <p className="text-xs text-red-400">{imageError}</p>}
              {editError && <p className="text-xs text-red-400">{editError}</p>}
              <div className="flex gap-2 justify-end pt-1">
                <Button
                  onClick={() => { setEditing(false); setEditError(null); setImageError(null) }}
                  variant="ghost"
                  size="xs"
                  className="text-amber-300/70"
                >
                  Cancel
                </Button>
                <Button
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
                  size="xs"
                >
                  {editSaving ? <span className="loading loading-spinner loading-xs" /> : 'Save'}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <PageHeader title={item.bean_name} subtitle={item.roaster} />
              <Badge className="mt-2">{item.roast_level}</Badge>
              <div className="mt-2">
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => {
                    setEditRoaster(item.roaster)
                    setEditBeanName(item.bean_name)
                    setEditRoastLevel(item.roast_level)
                    setEditProductUrl(item.product_url ?? '')
                    setEditError(null)
                    setImageError(null)
                    setEditing(true)
                  }}
                  className="border border-amber-600/40 text-amber-300 hover:bg-amber-800/40 appearance-none"
                >
                  Edit
                </Button>
              </div>
            </>
          )}
        </div>
      </GlassCard>
      {!editing && item.product_url && (
        <a
          href={item.product_url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-sm btn-outline border-amber-600/40 text-amber-400 hover:bg-amber-800/40 flex items-center justify-center mt-2 w-full max-w-xs mx-auto btn-bevel"
        >
          View on roaster website ↗
        </a>
      )}

      {/* Bags */}
      <section>
        <SectionHeading
          title="Bags"
          testId="catalog-section-heading"
          actions={(
          <Button
            onClick={openAddBagForm}
            size="xs"
          >
            + Add bag
          </Button>
          )}
        />

        {addingBag && (
          <GlassCard className="mb-3 space-y-3">
            <div className="flex gap-3 flex-wrap">
              <div className="flex-1 min-w-[140px]">
                <FormField label="Roast date" htmlFor="add-bag-roast-date">
                <Input
                  id="add-bag-roast-date"
                  type="date"
                  inputSize="sm"
                  value={bagRoastDate}
                  onChange={(e) => setBagRoastDate(e.target.value)}
                />
                </FormField>
              </div>
              {lockedCatalogRoast ? (
                <div className="flex-1 min-w-[140px]">
                  <FormField label="Roast level" htmlFor="add-bag-roast-level-locked">
                  <Input
                    id="add-bag-roast-level-locked"
                    type="text"
                    inputSize="sm"
                    value={lockedCatalogRoast}
                    readOnly
                    disabled
                    aria-describedby="add-bag-roast-level-locked-note"
                    className="opacity-60"
                  />
                  </FormField>
                  <p id="add-bag-roast-level-locked-note" className="text-xs text-amber-200/60 mt-1">
                    Roast level set by catalog: {lockedCatalogRoast}
                  </p>
                </div>
              ) : (
                <div className="flex-1 min-w-[140px]">
                  <FormField label="Roast level" htmlFor="add-bag-roast-level">
                  <Select
                    id="add-bag-roast-level"
                    selectSize="sm"
                    value={bagRoastLevel}
                    onChange={(e) => setBagRoastLevel(e.target.value)}
                    required
                  >
                    <option value="">Select…</option>
                    {ROAST_LEVELS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </Select>
                  </FormField>
                </div>
              )}
            </div>
            {bagError && <p className="text-xs text-red-400">{bagError}</p>}
            <div className="flex gap-2 justify-end">
              <Button
                onClick={resetAddBagForm}
                variant="ghost"
                size="xs"
                className="text-amber-300/70"
              >
                Cancel
              </Button>
              <Button
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
                size="xs"
              >
                {bagSaving ? <span className="loading loading-spinner loading-xs" /> : 'Save bag'}
              </Button>
            </div>
          </GlassCard>
        )}

        {bags.length === 0 ? (
          <p className="text-amber-200/60 text-sm">No bags in inventory.</p>
        ) : (
          <div ref={cardListRef} data-testid="motion-card-list" className="space-y-2">
            {bags.map((bag) => {
              const nextStatus = bag.status === 'Active' ? 'Finished' : 'Active'
              const pending = bagStatusMutation.isPending && bagStatusMutation.variables?.bagId === bag.bag_id
              const actionLabel = bag.status === 'Active' ? 'Finish bag' : 'Reactivate'
              return (
              <GlassCard key={bag.bag_id} padding="sm" className="kaapi-motion-card flex items-center justify-between gap-3">
                <div>
                  {bag.roast_date && (
                    <p data-testid="bag-roast-date" className="text-sm text-amber-300 mt-0.5">{bag.roast_date}</p>
                  )}
                  <p data-testid="bag-status" className="text-sm text-amber-300 capitalize">{bag.status}</p>
                  {statusErrors[bag.bag_id] && (
                    <p className="text-xs text-red-400 mt-1">{statusErrors[bag.bag_id]}</p>
                  )}
                </div>
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() => bagStatusMutation.mutate({ bagId: bag.bag_id, status: nextStatus })}
                  variant="outline"
                  size="xs"
                  className="border-amber-600/40 text-amber-300 hover:bg-amber-800/40"
                >
                  {pending ? 'Saving…' : actionLabel}
                </Button>
              </GlassCard>
              )
            })}
          </div>
        )}
      </section>

      {/* Brew history */}
      <section>
        <SectionHeading title="Brew history" testId="catalog-section-heading" />
        {recent_shots.length === 0 ? (
          <p className="text-amber-200/60 text-sm">No shots logged yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm md:table-md text-amber-100 w-full">
              <thead className="text-amber-300/70 text-xs">
                <tr>
                  <th>Date</th>
                  <th>Dose → yield</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {recent_shots.slice(0, 10).map((shot) => (
                  <tr
                    key={shot.shot_id}
                    className="border-t border-amber-700/20 cursor-pointer hover:bg-amber-800/20 transition-colors"
                    onClick={() => navigate(`/brew-log/${shot.shot_id}?back=/catalog/${id}`)}
                  >
                    <td className="text-xs md:text-sm md:py-3">{shot.date}</td>
                    <td className="text-xs md:text-sm md:py-3 font-mono">
                      {shot.dose_in_g != null && shot.yield_out_g != null
                        ? `${shot.dose_in_g}g → ${shot.yield_out_g}g`
                        : '—'}
                    </td>
                    <td className="text-xs md:text-sm md:py-3">{shot.time_sec != null ? `${shot.time_sec}s` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
