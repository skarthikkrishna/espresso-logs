import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createHardware } from '../api/hardware'
import type { HardwareItem } from '../types/entities'

interface AddHardwareModalProps {
  initialCategory?: HardwareItem['category']
  onClose: () => void
  onSaved: (newId: string) => void
}

const CATEGORIES: HardwareItem['category'][] = ['Machine', 'Grinder', 'Basket', 'Storage']

export default function AddHardwareModal({ initialCategory, onClose, onSaved }: AddHardwareModalProps) {
  const queryClient = useQueryClient()
  const [category, setCategory] = useState<string>(initialCategory ?? '')
  const [name, setName] = useState('')
  const [productUrl, setProductUrl] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      createHardware({
        category,
        name,
        product_url: productUrl.trim() || undefined,
      }),
    onSuccess: (item) => {
      queryClient.invalidateQueries({ queryKey: ['hardware'] })
      onSaved(item.hardware_id)
    },
    onError: () => {
      setSaveError("Couldn't save hardware. Please try again.")
    },
  })

  const canSave = category !== '' && name.trim().length > 0 && !isPending

  return (
    <dialog className="modal modal-open glass-modal-backdrop" open>
      <div className="modal-box bg-stone-900 border border-amber-900/30 glass-modal-surface">
        <h3 className="font-semibold text-lg text-amber-300 mb-4">Add hardware</h3>

        <div className="flex flex-col gap-3">
          {/* Category */}
          <div>
            <label className="label text-sm text-amber-200/70 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="select select-bordered select-sm w-full bg-stone-800 border-amber-900/40 text-amber-100 input-styled"
            >
              <option value="">Select category…</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Name */}
          <div>
            <label className="label text-sm text-amber-200/70 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Breville Barista Express"
              className="input input-bordered input-sm w-full bg-stone-800 border-amber-900/40 text-amber-100 input-styled"
            />
          </div>

          {/* Product URL — type="url" for mobile keyboard + browser URL hints */}
          <div>
            <label className="label text-sm text-amber-200/70 mb-1">
              Product URL <span className="text-amber-400/50">(optional — for auto-image)</span>
            </label>
            <input
              type="url"
              value={productUrl}
              onChange={(e) => setProductUrl(e.target.value)}
              placeholder="https://…"
              className="input input-bordered input-sm w-full bg-stone-800 border-amber-900/40 text-amber-100 input-styled"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="modal-action mt-4 flex-col items-stretch gap-2">
          {saveError && (
            <p className="text-xs text-red-400 text-center w-full">{saveError}</p>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="btn btn-sm btn-ghost text-amber-300/70">
              Cancel
            </button>
            <button
              onClick={() => mutate()}
              disabled={!canSave}
              className="btn btn-sm bg-amber-600 hover:bg-amber-500 border-none text-white btn-bevel"
            >
              {isPending
                ? <span className="loading loading-spinner loading-xs" />
                : 'Save hardware'}
            </button>
          </div>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop" onClick={onClose} />
    </dialog>
  )
}
