import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listBrewLog, getBrewLogDetail } from '../api/brewLog'
import LoadingSpinner from '../components/LoadingSpinner'

export default function BrewLogList() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const toastParam = searchParams.get('toast')
  const [toast, setToast] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['brew-log'],
    queryFn: listBrewLog,
  })

  useEffect(() => {
    if (toastParam === 'shot-saved') {
      setToast('Shot saved!')
      setSearchParams({}, { replace: true })
    }
  }, [toastParam, setSearchParams])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  if (isLoading) return <LoadingSpinner />
  if (error) return <div className="p-6 text-error">Failed to load brew log.</div>

  return (
    <div className="p-4 md:p-6 relative">
      <h1 className="font-display text-3xl md:text-4xl font-bold text-white/80 mb-4">Brew log</h1>
      {toast && createPortal(
        <div
          className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-amber-700 text-white text-sm px-4 py-2 rounded-full shadow-lg z-50"
          onClick={() => setToast(null)}
        >
          {toast}
        </div>,
        document.body
      )}
      {!data?.length ? (
        <p className="text-amber-200/60 text-sm">No shots logged yet.</p>
      ) : (
        <div data-testid="brew-log-list" className="space-y-2">
          {data.map((entry) => (
            <Link
              data-testid="brew-log-entry"
              key={entry.shot_id}
              to={`/brew-log/${entry.shot_id}`}
              onMouseEnter={() => {
                queryClient.prefetchQuery({
                  queryKey: ['brew-log', entry.shot_id],
                  queryFn: () => getBrewLogDetail(entry.shot_id),
                  staleTime: 60_000,
                })
              }}
              className="frosted-brew-card hover:border-amber-500/40 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm md:text-base text-amber-100 truncate">{entry.bag_display}</p>
                <p className="text-xs md:text-sm text-amber-200/50">{entry.date}</p>
              </div>
              {entry.dose_in_g != null && entry.yield_out_g != null && (
                <span className="text-xs md:text-sm text-amber-300 font-mono ml-3 shrink-0">
                  {entry.dose_in_g}g → {entry.yield_out_g}g
                </span>
              )}
            </Link>
          ))}
        </div>
      )}

      {/* Add shot FAB — portalled to document.body so backdrop-filter on #main-content
          does not create a new containing block and break position:fixed */}
      {createPortal(
        <button
          onClick={() => navigate('/brew-log/add')}
          className="btn btn-circle btn-lg fixed bottom-20 right-4 md:bottom-6 bg-amber-600 hover:bg-amber-500 border-none text-white shadow-xl z-50"
          aria-label="Add shot"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>,
        document.body
      )}
    </div>
  )
}

