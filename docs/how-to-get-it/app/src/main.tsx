import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import App from './App'
import './index.css'

// ============================================
// QUERY CLIENT CONFIGURATION
// ============================================
// This is the heart of instant-load ERP architecture
// - Aggressive caching with long staleTime
// - Garbage collection tuned for ERP data patterns
// - Retry logic for network resilience
// ============================================
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data stays fresh for 5 minutes - no refetching needed
      staleTime: 5 * 60 * 1000,
      // Keep data in cache for 30 minutes even when not used
      gcTime: 30 * 60 * 1000,
      // Retry failed requests 3 times with exponential backoff
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Refetch on window focus - keeps data fresh when user returns
      refetchOnWindowFocus: true,
      // Refetch on network reconnect
      refetchOnReconnect: true,
      // Don't refetch on mount if data is fresh
      refetchOnMount: false,
    },
    mutations: {
      // Retry mutations once on failure
      retry: 1,
    },
  },
})

// Expose queryClient globally for debugging
;(window as any).queryClient = queryClient

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </React.StrictMode>,
)
