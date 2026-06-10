import { useState } from 'react'
import axios from 'axios'
import { Link } from 'react-router-dom'
import { inferCatalogItem, createCatalogItem, uploadCatalogImage } from '../api/catalog'
import type { CatalogItem } from '../types/entities'
import { ROAST_LEVELS } from '../utils/roastLevels'

type InferredFields = {
  roaster: string
  bean_name: string
  roast_level: string
  image_path: string | null
}

interface AddBeanModalProps {
  onClose: () => void
  onSaved: (item?: CatalogItem) => void
}

type SavePhase = 'idle' | 'creating' | 'uploading'

export default function AddBeanModal({ onClose, onSaved }: AddBeanModalProps) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [savePhase, setSavePhase] = useState<SavePhase>('idle')
  const [inferredFields, setInferredFields] = useState<InferredFields | null>(null)
  const [manualMode, setManualMode] = useState(false)
  const [roaster, setRoaster] = useState('')
  const [beanName, setBeanName] = useState('')
  const [roastLevel, setRoastLevel] = useState('')
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [createdItem, setCreatedItem] = useState<CatalogItem | null>(null)
  const [inferError, setInferError] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [imageUploadError, setImageUploadError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ roaster?: string; beanName?: string; roastLevel?: string }>({})
  const [touched, setTouched] = useState<{ roaster?: boolean; beanName?: boolean; roastLevel?: boolean }>({})

  const handleInfer = async () => {
    setLoading(true)
    setInferError(false)
    try {
      const result = await inferCatalogItem(url)
      setInferredFields(result)
      if (!result.roaster && !result.bean_name && !result.roast_level) {
        setInferError(true)
        setManualMode(true)
      } else {
        setRoaster(result.roaster)
        setBeanName(result.bean_name)
        setRoastLevel(result.roast_level)
        setManualMode(true)
      }
    } catch {
      setInferError(true)
      setManualMode(true)
    } finally {
      setLoading(false)
    }
  }

  const validate = () => {
    const errors: typeof fieldErrors = {}
    if (!roaster.trim()) errors.roaster = 'Roaster is required'
    if (!beanName.trim()) errors.beanName = 'Bean name is required'
    if (!roastLevel) errors.roastLevel = 'Roast level is required'
    return errors
  }

  const handleSave = async () => {
    const errors = validate()
    setTouched({ roaster: true, beanName: true, roastLevel: true })
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSavePhase('creating')
    setSaveError(null)
    setImageUploadError(null)
    try {
      const created = await createCatalogItem({
        roaster,
        bean_name: beanName,
        roast_level: roastLevel,
        product_url: url || undefined,
        source_image_url: inferredFields?.image_path ?? undefined,
      })
      setCreatedItem(created)
      if (selectedImage) {
        setSavePhase('uploading')
        try {
          const { image_path } = await uploadCatalogImage(created.catalog_id, selectedImage)
          onSaved({ ...created, image_path })
          onClose()
        } catch {
          onSaved(created)
          setImageUploadError(
            'Bean saved, but image upload failed. Open the saved bean detail and choose Replace image to retry.',
          )
        }
        return
      }
      onSaved(created)
      onClose()
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 422) {
        const detail = err.response.data?.detail
        if (typeof detail === 'string') {
          setSaveError(detail)
        } else if (Array.isArray(detail)) {
          const names = detail
            .map((d: { loc?: string[] }) => d.loc?.[d.loc.length - 1])
            .filter(Boolean)
          setSaveError(
            names.length
              ? `Required fields missing: ${names.join(', ')}`
              : 'Validation failed. Please check required fields.',
          )
        } else {
          setSaveError('Validation failed. Please check required fields.')
        }
      } else {
        setSaveError('Failed to save bean. Please try again.')
      }
    } finally {
      setSavePhase('idle')
    }
  }

  const showForm = manualMode || inferredFields !== null
  const saving = savePhase !== 'idle'
  const saveButtonLabel = savePhase === 'creating'
    ? 'Creating bean…'
    : savePhase === 'uploading'
      ? 'Uploading image…'
      : 'Save bean'

  return (
    <dialog open className="modal modal-open glass-modal-backdrop">
      <div className="modal-box bg-stone-900 border border-amber-900/30 glass-modal-surface">
        <h3 className="font-semibold text-lg text-amber-300 mb-4">Add bean</h3>

        {/* URL lookup */}
        <div className="mb-3">
          <label className="label text-sm text-amber-200/70 mb-1" htmlFor="bean-product-url">Product URL (optional)</label>
          <div className="flex gap-2">
            <input
              id="bean-product-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="input input-bordered input-sm flex-1 input-styled"
            />
            <button
              onClick={handleInfer}
              disabled={loading || url.trim() === ''}
              className="btn btn-sm btn-primary btn-bevel"
            >
              {loading ? <span className="loading loading-spinner loading-xs" /> : 'Look up'}
            </button>
          </div>
          {inferError && (
            <p className="text-xs text-amber-400/80 mt-1">
              Couldn't look up that URL. Enter details manually.
            </p>
          )}
        </div>

        {/* Manual entry link */}
        {!manualMode && (
          <button
            onClick={() => setManualMode(true)}
            className="text-xs text-amber-400/70 underline mb-3 block"
          >
            Enter manually
          </button>
        )}

        {/* Form fields */}
        {showForm && (
          <div className="flex flex-col gap-3 mt-2">
            <div>
              <label className="label text-sm text-amber-200/70 mb-1" htmlFor="manual-roaster">
                Roaster <span className="text-error">*</span>
              </label>
              <input
                id="manual-roaster"
                type="text"
                value={roaster}
                onChange={(e) => { setRoaster(e.target.value); if (touched.roaster) setFieldErrors(prev => ({ ...prev, roaster: e.target.value.trim() ? undefined : 'Roaster is required' })) }}
                onBlur={() => { setTouched(prev => ({ ...prev, roaster: true })); setFieldErrors(prev => ({ ...prev, roaster: roaster.trim() ? undefined : 'Roaster is required' })) }}
                className={`input input-bordered input-sm w-full input-styled${touched.roaster && fieldErrors.roaster ? ' border-error' : ''}`}
              />
              {touched.roaster && fieldErrors.roaster && (
                <p className="text-xs text-error mt-1">{fieldErrors.roaster}</p>
              )}
            </div>
            <div>
              <label className="label text-sm text-amber-200/70 mb-1" htmlFor="manual-bean-name">
                Bean name <span className="text-error">*</span>
              </label>
              <input
                id="manual-bean-name"
                type="text"
                value={beanName}
                onChange={(e) => { setBeanName(e.target.value); if (touched.beanName) setFieldErrors(prev => ({ ...prev, beanName: e.target.value.trim() ? undefined : 'Bean name is required' })) }}
                onBlur={() => { setTouched(prev => ({ ...prev, beanName: true })); setFieldErrors(prev => ({ ...prev, beanName: beanName.trim() ? undefined : 'Bean name is required' })) }}
                className={`input input-bordered input-sm w-full input-styled${touched.beanName && fieldErrors.beanName ? ' border-error' : ''}`}
              />
              {touched.beanName && fieldErrors.beanName && (
                <p className="text-xs text-error mt-1">{fieldErrors.beanName}</p>
              )}
            </div>
            <div>
              <label className="label text-sm text-amber-200/70 mb-1" htmlFor="manual-roast-level">
                Roast level <span className="text-error">*</span>
              </label>
              <select
                id="manual-roast-level"
                value={roastLevel}
                onChange={(e) => { setRoastLevel(e.target.value); setTouched(prev => ({ ...prev, roastLevel: true })); setFieldErrors(prev => ({ ...prev, roastLevel: e.target.value ? undefined : 'Roast level is required' })) }}
                onBlur={() => { setTouched(prev => ({ ...prev, roastLevel: true })); setFieldErrors(prev => ({ ...prev, roastLevel: roastLevel ? undefined : 'Roast level is required' })) }}
                className={`select select-bordered select-sm w-full input-styled${touched.roastLevel && fieldErrors.roastLevel ? ' border-error' : ''}`}
              >
                <option value="">Select...</option>
                {ROAST_LEVELS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              {touched.roastLevel && fieldErrors.roastLevel && (
                <p className="text-xs text-error mt-1">{fieldErrors.roastLevel}</p>
              )}
            </div>
            <div>
              <label className="label text-sm text-amber-200/70 mb-1" htmlFor="manual-bean-image">
                Bean image (optional)
              </label>
              <input
                id="manual-bean-image"
                type="file"
                accept="image/*"
                disabled={saving || Boolean(createdItem)}
                className="file-input file-input-bordered file-input-sm w-full input-styled"
                onChange={(e) => {
                  setSelectedImage(e.target.files?.[0] ?? null)
                  setImageUploadError(null)
                }}
              />
              <p className="text-xs text-amber-200/50 mt-1">Choose a JPG, PNG, or other image file to upload after the bean is saved.</p>
              {selectedImage && (
                <p className="text-xs text-amber-300 mt-1">Selected: {selectedImage.name}</p>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="modal-action mt-4 flex-col items-stretch gap-2">
          {saveError && (
            <p className="text-xs text-red-400 text-center w-full">{saveError}</p>
          )}
          {imageUploadError && (
            <div className="rounded-lg border border-amber-700/40 bg-amber-950/50 p-3 text-xs text-amber-100">
              <p>{imageUploadError}</p>
              {createdItem && (
                <Link
                  to={`/catalog/${createdItem.catalog_id}`}
                  onClick={onClose}
                  className="link link-warning mt-2 inline-block"
                >
                  Open saved bean detail
                </Link>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="btn btn-sm btn-ghost text-amber-300/70"
          >
            Cancel
          </button>
          {showForm && (
            <button
              onClick={handleSave}
              disabled={saving || Boolean(createdItem)}
              className="btn btn-sm btn-primary btn-bevel"
            >
              {saving && <span className="loading loading-spinner loading-xs mr-2" />}
              {saveButtonLabel}
            </button>
          )}
          </div>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop" onClick={onClose} />
    </dialog>
  )
}
