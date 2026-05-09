import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { listHardware } from './api/hardware'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,        // 60 s — matches backend TTLCache
      gcTime: 5 * 60 * 1000,   // 5 min garbage collection
      retry: 1,
    },
  },
})

// Warm the hardware cache immediately — basket + storage dropdowns ready before BrewLogAdd mounts
queryClient.prefetchQuery({ queryKey: ['hardware'], queryFn: listHardware })

const persister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister }}
    >
      <RouterProvider router={router} />
    </PersistQueryClientProvider>
  </React.StrictMode>,
)

// Remove pre-mount loader now that React has mounted
document.getElementById('pre-mount-loader')?.remove()

// Register service worker for caching on subsequent loads
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`/sw.js?v=${__BUILD_HASH__}`, { scope: '/' })
      .catch((err) => console.warn('SW registration failed:', err))
  })
}
