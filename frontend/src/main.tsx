import React from 'react'
import ReactDOM from 'react-dom/client'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import App from './App'
import './index.css'
import { queryClient, queryPersister } from './queryClient'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: queryPersister }}
    >
      <App />
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
