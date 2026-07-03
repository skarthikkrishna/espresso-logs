import { useState } from 'react'
import axios from 'axios'
import { Link } from 'react-router-dom'
import { inferCatalogItem, createCatalogItem, uploadCatalogImage } from '../api/catalog'
import type { CatalogItem } from '../types/entities'
import { ROAST_LEVELS } from '../utils/roastLevels'
import AccessibleDialog from './AccessibleDialog'
import { Button, FormField, Input, Select, ModalFooter } from './ui'
import { COPY } from '../copy'

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
    if (!roaster.trim()) errors.roaster = COPY.modals.addBean.roasterRequired
    if (!beanName.trim()) errors.beanName = COPY.modals.addBean.beanNameRequired
    if (!roastLevel) errors.roastLevel = COPY.modals.addBean.roastLevelRequired
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
          setImageUploadError(COPY.modals.addBean.imageUploadFailed)
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
              ? COPY.modals.addBean.requiredMissing(names.join(', '))
              : COPY.modals.addBean.validationFailed,
          )
        } else {
          setSaveError(COPY.modals.addBean.validationFailed)
        }
      } else {
        setSaveError(COPY.modals.addBean.saveFailed)
      }
    } finally {
      setSavePhase('idle')
    }
  }

  const showForm = manualMode || inferredFields !== null
  const saving = savePhase !== 'idle'

  return (
    <AccessibleDialog open title={COPY.modals.addBean.title} onClose={onClose}>
      <div className="kaapi-content-surface space-y-4 p-4 sm:p-5">
        {/* URL lookup */}
        <FormField label={COPY.modals.addBean.urlLabel} htmlFor="bean-product-url" hint={COPY.modals.addBean.urlHint}>
          <div className="flex gap-2">
            <Input
              id="bean-product-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={COPY.modals.addBean.urlPlaceholder}
              className="min-w-0 flex-1"
            />
            <Button
              type="button"
              variant="primary"
              onClick={handleInfer}
              disabled={loading || url.trim() === ''}
              loading={loading}
            >
              {COPY.modals.addBean.lookUp}
            </Button>
          </div>
          {inferError && (
            <p className="mt-1 text-sm text-[var(--kaapi-content-muted)]">
              {COPY.modals.addBean.inferError}
            </p>
          )}
        </FormField>

        {/* Manual entry toggle */}
        {!manualMode && (
          <Button type="button" variant="ghost" onClick={() => setManualMode(true)}>
            {COPY.modals.addBean.enterManually}
          </Button>
        )}

        {/* Form fields */}
        {showForm && (
          <div className="space-y-4">
            <FormField
              label={COPY.modals.addBean.roasterLabel}
              htmlFor="manual-roaster"
              required
              error={touched.roaster && fieldErrors.roaster ? fieldErrors.roaster : undefined}
              errorId="manual-roaster-error"
            >
              <Input
                id="manual-roaster"
                type="text"
                value={roaster}
                error={Boolean(touched.roaster && fieldErrors.roaster)}
                aria-invalid={touched.roaster && fieldErrors.roaster ? 'true' : 'false'}
                aria-describedby={touched.roaster && fieldErrors.roaster ? 'manual-roaster-error' : undefined}
                onChange={(e) => { setRoaster(e.target.value); if (touched.roaster) setFieldErrors(prev => ({ ...prev, roaster: e.target.value.trim() ? undefined : COPY.modals.addBean.roasterRequired })) }}
                onBlur={() => { setTouched(prev => ({ ...prev, roaster: true })); setFieldErrors(prev => ({ ...prev, roaster: roaster.trim() ? undefined : COPY.modals.addBean.roasterRequired })) }}
              />
            </FormField>

            <FormField
              label={COPY.modals.addBean.beanNameLabel}
              htmlFor="manual-bean-name"
              required
              error={touched.beanName && fieldErrors.beanName ? fieldErrors.beanName : undefined}
              errorId="manual-bean-name-error"
            >
              <Input
                id="manual-bean-name"
                type="text"
                value={beanName}
                error={Boolean(touched.beanName && fieldErrors.beanName)}
                aria-invalid={touched.beanName && fieldErrors.beanName ? 'true' : 'false'}
                aria-describedby={touched.beanName && fieldErrors.beanName ? 'manual-bean-name-error' : undefined}
                onChange={(e) => { setBeanName(e.target.value); if (touched.beanName) setFieldErrors(prev => ({ ...prev, beanName: e.target.value.trim() ? undefined : COPY.modals.addBean.beanNameRequired })) }}
                onBlur={() => { setTouched(prev => ({ ...prev, beanName: true })); setFieldErrors(prev => ({ ...prev, beanName: beanName.trim() ? undefined : COPY.modals.addBean.beanNameRequired })) }}
              />
            </FormField>

            <FormField
              label={COPY.modals.addBean.roastLevelLabel}
              htmlFor="manual-roast-level"
              required
              error={touched.roastLevel && fieldErrors.roastLevel ? fieldErrors.roastLevel : undefined}
              errorId="manual-roast-level-error"
            >
              <Select
                id="manual-roast-level"
                value={roastLevel}
                error={Boolean(touched.roastLevel && fieldErrors.roastLevel)}
                aria-invalid={touched.roastLevel && fieldErrors.roastLevel ? 'true' : 'false'}
                aria-describedby={touched.roastLevel && fieldErrors.roastLevel ? 'manual-roast-level-error' : undefined}
                onChange={(e) => { setRoastLevel(e.target.value); setTouched(prev => ({ ...prev, roastLevel: true })); setFieldErrors(prev => ({ ...prev, roastLevel: e.target.value ? undefined : COPY.modals.addBean.roastLevelRequired })) }}
                onBlur={() => { setTouched(prev => ({ ...prev, roastLevel: true })); setFieldErrors(prev => ({ ...prev, roastLevel: roastLevel ? undefined : COPY.modals.addBean.roastLevelRequired })) }}
              >
                <option value="">{COPY.modals.addBean.selectRoast}</option>
                {ROAST_LEVELS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </Select>
            </FormField>

            <FormField label={COPY.modals.addBean.imageLabel} htmlFor="manual-bean-image" hint={COPY.modals.addBean.imageHint}>
              <input
                id="manual-bean-image"
                type="file"
                accept="image/*"
                disabled={saving || Boolean(createdItem)}
                className="file-input file-input-bordered w-full input-styled"
                onChange={(e) => {
                  setSelectedImage(e.target.files?.[0] ?? null)
                  setImageUploadError(null)
                }}
              />
              <p className="mt-1 text-sm text-[var(--kaapi-content-muted)]">{COPY.modals.addBean.imageHelp}</p>
              {selectedImage && (
                <p className="mt-1 text-sm text-[var(--kaapi-content-content)]">{COPY.modals.addBean.selectedImage(selectedImage.name)}</p>
              )}
            </FormField>
          </div>
        )}

        {/* Image-upload warning (bean saved, image failed) */}
        {imageUploadError && (
          <div className="rounded-[var(--bevel-radius)] border border-amber-700/40 bg-amber-100/70 p-3 text-sm text-[var(--kaapi-content-content)]">
            <p>{imageUploadError}</p>
            {createdItem && (
              <Link
                to={`/catalog/${createdItem.catalog_id}`}
                onClick={onClose}
                className="mt-2 inline-block font-medium text-amber-800 underline underline-offset-2"
              >
                {COPY.modals.addBean.openSavedDetail}
              </Link>
            )}
          </div>
        )}

        <ModalFooter
          status={saveError}
          secondary={{ label: COPY.actions.cancel, onClick: onClose }}
          primary={showForm ? {
            label: COPY.modals.addBean.save,
            onClick: handleSave,
            loading: saving,
            loadingText: savePhase === 'creating' ? COPY.modals.addBean.creating : COPY.modals.addBean.uploading,
            disabled: saving || Boolean(createdItem),
          } : undefined}
        />
      </div>
    </AccessibleDialog>
  )
}
