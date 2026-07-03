import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createHardware } from '../api/hardware'
import type { HardwareDetail, HardwareItem } from '../types/entities'
import { useHouseholdQueryScope } from '../contexts/AuthContext'
import { householdKeys } from '../api/queryKeys'
import AccessibleDialog from './AccessibleDialog'
import { FormField, Input, Select, ModalFooter } from './ui'
import { COPY } from '../copy'

interface AddHardwareModalProps {
  initialCategory?: HardwareItem['category']
  onClose: () => void
  onSaved: (newId: string) => void
}

const CATEGORIES: HardwareItem['category'][] = ['Machine', 'Grinder', 'Basket', 'Storage']

export default function AddHardwareModal({ initialCategory, onClose, onSaved }: AddHardwareModalProps) {
  const queryClient = useQueryClient()
  const activeHouseholdId = useHouseholdQueryScope()
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
    onSuccess: async (item) => {
      queryClient.setQueryData<HardwareItem[]>(householdKeys.hardware(activeHouseholdId), (existing = []) =>
        existing.some((hardware) => hardware.hardware_id === item.hardware_id)
          ? existing.map((hardware) => hardware.hardware_id === item.hardware_id ? item : hardware)
          : [...existing, item]
      )
      queryClient.setQueryData<HardwareDetail>(householdKeys.hardwareDetail(activeHouseholdId, item.hardware_id), {
        item,
        maintenance: [],
      })
      await queryClient.invalidateQueries({ queryKey: householdKeys.hardware(activeHouseholdId), refetchType: 'inactive' })
      onSaved(item.hardware_id)
    },
    onError: () => {
      setSaveError(COPY.modals.addHardware.saveError)
    },
  })

  const canSave = category !== '' && name.trim().length > 0 && !isPending

  return (
    <AccessibleDialog open title={COPY.modals.addHardware.title} onClose={onClose}>
      <div className="kaapi-content-surface space-y-4 p-4 sm:p-5">
        <FormField label={COPY.modals.addHardware.categoryLabel} htmlFor="add-hardware-category">
          <Select
            id="add-hardware-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">{COPY.modals.addHardware.categoryPlaceholder}</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </FormField>

        <FormField label={COPY.modals.addHardware.nameLabel} htmlFor="add-hardware-name">
          <Input
            id="add-hardware-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={COPY.modals.addHardware.namePlaceholder}
          />
        </FormField>

        {/* Product URL — type="url" for mobile keyboard + browser URL hints */}
        <FormField
          label={COPY.modals.addHardware.urlLabel}
          htmlFor="add-hardware-url"
          hint={COPY.modals.addHardware.urlHint}
        >
          <Input
            id="add-hardware-url"
            type="url"
            value={productUrl}
            onChange={(e) => setProductUrl(e.target.value)}
            placeholder={COPY.modals.addHardware.urlPlaceholder}
          />
        </FormField>

        <ModalFooter
          status={saveError}
          secondary={{ label: COPY.actions.cancel, onClick: onClose }}
          primary={{
            label: COPY.modals.addHardware.save,
            onClick: () => mutate(),
            loading: isPending,
            disabled: !canSave,
          }}
        />
      </div>
    </AccessibleDialog>
  )
}
