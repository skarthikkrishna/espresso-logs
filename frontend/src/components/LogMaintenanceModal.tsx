import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createMaintenance } from '../api/maintenance'
import { getActionTypes } from '../api/hardware'
import type { HardwareItem } from '../types/entities'
import { useHouseholdQueryScope } from '../contexts/AuthContext'
import { householdKeys } from '../api/queryKeys'
import AccessibleDialog from './AccessibleDialog'
import { FormField, Input, Select, Textarea, ModalFooter } from './ui'
import { COPY } from '../copy'

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
      setSaveError(COPY.modals.logMaintenance.saveError)
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
    <AccessibleDialog open title={COPY.modals.logMaintenance.title} onClose={onClose}>
      <div className="kaapi-content-surface space-y-4 p-4 sm:p-5">
        {/* Hardware name (read-only) */}
        <FormField label={COPY.modals.logMaintenance.hardwareLabel}>
          <p className="px-0.5 text-[var(--kaapi-content-content)]">{hardware.name}</p>
        </FormField>

        {/* Date */}
        <FormField
          label={COPY.modals.logMaintenance.dateLabel}
          htmlFor="maintenance-date"
          error={isFutureDate ? COPY.modals.logMaintenance.futureDateError : undefined}
        >
          <Input
            id="maintenance-date"
            type="date"
            value={date}
            max={today}
            error={isFutureDate}
            onChange={(e) => setDate(e.target.value)}
          />
        </FormField>

        {/* Action type */}
        <FormField label={COPY.modals.logMaintenance.actionTypeLabel} htmlFor="maintenance-action-type">
          {actionTypesLoading ? (
            <div className="flex items-center gap-2 text-sm text-[var(--kaapi-content-muted)]">
              <span aria-hidden="true" className="loading loading-spinner loading-sm" />
              {COPY.modals.logMaintenance.loadingActionTypes}
            </div>
          ) : actionTypesError ? (
            <p role="alert" className="text-error text-sm">
              {COPY.modals.logMaintenance.actionTypesError}
            </p>
          ) : (
            <Select
              id="maintenance-action-type"
              value={actionType}
              onChange={(e) => setActionType(e.target.value)}
            >
              <option value="">{COPY.modals.logMaintenance.actionPlaceholder}</option>
              {validActionTypes.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </Select>
          )}
        </FormField>

        {/* Notes */}
        <FormField
          label={COPY.modals.logMaintenance.notesLabel}
          htmlFor="maintenance-notes"
          hint={COPY.modals.logMaintenance.notesHint}
        >
          <Textarea
            id="maintenance-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </FormField>

        <ModalFooter
          status={saveError}
          secondary={{ label: COPY.actions.cancel, onClick: onClose }}
          primary={{
            label: COPY.actions.save,
            onClick: () => mutate(),
            loading: isPending,
            disabled: !canSave,
          }}
        />
      </div>
    </AccessibleDialog>
  )
}
