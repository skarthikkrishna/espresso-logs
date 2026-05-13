import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listCatalog } from '../api/catalog'
import LoadingSpinner from '../components/LoadingSpinner'
import AddBeanModal from '../components/AddBeanModal'

export default function CatalogList() {
  const [search, setSearch] = useState('')
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['catalog'],
    queryFn: listCatalog,
  })

  if (isLoading) return <LoadingSpinner />
  if (isError) return (
    <div className="p-4">
      <div className="glass-card card-bevel p-6 text-center">
        <p className="text-amber-200 font-medium">Couldn't load catalog</p>
        <button onClick={() => refetch()} className="btn btn-sm btn-outline border-amber-600 text-amber-200 mt-3 btn-bevel">Retry</button>
      </div>
    </div>
  )

  const filtered = (data ?? []).filter(
    (item) =>
      item.roaster.toLowerCase().includes(search.toLowerCase()) ||
      item.bean_name.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="p-4 md:p-6">
      <h1 className="font-display text-3xl md:text-4xl font-bold text-white/80 mb-4">Catalog</h1>

      {data?.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <p className="text-2xl mb-2">☕</p>
          <p className="text-amber-200 font-medium">No beans in catalog yet</p>
          <p className="text-amber-400/70 text-sm mt-1">Tap + to add your first coffee</p>
        </div>
      ) : (
        <>
          <input
            type="text"
            placeholder="Search roaster or bean…"
            className="input input-bordered w-full max-w-sm mb-6 bg-amber-950/60 border-amber-700/40 text-amber-100 placeholder-amber-200/40"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {!filtered.length ? (
            <p className="text-amber-200/60 text-sm">No results found.</p>
          ) : (
            <div data-testid="catalog-grid" className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {filtered.map((item) => (
                <Link
                  key={item.catalog_id}
                  to={`/catalog/${item.catalog_id}`}
                  className="liquid-card"
                >
                  {/* Figure area */}
                  <div className="liquid-card-figure">
                    {item.image_path ? (
                      <>
                        <img
                          src={item.image_path}
                          alt={item.bean_name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const img = e.currentTarget
                            img.style.display = 'none'
                            const mono = img.nextElementSibling as HTMLElement | null
                            if (mono?.dataset.monogram) mono.style.display = 'flex'
                          }}
                        />
                        <span
                          data-monogram="true"
                          aria-hidden="true"
                          className="liquid-card-monogram"
                          style={{ display: 'none', alignItems: 'center', justifyContent: 'center' }}
                        >
                          {((item.roaster || item.bean_name || '?').slice(0, 2)).toUpperCase()}
                        </span>
                      </>
                    ) : (
                      <span
                        data-monogram="true"
                        aria-hidden="true"
                        className="liquid-card-monogram"
                      >
                        {((item.roaster || item.bean_name || '?').slice(0, 2)).toUpperCase()}
                      </span>
                    )}
                  </div>
                  {/* Card body */}
                  <div className="liquid-card-body">
                    <h3 className="font-display text-base font-bold leading-snug text-amber-100 truncate">
                      {item.roaster}
                    </h3>
                    <p className="text-sm text-amber-200/60 leading-snug truncate">
                      {item.bean_name}
                    </p>
                    {item.roast_level && (
                      <div className="flex items-center mt-3">
                        <span className="badge badge-sm bg-amber-900/25 text-amber-300 border border-amber-600/30">
                          {item.roast_level}
                        </span>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      {/* Add bean FAB — portalled to document.body so backdrop-filter on #main-content does not create a new containing block and break position:fixed */}
      {createPortal(
        <button
          onClick={() => setModalOpen(true)}
          className="btn btn-circle btn-lg btn-primary btn-bevel fixed bottom-20 right-4 md:bottom-6 z-50"
          aria-label="Add bean"
        >
          +
        </button>,
        document.body
      )}

      {modalOpen && (
        <AddBeanModal
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            setModalOpen(false)
            queryClient.invalidateQueries({ queryKey: ['catalog'] })
          }}
        />
      )}
    </div>
  )
}

