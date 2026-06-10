import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateHardware } from '../api/hardware'
import type { HardwareDetail, HardwareItem } from '../types/entities'
import { useHouseholdQueryScope } from '../contexts/AuthContext'
import { householdKeys } from '../api/queryKeys'

interface EditHardwareModalProps {
  hardware: HardwareItem
  onClose: () => void
  onSaved: () => void
}

export default function EditHardwareModal({ hardware, onClose, onSaved }: EditHardwareModalProps) {
  const queryClient = useQueryClient()
  const activeHouseholdId = useHouseholdQueryScope()
  const [name, setName] = useState(hardware.name)
  const [saveError, setSaveError] = useState<string | null>(null)

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      updateHardware(hardware.hardware_id, { name, category: hardware.category }),
    onSuccess: async (updatedHardware) => {
      queryClient.setQueryData<HardwareItem[]>(householdKeys.hardware(activeHouseholdId), (existing = []) =>
        existing.map((item) => item.hardware_id === updatedHardware.hardware_id ? updatedHardware : item)
      )
      queryClient.setQueryData<HardwareDetail>(
        householdKeys.hardwareDetail(activeHouseholdId, hardware.hardware_id),
        (existing) => existing
          ? { ...existing, item: updatedHardware }
          : { item: updatedHardware, maintenance: [] }
      )
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: householdKeys.hardware(activeHouseholdId), refetchType: 'inactive' }),
        queryClient.invalidateQueries({ queryKey: householdKeys.hardwareDetail(activeHouseholdId, hardware.hardware_id), refetchType: 'inactive' }),
      ])
      onSaved()
      onClose()
    },
    onError: () => {
      setSaveError("Couldn't update hardware. Please try again.")
    },
  })

  const canSave = name.trim().length > 0 && !isPending

  return (
    <dialog className="modal modal-open glass-modal-backdrop" open>
      <div className="modal-box bg-stone-900 border border-amber-900/30 glass-modal-surface">
        <h3 className="font-semibold text-lg text-amber-300 mb-4">Edit hardware</h3>

        <div className="flex flex-col gap-3">
          <div>
            <label className="label text-sm text-amber-200/70 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
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
                : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop" onClick={onClose} />
    </dialog>
  )
}
