'use client';

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

/**
 * Enhanced QueryClient Configuration
 *
 * Domain-specific staleTime configuration:
 * - Master Data (items, companies, bom): 5 minutes
 * - Transactional Data (transactions, inventory): 2 minutes
 * - Real-time Data (dashboard): 30 seconds with auto-refresh
 * - Financial Data (accounting): 5 minutes
 *
 * Cache Strategy:
 * - gcTime (garbage collection): 10 minutes (2x staleTime)
 * - Refetch on window focus: enabled for data consistency
 * - Retry with exponential backoff: 2 attempts max
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Default staleTime: 5 minutes (master data)
      // Individual hooks can override with domain-specific values
      staleTime: 5 * 60 * 1000,

      // Cache garbage collection: 10 minutes
      gcTime: 10 * 60 * 1000,

      // Refetch on window focus for data consistency
      refetchOnWindowFocus: true,

      // Don't refetch on reconnect to avoid unnecessary requests
      refetchOnReconnect: false,

      // Retry failed requests 2 times with exponential backoff
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

      // Network mode: online only (no offline cache)
      networkMode: 'online',

      // Error handling
      throwOnError: false,

      // Refetch on mount: only if stale
      refetchOnMount: true,
    },
    mutations: {
      // Retry mutations once (avoid duplicate submissions)
      retry: 1,

      // Network mode: online only
      networkMode: 'online',

      // Throw on error for mutations (handle in UI)
      throwOnError: false,
    },
  },
});

interface QueryProviderProps {
  children: React.ReactNode;
}

export default function QueryProvider({ children }: QueryProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Show devtools only in development */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools
          initialIsOpen={false}
        />
      )}
    </QueryClientProvider>
  );
}

// Export queryClient for use in prefetching or manual invalidation
export { queryClient };