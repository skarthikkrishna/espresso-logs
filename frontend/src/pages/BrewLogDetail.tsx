import { useRef, useState } from 'react'
import axios from 'axios'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import {
  brewLogDetailQueryKey,
  brewLogFeedbackQueryKey,
  generateBrewLogFeedback,
  getBrewLogDetail,
  getBrewLogFeedback,
  updateBrewLogEntry,
} from '../api/brewLog'
import type { BrewLogCorrectionPayload } from '../api/brewLog'
import { brewLogListQueryKey, dashboardQueryKey } from '../api/queryKeys'
import type { BrewLogPage } from '../api/brewLog'
import LoadingSpinner from '../components/LoadingSpinner'
import Chip from '../components/Chip'
import type { BrewLogEntry } from '../types/entities'
import { useHouseholdQueryScope } from '../contexts/AuthContext'

function eligibilityBadgeClasses(eligibility: string): string {
  switch (eligibility) {
    case 'God Shot':       return 'bg-amber-400/20 text-amber-300 border-amber-400/50'
    case 'Good Espresso':  return 'bg-green-800/30 text-green-300 border-green-600/40'
    case 'Passable':       return 'bg-zinc-700/40 text-zinc-300 border-zinc-500/40'
    case 'Reject':         return 'bg-red-900/30 text-red-300 border-red-600/40'
    default:               return 'bg-zinc-700/40 text-zinc-300 border-zinc-500/40'
  }
}

type CachedBrewLogShot = {
  shot: BrewLogEntry
  dataUpdatedAt: number | undefined
}

type CorrectionForm = {
  taste_summary: string
  user_notes: string
  grind_setting: string
  shot_eligibility: string
}

const ELIGIBILITY_OPTIONS = ['Reject', 'Passable', 'Good Espresso', 'God Shot'] as const

function isBrewLogEntry(value: unknown): value is BrewLogEntry {
  if (!value || typeof value !== 'object') return false
  return typeof (value as { shot_id?: unknown }).shot_id === 'string'
}

function isBrewLogPage(value: unknown): value is BrewLogPage {
  if (!value || typeof value !== 'object') return false
  const items = (value as { items?: unknown }).items
  return Array.isArray(items) && items.every(isBrewLogEntry)
}

function findCachedBrewLogShot(queryClient: QueryClient, shotId: string, householdId?: string | null): CachedBrewLogShot | undefined {
  if (!shotId) return undefined

  for (const [queryKey, page] of queryClient.getQueriesData<unknown>({ queryKey: ['households', householdId ?? 'no-household', 'brew-log'] })) {
    if (!isBrewLogPage(page)) continue

    const shot = page.items.find((entry) => entry.shot_id === shotId)
    if (shot) {
      return {
        shot,
        dataUpdatedAt: queryClient.getQueryState(queryKey)?.dataUpdatedAt,
      }
    }
  }

  return undefined
}

function apiErrorMessage(err: unknown, fallback: string): string {
  if (!axios.isAxiosError(err)) return fallback
  const detail = err.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail.length > 0) return 'Validation failed. Please check the highlighted fields.'
  return fallback
}

export default function BrewLogDetail() {
  const { id } = useParams<{ id: string }>()
  const shotId = id ?? ''
  const [searchParams] = useSearchParams()
  const rawBack = searchParams.get('back')
  // Security guard: accept only root-relative paths; reject protocol-relative (//evil.com)
  const backTarget = rawBack?.startsWith('/') && !rawBack?.startsWith('//') ? rawBack : '/brew-log'
  const [correctionOpen, setCorrectionOpen] = useState(false)
  const [correctionForm, setCorrectionForm] = useState<CorrectionForm>({
    taste_summary: '',
    user_notes: '',
    grind_setting: '',
    shot_eligibility: '',
  })
  const [correctionFieldError, setCorrectionFieldError] = useState<string | null>(null)
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)
  const feedbackInFlightRef = useRef(false)
  const queryClient = useQueryClient()
  const activeHouseholdId = useHouseholdQueryScope()
  const cachedShot = findCachedBrewLogShot(queryClient, shotId, activeHouseholdId)

  const { data: shot, isLoading, error } = useQuery({
    queryKey: brewLogDetailQueryKey(shotId, activeHouseholdId),
    queryFn: () => getBrewLogDetail(shotId),
    enabled: !!id,
    initialData: () => cachedShot?.shot,
    initialDataUpdatedAt: () => cachedShot?.dataUpdatedAt,
  })

  const { data: feedbackData } = useQuery({
    queryKey: brewLogFeedbackQueryKey(shotId, activeHouseholdId),
    queryFn: () => getBrewLogFeedback(shotId),
    enabled: !!id,
  })

  const correctionMutation = useMutation({
    mutationFn: (payload: BrewLogCorrectionPayload) => updateBrewLogEntry(shotId, payload),
    onSuccess: (updatedShot) => {
      const previous = queryClient.getQueryData<BrewLogEntry>(brewLogDetailQueryKey(shotId, activeHouseholdId))
      const mergedShot = {
        ...updatedShot,
        ai_feedback: updatedShot.ai_feedback ?? previous?.ai_feedback ?? shot?.ai_feedback,
      }
      queryClient.setQueryData<BrewLogEntry>(brewLogDetailQueryKey(shotId, activeHouseholdId), mergedShot)
      queryClient.invalidateQueries({ queryKey: brewLogListQueryKey(activeHouseholdId) })
      queryClient.invalidateQueries({ queryKey: dashboardQueryKey(activeHouseholdId) })
      queryClient.invalidateQueries({ queryKey: brewLogDetailQueryKey(shotId, activeHouseholdId), refetchType: 'inactive' })
      setCorrectionOpen(false)
      setCorrectionFieldError(null)
    },
    onError: (err) => {
      setCorrectionFieldError(apiErrorMessage(err, 'Failed to save corrections. Please try again.'))
    },
  })

  const feedbackMutation = useMutation({
    mutationFn: () => generateBrewLogFeedback(shotId),
    onMutate: () => {
      setFeedbackMessage(null)
    },
    onSuccess: (data) => {
      queryClient.setQueryData(brewLogFeedbackQueryKey(shotId, activeHouseholdId), data)
      queryClient.setQueryData<BrewLogEntry>(
        brewLogDetailQueryKey(shotId, activeHouseholdId),
        (old) => old ? { ...old, ai_feedback: data.ai_feedback ?? old.ai_feedback } : old,
      )
      queryClient.invalidateQueries({ queryKey: brewLogDetailQueryKey(shotId, activeHouseholdId), refetchType: 'inactive' })
      queryClient.invalidateQueries({ queryKey: brewLogListQueryKey(activeHouseholdId) })
      queryClient.invalidateQueries({ queryKey: dashboardQueryKey(activeHouseholdId) })
      setFeedbackMessage('AI feedback updated.')
    },
    onSettled: () => {
      feedbackInFlightRef.current = false
    },
  })

  if (isLoading) return <LoadingSpinner />
  if (error) return <div className="p-6 text-error">Failed to load shot.</div>
  if (!shot) return null

  const openCorrectionForm = () => {
    setCorrectionForm({
      taste_summary: shot.taste_summary ?? '',
      user_notes: shot.user_notes ?? '',
      grind_setting: shot.grind_setting ?? '',
      shot_eligibility: shot.shot_eligibility ?? '',
    })
    setCorrectionFieldError(null)
    setCorrectionOpen(true)
  }

  const correctionPayload: BrewLogCorrectionPayload = {}
  if (correctionForm.taste_summary !== (shot.taste_summary ?? '')) correctionPayload.taste_summary = correctionForm.taste_summary
  if (correctionForm.user_notes !== (shot.user_notes ?? '')) correctionPayload.user_notes = correctionForm.user_notes
  if (correctionForm.grind_setting !== (shot.grind_setting ?? '')) correctionPayload.grind_setting = correctionForm.grind_setting
  if (correctionForm.shot_eligibility !== (shot.shot_eligibility ?? '')) {
    correctionPayload.shot_eligibility = correctionForm.shot_eligibility
  }
  const hasCorrectionChanges = Object.keys(correctionPayload).length > 0
  const correctionEligibilityValid = !correctionForm.shot_eligibility
    || ELIGIBILITY_OPTIONS.includes(correctionForm.shot_eligibility as (typeof ELIGIBILITY_OPTIONS)[number])
  const visibleFeedback = feedbackData?.ai_feedback || shot.ai_feedback || ''
  const feedbackError = feedbackMutation.isError
    ? apiErrorMessage(feedbackMutation.error, 'Failed to generate AI feedback. Please try again.')
    : null

  const submitCorrections = () => {
    if (!hasCorrectionChanges || correctionMutation.isPending) return
    if (!correctionEligibilityValid) {
      setCorrectionFieldError('Shot eligibility must be one of the listed values.')
      return
    }
    setCorrectionFieldError(null)
    correctionMutation.mutate(correctionPayload)
  }

  return (
    <div data-testid="brew-log-detail" className="p-4 md:p-6 space-y-6 max-w-2xl">
      {/* AC-15: ← Back text confirmed */}
      <Link to={backTarget} className="text-sm text-amber-400 hover:text-amber-300 inline-block">
        ← Back
      </Link>

      <div>
        <h1 className="text-xl font-display text-amber-100">{shot.bag_display}</h1>
        <p className="text-amber-200/60 text-sm">{shot.date}</p>
        <Chip label={shot.roast_level} />
        {shot.shot_eligibility && (
          <span
            data-testid="eligibility-badge"
            className={`badge badge-sm border ${eligibilityBadgeClasses(shot.shot_eligibility)}`}
          >
            {shot.shot_eligibility}
          </span>
        )}
        {!correctionOpen && (
          <button
            type="button"
            onClick={openCorrectionForm}
            className="btn btn-xs btn-outline border-amber-600/40 text-amber-300 hover:bg-amber-800/40 mt-3 block btn-bevel"
          >
            Correct shot details
          </button>
        )}
      </div>

      {correctionOpen && (
        <section className="glass-card p-4">
          <h2 className="text-sm font-semibold text-amber-300 mb-1">Correct typo-safe fields</h2>
          <p className="text-xs text-amber-200/60 mb-3">
            Only notes, taste, grind setting, and shot eligibility can be corrected here.
          </p>
          <div className="space-y-3">
            <div>
              <label className="label text-xs text-amber-200/70 pb-1" htmlFor="correction-taste-summary">Taste summary</label>
              <input
                id="correction-taste-summary"
                type="text"
                value={correctionForm.taste_summary}
                onChange={(e) => setCorrectionForm((prev) => ({ ...prev, taste_summary: e.target.value }))}
                className="input input-bordered input-sm w-full bg-stone-800 border-amber-900/40 text-amber-100"
              />
            </div>
            <div>
              <label className="label text-xs text-amber-200/70 pb-1" htmlFor="correction-grind-setting">Grind setting</label>
              <input
                id="correction-grind-setting"
                type="text"
                value={correctionForm.grind_setting}
                onChange={(e) => setCorrectionForm((prev) => ({ ...prev, grind_setting: e.target.value }))}
                className="input input-bordered input-sm w-full bg-stone-800 border-amber-900/40 text-amber-100"
              />
            </div>
            <div>
              <label className="label text-xs text-amber-200/70 pb-1" htmlFor="correction-shot-eligibility">Shot eligibility</label>
              <select
                id="correction-shot-eligibility"
                value={correctionForm.shot_eligibility}
                onChange={(e) => {
                  setCorrectionForm((prev) => ({ ...prev, shot_eligibility: e.target.value }))
                  setCorrectionFieldError(null)
                }}
                aria-invalid={!correctionEligibilityValid}
                className="select select-bordered select-sm w-full bg-stone-800 border-amber-900/40 text-amber-100"
              >
                <option value="">No eligibility</option>
                {ELIGIBILITY_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              {!correctionEligibilityValid && (
                <p className="text-xs text-error mt-1">Choose a listed eligibility value.</p>
              )}
            </div>
            <div>
              <label className="label text-xs text-amber-200/70 pb-1" htmlFor="correction-user-notes">Notes</label>
              <textarea
                id="correction-user-notes"
                rows={3}
                value={correctionForm.user_notes}
                onChange={(e) => setCorrectionForm((prev) => ({ ...prev, user_notes: e.target.value }))}
                className="textarea textarea-bordered textarea-sm w-full bg-stone-800 border-amber-900/40 text-amber-100"
              />
            </div>
          </div>
          {correctionFieldError && (
            <p role="alert" className="text-xs text-red-400 mt-3">{correctionFieldError}</p>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={() => {
                setCorrectionOpen(false)
                setCorrectionFieldError(null)
              }}
              disabled={correctionMutation.isPending}
              className="btn btn-xs btn-ghost text-amber-300/70"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitCorrections}
              disabled={!hasCorrectionChanges || !correctionEligibilityValid || correctionMutation.isPending}
              className="btn btn-xs bg-amber-600 hover:bg-amber-500 border-none text-white btn-bevel"
            >
              {correctionMutation.isPending ? 'Saving…' : 'Save corrections'}
            </button>
          </div>
        </section>
      )}

      {/* Shot parameters */}
      <section className="glass-card p-4">
        <h2 className="text-sm font-semibold text-amber-300 mb-3">Shot parameters</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {shot.dose_in_g != null && (
            <>
              <dt className="text-amber-200/60">Dose</dt>
              <dd className="text-amber-100 font-mono">{shot.dose_in_g}g</dd>
            </>
          )}
          {shot.yield_out_g != null && (
            <>
              <dt className="text-amber-200/60">Yield</dt>
              <dd className="text-amber-100 font-mono">{shot.yield_out_g}g</dd>
            </>
          )}
          {shot.time_sec != null && (
            <>
              <dt className="text-amber-200/60">Time</dt>
              <dd className="text-amber-100 font-mono">{shot.time_sec}s</dd>
            </>
          )}
          {shot.grind_setting && (
            <>
              <dt className="text-amber-200/60">Grind setting</dt>
              <dd className="text-amber-100">{shot.grind_setting}</dd>
            </>
          )}
          {shot.taste_summary && (
            <>
              <dt data-testid="taste-summary-row" className="text-amber-200/60">Taste</dt>
              <dd className="text-amber-100">{shot.taste_summary}</dd>
            </>
          )}
          {shot.storage_method && (
            <>
              <dt className="text-amber-200/60">Storage</dt>
              <dd className="text-amber-100">{shot.storage_method}</dd>
            </>
          )}
        </dl>
      </section>

      {/* Hardware */}
      {(shot.machine_name || shot.grinder_name || shot.basket_name) && (
        <section className="glass-card p-4">
          <h2 className="text-sm font-semibold text-amber-300 mb-3">Hardware</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {shot.machine_name && (
              <>
                <dt className="text-amber-200/60">Machine</dt>
                <dd className="text-amber-100">{shot.machine_name}</dd>
              </>
            )}
            {shot.grinder_name && (
              <>
                <dt className="text-amber-200/60">Grinder</dt>
                <dd className="text-amber-100">{shot.grinder_name}</dd>
              </>
            )}
            {shot.basket_name && (
              <>
                <dt className="text-amber-200/60">Basket</dt>
                <dd className="text-amber-100">{shot.basket_name}</dd>
              </>
            )}
          </dl>
        </section>
      )}

      {/* Notes */}
      {shot.user_notes && (
        <section data-testid="notes-section" className="glass-card p-4">
          <h2 className="text-sm font-semibold text-amber-300 mb-2">Notes</h2>
          <p className="text-sm text-amber-100">{shot.user_notes}</p>
        </section>
      )}

      {/* AI feedback */}
      <section className="glass-card p-4">
        <h2 className="text-sm font-semibold text-amber-300 mb-3">AI feedback</h2>
        {visibleFeedback ? (
          <p className="text-sm text-amber-100">{visibleFeedback}</p>
        ) : (
          <p className="text-amber-200/50 text-sm mb-3">No feedback available yet.</p>
        )}
        {feedbackError && (
          <p role="alert" className="text-xs text-red-400 mt-3">{feedbackError}</p>
        )}
        {feedbackMessage && !feedbackError && (
          <p role="status" className="text-xs text-amber-300 mt-3">{feedbackMessage}</p>
        )}
        <div className="mt-3">
          <button
            type="button"
            onClick={() => {
              if (feedbackInFlightRef.current || feedbackMutation.isPending) return
              feedbackInFlightRef.current = true
              feedbackMutation.mutate()
            }}
            disabled={feedbackMutation.isPending}
            className="btn btn-sm border-amber-600/40 text-amber-400 bg-transparent hover:bg-amber-800/40"
          >
            {feedbackMutation.isPending
              ? 'Generating…'
              : visibleFeedback
                ? 'Regenerate AI feedback'
                : 'Get AI feedback'}
          </button>
        </div>
      </section>
    </div>
  )
}
