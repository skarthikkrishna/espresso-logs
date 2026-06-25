import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listInventory } from '../api/inventory'
import { listHardware } from '../api/hardware'
import { getDefaults } from '../api/defaults'
import { brewLogDetailQueryKey, getBrewLogDetail, submitShot } from '../api/brewLog'
import { brewLogListQueryKey, dashboardQueryKey, defaultsQueryKey, householdKeys, inventoryQueryKey } from '../api/queryKeys'
import LoadingSpinner from '../components/LoadingSpinner'
import CompassChart from '../components/CompassChart'
import { getBasketDefaults } from '../utils/basketDefaults'
import { deriveZoneBoundaries } from '../utils/zoneBoundaries'
import { ShotPrefillAdapter, type ShotPrefillValues } from '../utils/shotPrefillAdapter'
import { useHouseholdQueryScope } from '../contexts/AuthContext'
import { Button, FormField, Input, PageHeader, Select, Textarea, ActionExpander } from '../components/ui'
import { useKaapiMotion } from '../lib/motion'
import { COPY } from '../copy'

const ELIGIBILITY_OPTIONS = ['Reject', 'Passable', 'Good Espresso', 'God Shot'] as const
type DirtyField = keyof ShotPrefillValues

export default function BrewLogAdd() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const activeHouseholdId = useHouseholdQueryScope()
  const routeRef = useRef<HTMLDivElement>(null)
  const { routeEnter } = useKaapiMotion({ scope: routeRef })
  const requestedBagId = searchParams.get('bag_id')?.trim() ?? ''
  const similarShotId = searchParams.get('similar_shot_id')?.trim() ?? ''
  const [bagId, setBagId] = useState('')
  const [bagParamNotice, setBagParamNotice] = useState<string | null>(null)
  const [doseG, setDoseG] = useState('')
  const [yieldG, setYieldG] = useState('')
  const [timeSec, setTimeSec] = useState('')
  const [grindSetting, setGrindSetting] = useState('')
  const [storageMethod, setStorageMethod] = useState('')
  const [notes, setNotes] = useState('')
  const [machineId, setMachineId] = useState<string>('')
  const [grinderId, setGrinderId] = useState<string>('')
  const [basketId, setBasketId] = useState<string>('')
  const [eligibility, setEligibility] = useState('')
  const [tasteSummary, setTasteSummary] = useState('')

  // Dirty-field tracking (BC-1, BC-8, FE-1)
  // useRef keeps the set current inside every closure without appearing in dep arrays.
  // Never use useState here — a stale closure over useState value silently skips dirty guards.
  const dirtyFields = useRef<Set<DirtyField>>(new Set())
  const userSelectedBagRef = useRef(false)
  const handledRequestedBagRef = useRef<string | null>(null)
  const handledSimilarShotRef = useRef<string | null>(null)
  const suppressNextBagResetRef = useRef(false)

  // Progressive disclosure (BC-4, FR-009)
  const [advancedOpen, setAdvancedOpen] = useState<boolean>(false)

  // Double-submit guard — useRef so a re-render mid-flight doesn't re-enable the button
  const isSubmittingRef = useRef(false)

  // Idempotency key — lazy initialiser ensures exactly one UUID per component mount.
  // Rotated in onSuccess to protect any future in-place-reset path.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())

  const { data: inventory, isLoading: invLoading, isError: invError, refetch: refetchInventory } = useQuery({
    queryKey: inventoryQueryKey(activeHouseholdId),
    queryFn: () => listInventory('Active'),
  })

  const {
    data: hardware,
    isLoading: hardwareIsLoading,
    isSuccess: hardwareIsSuccess,
  } = useQuery({
    queryKey: householdKeys.hardware(activeHouseholdId),
    queryFn: listHardware,
  })

  const baskets = hardware?.filter(h => h.category === 'Basket') ?? []
  const machines = hardware?.filter(h => h.category === 'Machine') ?? []
  const grinders = hardware?.filter(h => h.category === 'Grinder') ?? []
  const storageItems = hardware?.filter(h => h.category === 'Storage') ?? []

  // Derive zone boundaries from selected machine + bag roast level
  const machineName = hardware?.find(h => h.hardware_id === machineId)?.name ?? null
  const roastLevel  = inventory?.find(b => b.bag_id === bagId)?.roast_level ?? null
  const zoneBoundaries = deriveZoneBoundaries(machineName, roastLevel)

  const { data: defaults, isSuccess: defaultsIsSuccess } = useQuery({
    queryKey: defaultsQueryKey(bagId, basketId, activeHouseholdId),
    queryFn: () => getDefaults(bagId, basketId || undefined),
    enabled: !!bagId,
  })

  const { data: similarShot, isError: similarShotIsError } = useQuery({
    queryKey: brewLogDetailQueryKey(similarShotId, activeHouseholdId),
    queryFn: () => getBrewLogDetail(similarShotId),
    enabled: !!similarShotId,
  })

  /* eslint-disable react-hooks/set-state-in-effect -- Query-param bag resolution synchronizes URL state after inventory data loads. */
  useEffect(() => {
    if (!requestedBagId) {
      handledRequestedBagRef.current = null
      setBagParamNotice(null)
      return
    }
    if (!inventory) return
    if (handledRequestedBagRef.current === requestedBagId) return

    const requestedBag = inventory.find((bag) => bag.bag_id === requestedBagId && bag.status === 'Active')
    if (!requestedBag) {
      setBagParamNotice('The bag from Home is finished or unavailable. Choose an active bag below.')
      return
    }

    handledRequestedBagRef.current = requestedBagId

    if (!userSelectedBagRef.current && !bagId) {
      setBagId(requestedBag.bag_id)
      setBagParamNotice(null)
      return
    }

    if (bagId === requestedBag.bag_id) {
      setBagParamNotice(null)
    }
  }, [bagId, inventory, requestedBagId])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Reset all derived form state when the bag changes so the new bag's defaults
  // fill cleanly (threads 1 & 4 from Copilot review: dirty-field ref and
  // prev-guard pattern both block updates on bag switch).
  useEffect(() => {
    if (!bagId) return
    if (suppressNextBagResetRef.current) {
      suppressNextBagResetRef.current = false
      return
    }
    dirtyFields.current = new Set()
    setDoseG('')
    setYieldG('')
    setGrindSetting('')
    setMachineId('')
    setGrinderId('')
    setBasketId('')
    setStorageMethod('')
  }, [bagId])

  useEffect(() => {
    if (!similarShotId || !similarShot) return
    if (handledSimilarShotRef.current === similarShotId) return

    const prefill = ShotPrefillAdapter.fromBrewLogEntry(similarShot)
    const applyClean = (field: DirtyField, apply: (value: string) => void) => {
      const value = prefill[field]
      if (!value || dirtyFields.current.has(field)) return
      apply(value)
    }

    if (prefill.bagId && !dirtyFields.current.has('bagId')) {
      suppressNextBagResetRef.current = true
      setBagId(prefill.bagId)
    }
    applyClean('machineId', setMachineId)
    applyClean('grinderId', setGrinderId)
    applyClean('basketId', setBasketId)
    applyClean('doseG', setDoseG)
    applyClean('yieldG', setYieldG)
    applyClean('timeSec', setTimeSec)
    applyClean('grindSetting', setGrindSetting)
    applyClean('storageMethod', setStorageMethod)
    applyClean('eligibility', setEligibility)
    applyClean('tasteSummary', setTasteSummary)
    applyClean('notes', setNotes)
    setAdvancedOpen(true)
    handledSimilarShotRef.current = similarShotId
  }, [similarShot, similarShotId])

  // Apply bag-level defaults (Level 0/1) with dirty-field guards
  useEffect(() => {
    if (!defaults) return

    if (!dirtyFields.current.has('doseG') && defaults.dose_in_g != null)
      setDoseG(String(defaults.dose_in_g))
    if (!dirtyFields.current.has('yieldG') && defaults.yield_out_g != null)
      setYieldG(String(defaults.yield_out_g))
    if (!dirtyFields.current.has('grindSetting') && defaults.grind_setting)
      setGrindSetting(defaults.grind_setting)

    // Hardware/storage defaults are late-arriving API data and must respect dirty fields.
    if (!dirtyFields.current.has('storageMethod') && defaults.storage_method) setStorageMethod(defaults.storage_method)
    if (!dirtyFields.current.has('machineId') && defaults.machine_id) setMachineId(defaults.machine_id)
    if (!dirtyFields.current.has('grinderId') && defaults.grinder_id) setGrinderId(defaults.grinder_id)
    if (!dirtyFields.current.has('basketId') && defaults.basket_id) setBasketId(defaults.basket_id)

    // Auto-expand advanced section (BC-4, FR-009) — also when machine/grinder defaults are set
    if (defaults.grind_setting || defaults.storage_method || defaults.machine_id || defaults.grinder_id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Defaults hydration controls disclosure after async data arrives.
      setAdvancedOpen(true)
    }
  }, [defaults])

  // Basket-type fallback defaults (Level 1+) — only when no bag history exists
  useEffect(() => {
    // FE-2: gate on isSuccess — defaults may be undefined while query is in-flight
    if (!defaultsIsSuccess) return
    if (!basketId || !hardware) return

    const hasBagDefaults = defaults?.dose_in_g != null || defaults?.grind_setting != null
    if (hasBagDefaults) return // bag history suppresses all basket defaults (BC-2)

    const basket = hardware.find(h => h.hardware_id === basketId)
    if (!basket) return

    const profile = getBasketDefaults(basket.name)
    if (!profile) return

    if (!dirtyFields.current.has('doseG'))  setDoseG(String(profile.dose_in_g))
    if (!dirtyFields.current.has('yieldG')) setYieldG(String(profile.yield_out_g))
    if (!dirtyFields.current.has('grindSetting')) {
      setGrindSetting(String(profile.grind_setting))
      // Do not auto-expand — the user controls the advanced section toggle
    }
  }, [basketId, hardware, defaults, defaultsIsSuccess]) // FE-1/FE-2: dirtyFields omitted (useRef, always current)

  const mutation = useMutation({
    mutationFn: submitShot,
    onSuccess: async () => {
      setIdempotencyKey(crypto.randomUUID())
      await queryClient.invalidateQueries({ queryKey: brewLogListQueryKey(activeHouseholdId) })
      await queryClient.invalidateQueries({ queryKey: dashboardQueryKey(activeHouseholdId) })
      navigate('/brew-log?toast=shot-saved')
    },
    onSettled: () => { isSubmittingRef.current = false },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Dual guard: ref catches re-renders that briefly reset isPending; isPending catches the normal path
    if (isSubmittingRef.current || mutation.isPending) return
    isSubmittingRef.current = true
    mutation.mutate({
      bag_id: bagId,
      machine_id: machineId || '',
      grinder_id: grinderId || '',
      basket_id: basketId || '',
      dose_in_g: doseG ? parseFloat(doseG) : null,
      yield_out_g: yieldG ? parseFloat(yieldG) : null,
      time_sec: timeSec ? parseFloat(timeSec) : null,
      grind_setting: grindSetting || '',
      storage_method: storageMethod || '',
      shot_eligibility: eligibility || '',
      taste_summary: tasteSummary || '',
      user_notes: notes || '',
      idempotency_key: idempotencyKey,
    })
  }

  useEffect(() => {
    if (!invLoading && !invError && routeRef.current) routeEnter(routeRef.current)
  }, [invLoading, invError, routeEnter])

  if (invLoading) return <LoadingSpinner />
  if (invError) return (
    <div className="p-4 md:p-6">
      <div className="kaapi-content-surface mx-auto w-full max-w-md p-6 text-center">
        <p className="font-medium">{COPY.brewLogAdd.loadError}</p>
        <p className="text-[var(--kaapi-content-muted)] text-sm mt-1">{COPY.brewLogAdd.loadErrorBody}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetchInventory()}
          className="mt-3"
        >
          Retry
        </Button>
      </div>
    </div>
  )

  return (
    <div ref={routeRef} data-testid="motion-route-boundary" className="p-4 md:p-6">
      <div className="mx-auto w-full max-w-4xl">
        <PageHeader title={COPY.brewLogAdd.title} />

        <form data-testid="brew-log-add-form" onSubmit={handleSubmit} className="kaapi-content-surface mt-4 p-4 md:p-6 space-y-4">
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] lg:gap-6 lg:items-start">
            {/* Core inputs */}
            <div className="space-y-4 min-w-0">
              {/* Bag — full width */}
              <FormField label="Bag" htmlFor="brew-log-bag" required>
          <Select
            id="brew-log-bag"
            value={bagId}
            onChange={(e) => {
              userSelectedBagRef.current = true
              setBagParamNotice(null)
              dirtyFields.current.add('bagId')
              setBagId(e.target.value)
            }}
            required
          >
            <option value="">{COPY.brewLogAdd.selectBag}</option>
            {inventory?.map((bag) => (
              <option key={bag.bag_id} value={bag.bag_id}>
                {bag.display_name}
              </option>
            ))}
          </Select>
          {requestedBagId && !inventory && (
            <p className="text-xs text-[var(--kaapi-content-muted)] mt-1">{COPY.brewLogAdd.checkingBag}</p>
          )}
          {bagParamNotice && (
            <p role="status" className="text-xs text-[var(--kaapi-content-muted)] mt-1">{bagParamNotice}</p>
          )}
        </FormField>

        {/* Flat form fields: dose/yield/time, eligibility, basket (FR-004) */}
        <div className="space-y-4">
          {/* Dose / Yield / Time */}
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Dose (g)" htmlFor="brew-log-dose">
              <Input
                id="brew-log-dose"
                type="number"
                step="0.1"
                min="0"
                value={doseG}
                onChange={(e) => { dirtyFields.current.add('doseG'); setDoseG(e.target.value) }}
              />
            </FormField>
            <FormField label="Yield (g)" htmlFor="brew-log-yield">
              <Input
                id="brew-log-yield"
                type="number"
                step="0.1"
                min="0"
                value={yieldG}
                onChange={(e) => { dirtyFields.current.add('yieldG'); setYieldG(e.target.value) }}
              />
            </FormField>
            <FormField label="Time (s)" htmlFor="brew-log-time">
              <Input
                id="brew-log-time"
                type="number"
                min="0"
                value={timeSec}
                onChange={(e) => { dirtyFields.current.add('timeSec'); setTimeSec(e.target.value) }}
              />
            </FormField>
          </div>

          {/* Basket + Shot eligibility — two-col on desktop, Issue 9 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Basket first */}
            <FormField label="Basket" htmlFor="brew-log-basket">
              {hardwareIsLoading && (
                <Select id="brew-log-basket" disabled>
                  <option>{COPY.brewLogAdd.loadingBaskets}</option>
                </Select>
              )}
              {hardwareIsSuccess && baskets.length === 0 && (
                <Select id="brew-log-basket" disabled>
                  <option>{COPY.brewLogAdd.noBaskets}</option>
                </Select>
              )}
              {hardwareIsSuccess && baskets.length > 0 && (
                <Select
                  id="brew-log-basket"
                  value={basketId}
                  onChange={e => { dirtyFields.current.add('basketId'); setBasketId(e.target.value) }}
                >
                  <option value="">{COPY.brewLogAdd.selectBasket}</option>
                  {baskets.map(b => (
                    <option key={b.hardware_id} value={b.hardware_id}>{b.name}</option>
                  ))}
                </Select>
              )}
            </FormField>

            {/* Shot eligibility second */}
            <FormField label="Shot eligibility" htmlFor="brew-log-shot-eligibility" required>
              <Select
                id="brew-log-shot-eligibility"
                value={eligibility}
                onChange={e => { dirtyFields.current.add('eligibility'); setEligibility(e.target.value) }}
                required
              >
                <option value="">{COPY.brewLogAdd.selectPlaceholder}</option>
                {ELIGIBILITY_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </Select>
            </FormField>
          </div>
        </div>
          </div>

          {/* Extraction compass — dark instrument panel (design-language: Dark panel surface) */}
          <div className="mt-6 lg:mt-0 min-w-0">
            <div className="form-control">
              <p id="extraction-compass-label" className="label">
                <span className="label-text text-sm font-medium">{COPY.brewLogAdd.extractionCompass}</span>
              </p>
              <div
                className="rounded-[var(--bevel-radius)] border border-[var(--glass-border)] bg-[var(--kaapi-frame-surface)] p-3 w-full"
                role="group"
                aria-labelledby="extraction-compass-label"
              >
                <CompassChart
                  doseG={doseG ? parseFloat(doseG) : null}
                  yieldG={yieldG ? parseFloat(yieldG) : null}
                  timeSec={timeSec ? parseFloat(timeSec) : null}
                  selectedTaste={tasteSummary}
                  onSelectZone={setTasteSummary}
                  zoneBoundaries={zoneBoundaries}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Advanced toggle */}
        <ActionExpander
          expanded={advancedOpen}
          onToggle={() => setAdvancedOpen(v => !v)}
          controlsId="advanced-fields"
          showMoreLabel={COPY.brewLog.moreOptions}
          showFewerLabel={COPY.brewLog.fewerOptions}
          className="w-full justify-between"
        />

        {/* Advanced section — machine, grinder, grind setting, storage, notes */}
        <div id="advanced-fields" hidden={!advancedOpen} className="space-y-4">
          {/* Machine + Grinder — two-column row */}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Machine" htmlFor="brew-log-machine">
              <Select
                id="brew-log-machine"
                value={machineId}
                onChange={e => { dirtyFields.current.add('machineId'); setMachineId(e.target.value) }}
                disabled={hardwareIsLoading}
              >
                <option value="">{COPY.brewLogAdd.selectMachine}</option>
                {machines.map(m => (
                  <option key={m.hardware_id} value={m.hardware_id}>{m.name}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Grinder" htmlFor="brew-log-grinder">
              <Select
                id="brew-log-grinder"
                value={grinderId}
                onChange={e => { dirtyFields.current.add('grinderId'); setGrinderId(e.target.value) }}
                disabled={hardwareIsLoading}
              >
                <option value="">{COPY.brewLogAdd.selectGrinder}</option>
                {grinders.map(g => (
                  <option key={g.hardware_id} value={g.hardware_id}>{g.name}</option>
                ))}
              </Select>
            </FormField>
          </div>

          {/* Grind setting + Storage method — two-col on desktop, Issue 8 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Grind setting */}
            <FormField label="Grind setting" htmlFor="brew-log-grind-setting">
              <Input
                id="brew-log-grind-setting"
                type="text"
                value={grindSetting}
                onChange={(e) => { dirtyFields.current.add('grindSetting'); setGrindSetting(e.target.value) }}
              />
            </FormField>

            {/* Storage method */}
            <FormField label="Storage method" htmlFor="brew-log-storage-method">
              <Select
                id="brew-log-storage-method"
                value={storageMethod}
                onChange={e => { dirtyFields.current.add('storageMethod'); setStorageMethod(e.target.value) }}
                disabled={hardwareIsLoading}
              >
                <option value="">{COPY.brewLogAdd.selectStorage}</option>
                {storageItems.map(h => (
                  <option key={h.hardware_id} value={h.name}>{h.name}</option>
                ))}
              </Select>
            </FormField>
          </div>

          {/* Notes */}
          <FormField label="Notes" htmlFor="brew-log-notes">
            <Textarea
              id="brew-log-notes"
              rows={3}
              value={notes}
              onChange={(e) => { dirtyFields.current.add('notes'); setNotes(e.target.value) }}
            />
          </FormField>
        </div>

        {mutation.isError && (
          <p className="text-error text-sm">{COPY.brewLogAdd.saveError}</p>
        )}
        {similarShotIsError && (
          <p role="alert" className="text-error text-sm">Could not load the similar shot. You can still log a new shot.</p>
        )}

        <Button
          type="submit"
          variant="primary"
          fullWidth
          disabled={mutation.isPending || !bagId}
          loading={mutation.isPending}
          loadingText="Saving…"
        >
          {COPY.brewLogAdd.submit}
        </Button>
      </form>
      </div>
    </div>
  )
}
