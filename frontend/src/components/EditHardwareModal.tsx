import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateHardware } from '../api/hardware'
import type { HardwareDetail, HardwareItem } from '../types/entities'
import { useHouseholdQueryScope } from '../contexts/AuthContext'
import { householdKeys } from '../api/queryKeys'
import AccessibleDialog from './AccessibleDialog'
import { FormField, Input, ModalFooter } from './ui'
import { COPY } from '../copy'

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
      setSaveError(COPY.modals.editHardware.saveError)
    },
  })

  const canSave = name.trim().length > 0 && !isPending

  return (
    <AccessibleDialog open title={COPY.modals.editHardware.title} onClose={onClose}>
      <div className="kaapi-content-surface space-y-4 p-4 sm:p-5">
        <FormField label={COPY.modals.editHardware.nameLabel} htmlFor="edit-hardware-name">
          <Input
            id="edit-hardware-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </FormField>

        <ModalFooter
          status={saveError}
          secondary={{ label: COPY.actions.cancel, onClick: onClose }}
          primary={{
            label: COPY.modals.editHardware.save,
            onClick: () => mutate(),
            loading: isPending,
            disabled: !canSave,
          }}
        />
      </div>
    </AccessibleDialog>
  )
}
