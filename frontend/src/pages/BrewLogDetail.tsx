import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getBrewLogDetail, getBrewLogFeedback } from '../api/brewLog'
import LoadingSpinner from '../components/LoadingSpinner'
import type { BrewLogEntry } from '../types/entities'

function eligibilityBadgeClasses(eligibility: string): string {
  switch (eligibility) {
    case 'God Shot':       return 'bg-amber-400/20 text-amber-300 border-amber-400/50'
    case 'Good Espresso':  return 'bg-green-800/30 text-green-300 border-green-600/40'
    case 'Passable':       return 'bg-zinc-700/40 text-zinc-300 border-zinc-500/40'
    case 'Reject':         return 'bg-red-900/30 text-red-300 border-red-600/40'
    default:               return 'bg-zinc-700/40 text-zinc-300 border-zinc-500/40'
  }
}

export default function BrewLogDetail() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const rawBack = searchParams.get('back')
  // Security guard: accept only root-relative paths; reject protocol-relative (//evil.com)
  const backTarget = rawBack?.startsWith('/') && !rawBack?.startsWith('//') ? rawBack : '/brew-log'
  const [feedbackEnabled, setFeedbackEnabled] = useState(false)
  const queryClient = useQueryClient()

  const { data: shot, isLoading, error } = useQuery({
    queryKey: ['brew-log', id],
    queryFn: () => getBrewLogDetail(id!),
    enabled: !!id,
    initialData: () => {
      const list = queryClient.getQueryData<BrewLogEntry[]>(['brew-log'])
      return list?.find((s) => s.shot_id === id)
    },
    initialDataUpdatedAt: () =>
      queryClient.getQueryState(['brew-log'])?.dataUpdatedAt,
  })

  const { data: feedbackData, isLoading: feedbackLoading } = useQuery({
    queryKey: ['brew-log', id, 'feedback'],
    queryFn: () => getBrewLogFeedback(id!),
    enabled: !!id && feedbackEnabled,
  })

  if (isLoading) return <LoadingSpinner />
  if (error) return <div className="p-6 text-error">Failed to load shot.</div>
  if (!shot) return null

  return (
    <div data-testid="brew-log-detail" className="p-4 md:p-6 space-y-6 max-w-2xl">
      {/* AC-15: ← Back text confirmed */}
      <Link to={backTarget} className="text-sm text-amber-400 hover:text-amber-300 inline-block">
        ← Back
      </Link>

      <div>
        <h1 className="text-xl font-display text-amber-100">{shot.bag_display}</h1>
        <p className="text-amber-200/60 text-sm">{shot.date}</p>
        {shot.roast_level && (
          <span className="badge badge-sm bg-amber-900/25 text-amber-300 border border-amber-600/30">
            {shot.roast_level}
          </span>
        )}
        {shot.shot_eligibility && (
          <span
            data-testid="eligibility-badge"
            className={`badge badge-sm border ${eligibilityBadgeClasses(shot.shot_eligibility)}`}
          >
            {shot.shot_eligibility}
          </span>
        )}
      </div>

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
        {shot.ai_feedback ? (
          <p className="text-sm text-amber-100">{shot.ai_feedback}</p>
        ) : feedbackEnabled ? (
          feedbackLoading ? (
            <LoadingSpinner message="Getting feedback…" />
          ) : feedbackData?.ai_feedback ? (
            <p className="text-sm text-amber-100">{feedbackData.ai_feedback}</p>
          ) : (
            <p className="text-amber-200/50 text-sm">No feedback available.</p>
          )
        ) : (
          <button
            onClick={() => setFeedbackEnabled(true)}
            className="btn btn-sm border-amber-600/40 text-amber-400 bg-transparent hover:bg-amber-800/40"
          >
            Get AI feedback
          </button>
        )}
      </section>
    </div>
  )
}

