import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 60 * 24, // 24 hours - data stays fresh for a long time
      cacheTime: 1000 * 60 * 60 * 24, // Keep in cache for 24 hours
      refetchOnWindowFocus: false, // Don't refetch on window focus
      refetchOnMount: false, // Don't refetch on mount if data exists
      refetchOnReconnect: false, // Don't refetch on reconnect
      refetchInterval: false, // Disable automatic polling
      retry: 0,
      structuralSharing: true,
    },
  },
})


