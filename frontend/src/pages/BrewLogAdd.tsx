import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listInventory } from '../api/inventory'
import { listHardware } from '../api/hardware'
import { getDefaults } from '../api/defaults'
import { submitShot } from '../api/brewLog'
import LoadingSpinner from '../components/LoadingSpinner'
import CompassChart from '../components/CompassChart'
import { getBasketDefaults } from '../utils/basketDefaults'
import { deriveZoneBoundaries } from '../utils/zoneBoundaries'

export default function BrewLogAdd() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [bagId, setBagId] = useState('')
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
  const dirtyFields = useRef<Set<'dose' | 'yield' | 'grind' | 'basket'>>(new Set())

  // Progressive disclosure (BC-4, FR-009)
  const [advancedOpen, setAdvancedOpen] = useState<boolean>(false)

  // Double-submit guard — useRef so a re-render mid-flight doesn't re-enable the button
  const isSubmittingRef = useRef(false)

  // Idempotency key — lazy initialiser ensures exactly one UUID per component mount.
  // Rotated in onSuccess to protect any future in-place-reset path.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())

  const { data: inventory, isLoading: invLoading } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => listInventory('Active'),
  })

  const {
    data: hardware,
    isLoading: hardwareIsLoading,
    isSuccess: hardwareIsSuccess,
  } = useQuery({
    queryKey: ['hardware'],
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
    queryKey: ['defaults', bagId, basketId],
    queryFn: () => getDefaults(bagId, basketId || undefined),
    enabled: !!bagId,
  })

  // Reset all derived form state when the bag changes so the new bag's defaults
  // fill cleanly (threads 1 & 4 from Copilot review: dirty-field ref and
  // prev-guard pattern both block updates on bag switch).
  useEffect(() => {
    if (!bagId) return
    dirtyFields.current = new Set()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Controlled reset: bagId is the sole dep; none of these setters modify bagId, so no cascade.
    setDoseG('')
    setYieldG('')
    setGrindSetting('')
    setMachineId('')
    setGrinderId('')
    setBasketId('')
    setStorageMethod('')
  }, [bagId])

  // Apply bag-level defaults (Level 0/1) with dirty-field guards
  useEffect(() => {
    if (!defaults) return

    if (!dirtyFields.current.has('dose') && defaults.dose_in_g != null)
      setDoseG(String(defaults.dose_in_g))
    if (!dirtyFields.current.has('yield') && defaults.yield_out_g != null)
      setYieldG(String(defaults.yield_out_g))
    if (!dirtyFields.current.has('grind') && defaults.grind_setting)
      setGrindSetting(defaults.grind_setting)

    // Hardware/storage — always applied from bag defaults (no dirty-field guard).
    // These fields are set once when bag defaults load and are not typically
    // edited mid-flight. Basket is the exception: changing basket re-triggers
    // the defaults query, so a dirty-field guard is required below.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- One-way defaults hydration: storage/machine/grinder setters don't affect the query key; setBasketId is bounded by a dirty-field guard and a stable API response, so no cascade loop.
    if (defaults.storage_method) setStorageMethod(defaults.storage_method)
    if (defaults.machine_id) setMachineId(defaults.machine_id)
    if (defaults.grinder_id) setGrinderId(defaults.grinder_id)
    if (!dirtyFields.current.has('basket') && defaults.basket_id) setBasketId(defaults.basket_id)

    // Auto-expand advanced section (BC-4, FR-009) — also when machine/grinder defaults are set
    if (defaults.grind_setting || defaults.storage_method || defaults.machine_id || defaults.grinder_id)
      setAdvancedOpen(true)
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

    if (!dirtyFields.current.has('dose'))  setDoseG(String(profile.dose_in_g))
    if (!dirtyFields.current.has('yield')) setYieldG(String(profile.yield_out_g))
    if (!dirtyFields.current.has('grind')) {
      setGrindSetting(String(profile.grind_setting))
      // Do not auto-expand — the user controls the advanced section toggle
    }
  }, [basketId, hardware, defaults, defaultsIsSuccess]) // FE-1/FE-2: dirtyFields omitted (useRef, always current)

  const mutation = useMutation({
    mutationFn: submitShot,
    onSuccess: async () => {
      setIdempotencyKey(crypto.randomUUID())
      await queryClient.invalidateQueries({ queryKey: ['brew-log'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
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

  if (invLoading) return <LoadingSpinner />

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <h1 className="text-2xl font-display text-amber-100 mb-6">Add shot</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Bag — full width */}
        <div className="form-control">
          <label className="label">
            <span className="label-text text-amber-200">Bag</span>
          </label>
          <select
            className="select select-bordered bg-amber-950/60 border-amber-700/40 text-amber-100"
            value={bagId}
            onChange={(e) => setBagId(e.target.value)}
            required
          >
            <option value="">Select bag…</option>
            {inventory?.map((bag) => (
              <option key={bag.bag_id} value={bag.bag_id}>
                {bag.display_name}
              </option>
            ))}
          </select>
        </div>

        {/* Flat form fields: dose/yield/time, eligibility, basket (FR-004) */}
        <div className="space-y-4">
          {/* Dose / Yield / Time */}
          <div className="grid grid-cols-3 gap-3">
            <div className="form-control">
              <label className="label">
                <span className="label-text text-amber-200">Dose (g)</span>
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                className="input input-bordered bg-amber-950/60 border-amber-700/40 text-amber-100"
                value={doseG}
                onChange={(e) => { dirtyFields.current.add('dose'); setDoseG(e.target.value) }}
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text text-amber-200">Yield (g)</span>
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                className="input input-bordered bg-amber-950/60 border-amber-700/40 text-amber-100"
                value={yieldG}
                onChange={(e) => { dirtyFields.current.add('yield'); setYieldG(e.target.value) }}
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text text-amber-200">Time (s)</span>
              </label>
              <input
                type="number"
                min="0"
                className="input input-bordered bg-amber-950/60 border-amber-700/40 text-amber-100"
                value={timeSec}
                onChange={(e) => setTimeSec(e.target.value)}
              />
            </div>
          </div>

          {/* Shot eligibility */}
          <div className="form-control">
            <label className="label">
              <span className="label-text text-amber-200">Shot eligibility <span className="text-error">*</span></span>
            </label>
            <select
              value={eligibility}
              onChange={e => setEligibility(e.target.value)}
              required
              className="select select-bordered bg-amber-950/60 border-amber-700/40 text-amber-100"
            >
              <option value="">Select…</option>
              <option value="Reject">Reject</option>
              <option value="Passable">Passable</option>
              <option value="Good Espresso">Good Espresso</option>
              <option value="God Shot">God Shot</option>
            </select>
          </div>

          {/* Basket select — three loading states (FE-3) */}
          <div className="form-control">
            <label className="label">
              <span className="label-text text-amber-200">Basket</span>
            </label>
            {hardwareIsLoading && (
              <select disabled className="select select-bordered bg-amber-950/60 border-amber-700/40 text-amber-100/50">
                <option>Loading baskets…</option>
              </select>
            )}
            {hardwareIsSuccess && baskets.length === 0 && (
              <select disabled className="select select-bordered bg-amber-950/60 border-amber-700/40 text-amber-100/50">
                <option>No baskets found</option>
              </select>
            )}
            {hardwareIsSuccess && baskets.length > 0 && (
              <select
                value={basketId}
                onChange={e => { dirtyFields.current.add('basket'); setBasketId(e.target.value) }}
                className="select select-bordered bg-amber-950/60 border-amber-700/40 text-amber-100"
              >
                <option value="">Select basket…</option>
                {baskets.map(b => (
                  <option key={b.hardware_id} value={b.hardware_id}>{b.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Full-width Extraction compass (FR-001/FR-003) */}
        <div className="mt-4 max-w-[560px] mx-auto w-full">
          <div className="form-control">
            <label className="label">
              <span className="label-text text-amber-200">Extraction compass</span>
            </label>
            <div className="glass-card p-3 w-full">
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

        {/* Advanced toggle */}
        <button
          type="button"
          aria-expanded={advancedOpen}
          aria-controls="advanced-fields"
          onClick={() => setAdvancedOpen(v => !v)}
          className="btn btn-ghost text-amber-200/70 w-full justify-between text-sm"
        >
          {advancedOpen ? 'Fewer options' : 'More options'}
          <svg
            className={`w-4 h-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Advanced section — machine, grinder, grind setting, storage, notes */}
        <div id="advanced-fields" hidden={!advancedOpen} className="space-y-4">
          {/* Machine + Grinder — two-column row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="form-control">
              <label className="label">
                <span className="label-text text-amber-200">Machine</span>
              </label>
              <select
                value={machineId}
                onChange={e => setMachineId(e.target.value)}
                disabled={hardwareIsLoading}
                className="select select-bordered bg-amber-950/60 border-amber-700/40 text-amber-100"
              >
                <option value="">Select machine…</option>
                {machines.map(m => (
                  <option key={m.hardware_id} value={m.hardware_id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text text-amber-200">Grinder</span>
              </label>
              <select
                value={grinderId}
                onChange={e => setGrinderId(e.target.value)}
                disabled={hardwareIsLoading}
                className="select select-bordered bg-amber-950/60 border-amber-700/40 text-amber-100"
              >
                <option value="">Select grinder…</option>
                {grinders.map(g => (
                  <option key={g.hardware_id} value={g.hardware_id}>{g.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Grind setting */}
          <div className="form-control">
            <label className="label">
              <span className="label-text text-amber-200">Grind setting</span>
            </label>
            <input
              type="text"
              className="input input-bordered bg-amber-950/60 border-amber-700/40 text-amber-100"
              value={grindSetting}
              onChange={(e) => { dirtyFields.current.add('grind'); setGrindSetting(e.target.value) }}
            />
          </div>

          {/* Storage method — select populated from hardware API */}
          <div className="form-control">
            <label className="label">
              <span className="label-text text-amber-200">Storage method</span>
            </label>
            <select
              value={storageMethod}
              onChange={e => setStorageMethod(e.target.value)}
              disabled={hardwareIsLoading}
              className="select select-bordered bg-amber-950/60 border-amber-700/40 text-amber-100"
            >
              <option value="">Select storage…</option>
              {storageItems.map(h => (
                <option key={h.hardware_id} value={h.name}>{h.name}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div className="form-control">
            <label className="label">
              <span className="label-text text-amber-200">Notes</span>
            </label>
            <textarea
              rows={3}
              className="textarea textarea-bordered bg-amber-950/60 border-amber-700/40 text-amber-100"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {mutation.isError && (
          <p className="text-error text-sm">Failed to save shot. Please try again.</p>
        )}

        <button
          type="submit"
          disabled={mutation.isPending || !bagId}
          className="btn bg-amber-600 hover:bg-amber-500 border-none text-white w-full"
        >
          {mutation.isPending ? 'Saving…' : 'Log shot'}
        </button>
      </form>
    </div>
  )
}

