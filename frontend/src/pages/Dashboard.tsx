import { useQuery } from '@tanstack/react-query'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { getDashboard } from '../api/dashboard'
import { listBrewLog } from '../api/brewLog'
import type { DashboardBag, BrewLogEntry } from '../types/entities'

export default function Dashboard() {
  const navigate = useNavigate()
  const { data: bags, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
  })

  const { data: recentShots = [] } = useQuery({
    queryKey: ['brew-log'],
    queryFn: listBrewLog,
    select: (shots: BrewLogEntry[]) => shots.slice(0, 5),
  })

  if (isLoading) return (
    <div className="p-4 space-y-3">
      {[1,2,3].map(i => (
        <div key={i} className="glass-card card-bevel p-4 animate-pulse">
          <div className="h-4 bg-amber-900/40 rounded w-3/4 mb-2" />
          <div className="h-3 bg-amber-900/30 rounded w-1/2" />
        </div>
      ))}
    </div>
  )

  if (isError) return (
    <div className="p-4">
      <div className="glass-card card-bevel p-6 text-center">
        <p className="text-amber-200 font-medium">Couldn't load dashboard</p>
        <p className="text-amber-400/70 text-sm mt-1">{(error as Error)?.message}</p>
        <button onClick={() => refetch()} className="btn btn-sm btn-outline border-amber-600 text-amber-200 mt-3 btn-bevel">
          Retry
        </button>
      </div>
    </div>
  )

  return (
    <div className="p-4 md:p-6 space-y-8">

      {/* ── Editorial hero ── */}
      <div className="pt-6 pb-2">
        <h1 className="font-display text-7xl sm:text-8xl lg:text-9xl font-bold text-white/80 leading-none tracking-tight drop-shadow-2xl select-none">
          Espresso<br />
          <span className="text-amber-200/70">Logs</span>
        </h1>
        <p className="text-white/40 text-xs mt-8 uppercase tracking-[0.2em] font-medium">
          Personal shot journal
        </p>
      </div>

      {/* ── Log Shot CTA ── */}
      <div className="flex justify-end">
        <button
          onClick={() => navigate('/brew-log/add')}
          className="btn btn-primary btn-sm no-underline btn-bevel"
        >
          + Log Shot
        </button>
      </div>

      {/* ── Divider ── */}
      <div className="border-t border-white/10" />

      {/* ── Active bags ── */}
      <section>
        <h2 className="text-lg font-display text-amber-200 mb-4">Active bags</h2>
        {!bags?.length ? (
          <div className="glass-card card-bevel p-6">
            <h2 className="text-lg font-semibold text-amber-300 mb-2">No active bags yet.</h2>
            <p className="text-sm text-amber-200/70 mb-4">Add a bean to the catalog to get started.</p>
            <Link
              to="/catalog"
              className="btn btn-primary btn-bevel no-underline"
            >
              Go to catalog →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {bags.map((bag) => (
              <div
                key={bag.bag_id}
                className="glass-card card-bevel p-4 cursor-pointer"
                onClick={() => navigate('/brew-log/add')}
              >
                <p className="font-semibold text-amber-100 text-sm leading-snug">{bag.display_name}</p>
                {bag.roast_level && (
                  <span className="badge badge-sm text-xs mt-2 bg-amber-900/25 text-amber-300 border border-amber-600/30">
                    {bag.roast_level}
                  </span>
                )}
                {bag.days_since_last_shot != null && (
                  <p className="text-xs text-amber-200/50 mt-2">
                    {bag.days_since_last_shot === 0 ? 'Last shot: today' : `Last shot: ${bag.days_since_last_shot}d ago`}
                  </p>
                )}
                {bag.last_shot?.dose_in_g && bag.last_shot?.yield_out_g && (
                  <p className="text-xs font-mono text-amber-300/70 mt-1">
                    {bag.last_shot.dose_in_g}g → {bag.last_shot.yield_out_g}g
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Recent shots ── */}
      <section>
        <h2 className="text-lg font-display text-amber-200 mb-4">Recent shots</h2>
        {!recentShots.length ? (
          <p className="text-amber-200/60 text-sm">No shots logged yet.</p>
        ) : (
          <div className="space-y-2">
            {recentShots.map((shot: BrewLogEntry) => (
              <Link
                key={shot.shot_id}
                to={`/brew-log/${shot.shot_id}`}
                className="glass-card card-bevel flex items-center justify-between px-4 py-3 hover:border-amber-500/40 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm text-amber-100 truncate">{shot.bag_display}</p>
                  <p className="text-xs text-amber-200/50">{shot.date}</p>
                </div>
                {shot.dose_in_g != null && shot.yield_out_g != null && (
                  <span className="text-xs text-amber-300 font-mono ml-3 shrink-0">
                    {shot.dose_in_g}g → {shot.yield_out_g}g
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Mobile FAB — portalled to document.body so backdrop-filter on #main-content
          does not create a new containing block and break position:fixed */}
      {createPortal(
        <button
          aria-label="Log a shot"
          className="btn btn-circle btn-lg btn-primary btn-bevel fixed bottom-20 right-4 z-50 lg:hidden"
          onClick={() => navigate('/brew-log/add')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>,
        document.body
      )}

    </div>
  )
}

