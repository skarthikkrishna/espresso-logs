import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createMaintenance } from '../api/maintenance'
import { getActionTypes } from '../api/hardware'
import type { HardwareItem } from '../types/entities'
import { useHouseholdQueryScope } from '../contexts/AuthContext'
import { householdKeys } from '../api/queryKeys'

interface LogMaintenanceModalProps {
  hardware: HardwareItem
  onClose: () => void
  onSaved: () => void
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

export default function LogMaintenanceModal({ hardware, onClose, onSaved }: LogMaintenanceModalProps) {
  const queryClient = useQueryClient()
  const activeHouseholdId = useHouseholdQueryScope()
  const today = todayISO()

  const [date, setDate] = useState(today)
  const [actionType, setActionType] = useState('')
  const [notes, setNotes] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)

  // Load action types from API — keyed globally so result is shared/cached
  const { data: actionTypesData, isLoading: actionTypesLoading, isError: actionTypesError } = useQuery({
    queryKey: householdKeys.actionTypes(activeHouseholdId),
    queryFn: getActionTypes,
    staleTime: Infinity,   // action types are static — no need to re-fetch
  })

  const validActionTypes: string[] = actionTypesData?.action_types[hardware.category] ?? []

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      createMaintenance({
        hardware_id: hardware.hardware_id,
        action_type: actionType,
        date,
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: householdKeys.hardwareDetail(activeHouseholdId, hardware.hardware_id) })
      onSaved()
      onClose()
    },
    onError: () => {
      setSaveError("Couldn't log maintenance. Please try again.")
    },
  })

  const isFutureDate = date > today
  const canSave =
    !isPending &&
    !actionTypesLoading &&
    !actionTypesError &&
    actionType !== '' &&
    date !== '' &&
    !isFutureDate

  return (
    <dialog className="modal modal-open glass-modal-backdrop" open>
      <div className="modal-box bg-stone-900 border border-amber-900/30 glass-modal-surface">
        <h3 className="font-semibold text-lg text-amber-300 mb-4">Log maintenance</h3>

        <div className="flex flex-col gap-3">
          {/* Hardware name (read-only) */}
          <div>
            <label className="label text-sm text-amber-200/70 mb-1">Hardware</label>
            <p className="text-amber-100 text-sm px-1">{hardware.name}</p>
          </div>

          {/* Date */}
          <div>
            <label className="label text-sm text-amber-200/70 mb-1">Date</label>
            <input
              type="date"
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value)}
              className="input input-bordered input-sm w-full input-styled"
            />
            {isFutureDate && (
              <p className="text-xs text-amber-400/80 mt-1">Date cannot be in the future.</p>
            )}
          </div>

          {/* Action type */}
          <div>
            <label className="label text-sm text-amber-200/70 mb-1">Action type</label>
            {actionTypesLoading ? (
              <div className="flex items-center gap-2 text-amber-200/50 text-sm">
                <span className="loading loading-spinner loading-xs" />
                Loading action types…
              </div>
            ) : actionTypesError ? (
              <p className="text-xs text-red-400">
                Couldn't load action types. Close and try again.
              </p>
            ) : (
              <select
                value={actionType}
                onChange={(e) => setActionType(e.target.value)}
                className="select select-bordered select-sm w-full input-styled"
              >
                <option value="">Select action…</option>
                {validActionTypes.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="label text-sm text-amber-200/70 mb-1">
              Notes <span className="text-amber-400/50">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="textarea textarea-bordered textarea-sm w-full input-styled"
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
              className="btn btn-sm btn-primary btn-bevel"
            >
              {isPending
                ? <span className="loading loading-spinner loading-xs" />
                : 'Save'}
            </button>
          </div>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop" onClick={onClose} />
    </dialog>
  )
}
