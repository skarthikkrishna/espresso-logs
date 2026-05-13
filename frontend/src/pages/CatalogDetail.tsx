import { useState, useRef } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getCatalogDetail, createInventoryBag, updateCatalogItem, uploadCatalogImage } from '../api/catalog'
import type { CatalogItem } from '../types/entities'
import LoadingSpinner from '../components/LoadingSpinner'
import { ROAST_LEVELS } from '../utils/roastLevels'

export default function CatalogDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [addingBag, setAddingBag] = useState(false)
  const [bagRoastDate, setBagRoastDate] = useState('')
  const [bagRoastLevel, setBagRoastLevel] = useState('')
  const [bagSaving, setBagSaving] = useState(false)
  const [bagError, setBagError] = useState<string | null>(null)

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

  /**
   * Invalidate every query whose data could embed the catalog entry's
   * roaster/bean name (e.g. inventory bag display names, dashboard cards,
   * brew log rows). Without this, a rename only updates the catalog views
   * until the React Query staleTime (60s) elapses.
   */
  const invalidateAllCatalogConsumers = () => {
    queryClient.invalidateQueries({ queryKey: ['catalog', id] })
    queryClient.invalidateQueries({ queryKey: ['catalog'] })
    queryClient.invalidateQueries({ queryKey: ['inventory'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    queryClient.invalidateQueries({ queryKey: ['brew-log'] })
  }

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['catalog', id],
    queryFn: () => getCatalogDetail(id!),
    enabled: !!id,
  })

  if (isLoading) return <LoadingSpinner />
  if (isError) return (
    <div className="p-4">
      <div className="glass-card card-bevel p-6 text-center">
        <p className="text-amber-200 font-medium">Couldn't load coffee details</p>
        <button onClick={() => refetch()} className="btn btn-sm btn-outline border-amber-600 text-amber-200 mt-3">Retry</button>
      </div>
    </div>
  )
  if (!data) return null

  const { item, bags, recent_shots } = data

  return (
    <div data-testid="catalog-detail" className="p-4 md:p-6 space-y-8 max-w-3xl">
      <Link to="/catalog" className="text-sm text-amber-400 hover:text-amber-300 inline-block">
        ← Back
      </Link>

      {/* Header */}
      <div className="flex gap-4 items-start">
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
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={imageUploading || editSaving}
                className="btn btn-xs btn-primary btn-bevel absolute -bottom-2 -right-2"
                aria-label="Replace image"
              >
                {imageUploading ? <span className="loading loading-spinner loading-xs" /> : 'Replace'}
              </button>
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
                      ['catalog', id],
                      (old) => old ? { ...old, item: { ...old.item, image_path } } : old
                    )
                    // Use the exact list key (not a prefix match) to avoid invoking
                    // the updater with CatalogDetail objects from ['catalog', id] queries.
                    queryClient.setQueryData<CatalogItem[]>(
                      ['catalog'],
                      (old) => old?.map((c) => c.catalog_id === id ? { ...c, image_path } : c)
                    )
                    // Invalidate non-catalog consumers immediately; for catalog queries
                    // use refetchType:'inactive' so they only refetch on next mount —
                    // this prevents a stale Cloud Run instance from returning old data
                    // and overwriting the optimistic cache entries above.
                    queryClient.invalidateQueries({ queryKey: ['catalog', id], refetchType: 'inactive' })
                    queryClient.invalidateQueries({ queryKey: ['catalog'], refetchType: 'inactive' })
                    queryClient.invalidateQueries({ queryKey: ['inventory'] })
                    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
                    queryClient.invalidateQueries({ queryKey: ['brew-log'] })
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
                <label className="label text-xs text-amber-200/70 pb-1">Roaster</label>
                <input
                  type="text"
                  value={editRoaster}
                  onChange={(e) => setEditRoaster(e.target.value)}
                  className="input input-bordered input-sm w-full bg-stone-800 border-amber-900/40 text-amber-100"
                />
              </div>
              <div>
                <label className="label text-xs text-amber-200/70 pb-1">Bean name</label>
                <input
                  type="text"
                  value={editBeanName}
                  onChange={(e) => setEditBeanName(e.target.value)}
                  className="input input-bordered input-sm w-full bg-stone-800 border-amber-900/40 text-amber-100"
                />
              </div>
              <div>
                <label className="label text-xs text-amber-200/70 pb-1">Roast level</label>
                <select
                  value={editRoastLevel}
                  onChange={(e) => setEditRoastLevel(e.target.value)}
                  className="select select-bordered select-sm w-full bg-stone-800 border-amber-900/40 text-amber-100"
                >
                  <option value="">Select…</option>
                  {ROAST_LEVELS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label text-xs text-amber-200/70 pb-1">Product URL (optional)</label>
                <input
                  type="url"
                  value={editProductUrl}
                  onChange={(e) => setEditProductUrl(e.target.value)}
                  placeholder="https://..."
                  className="input input-bordered input-sm w-full bg-stone-800 border-amber-900/40 text-amber-100"
                />
              </div>
              {imageError && <p className="text-xs text-red-400">{imageError}</p>}
              {editError && <p className="text-xs text-red-400">{editError}</p>}
              <div className="flex gap-2 justify-end pt-1">
                <button
                  onClick={() => { setEditing(false); setEditError(null); setImageError(null) }}
                  className="btn btn-xs btn-ghost text-amber-300/70"
                >
                  Cancel
                </button>
                <button
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
                      await queryClient.invalidateQueries({ queryKey: ['catalog', id] })
                      invalidateAllCatalogConsumers()
                    } catch {
                      setEditError('Failed to save. Please try again.')
                    } finally {
                      setEditSaving(false)
                    }
                  }}
                  className="btn btn-xs bg-amber-600 hover:bg-amber-500 border-none text-white btn-bevel"
                >
                  {editSaving ? <span className="loading loading-spinner loading-xs" /> : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-display text-amber-100">{item.bean_name}</h1>
              <p className="text-amber-200/70">{item.roaster}</p>
              <span className="badge badge-sm text-xs mt-2 bg-amber-900/25 text-amber-300 border border-amber-600/30">
                {item.roast_level}
              </span>
              <div className="mt-2">
                <button
                  onClick={() => {
                    setEditRoaster(item.roaster)
                    setEditBeanName(item.bean_name)
                    setEditRoastLevel(item.roast_level)
                    setEditProductUrl(item.product_url ?? '')
                    setEditError(null)
                    setImageError(null)
                    setEditing(true)
                  }}
                  className="btn btn-xs btn-outline border border-amber-600/40 text-amber-300 hover:bg-amber-800/40 appearance-none btn-bevel"
                >
                  Edit
                </button>
              </div>
            </>
          )}
        </div>
      </div>
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
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-display text-amber-200">Bags</h2>
          <button
            onClick={() => { setAddingBag(true); setBagError(null) }}
            className="btn btn-xs bg-amber-700 hover:bg-amber-600 border-none text-white overflow-hidden btn-bevel"
          >
            + Add bag
          </button>
        </div>

        {addingBag && (
          <div className="glass-card card-bevel p-4 mb-3 space-y-3">
            <div className="flex gap-3 flex-wrap">
              <div className="flex-1 min-w-[140px]">
                <label className="label text-xs text-amber-200/70 pb-1">Roast date</label>
                <input
                  type="date"
                  value={bagRoastDate}
                  onChange={(e) => setBagRoastDate(e.target.value)}
                  className="input input-bordered input-sm w-full bg-stone-800 border-amber-900/40 text-amber-100"
                />
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="label text-xs text-amber-200/70 pb-1">Roast level</label>
                <select
                  value={bagRoastLevel}
                  onChange={(e) => setBagRoastLevel(e.target.value)}
                  className="select select-bordered select-sm w-full bg-stone-800 border-amber-900/40 text-amber-100"
                >
                  <option value="">Select…</option>
                  {ROAST_LEVELS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>
            {bagError && <p className="text-xs text-red-400">{bagError}</p>}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setAddingBag(false); setBagRoastDate(''); setBagRoastLevel('') }}
                className="btn btn-xs btn-ghost text-amber-300/70"
              >
                Cancel
              </button>
              <button
                disabled={bagSaving || !bagRoastDate || !bagRoastLevel}
                onClick={async () => {
                  setBagSaving(true)
                  setBagError(null)
                  try {
                    await createInventoryBag(id!, { roast_date: bagRoastDate, roast_level: bagRoastLevel })
                    setAddingBag(false)
                    setBagRoastDate('')
                    setBagRoastLevel('')
                    queryClient.invalidateQueries({ queryKey: ['catalog', id] })
                    queryClient.invalidateQueries({ queryKey: ['inventory'] })
                    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
                  } catch {
                    setBagError('Failed to add bag. Please try again.')
                  } finally {
                    setBagSaving(false)
                  }
                }}
              className="btn btn-xs bg-amber-600 hover:bg-amber-500 border-none text-white btn-bevel"
              >
                {bagSaving ? <span className="loading loading-spinner loading-xs" /> : 'Save bag'}
              </button>
            </div>
          </div>
        )}

        {bags.length === 0 ? (
          <p className="text-amber-200/60 text-sm">No bags in inventory.</p>
        ) : (
          <div className="space-y-2">
            {bags.map((bag) => (
              <div key={bag.bag_id} className="glass-card card-bevel px-4 py-3 flex items-center gap-3">
                <div>
                  {bag.roast_date && (
                    <p data-testid="bag-roast-date" className="text-sm text-amber-300 mt-0.5">{bag.roast_date}</p>
                  )}
                  <p data-testid="bag-status" className="text-sm text-amber-300 capitalize">{bag.status}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Brew history */}
      <section>
        <h2 className="text-lg font-display text-amber-200 mb-3">Brew history</h2>
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

