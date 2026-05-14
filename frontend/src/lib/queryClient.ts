import { QueryClient, MutationCache, QueryCache } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ApiError } from './api';

/**
 * Global QueryClient with error handling and optimistic update support.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30 seconds
      retry: (failureCount, error) => {
        // Don't retry on auth errors
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          return false;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
  queryCache: new QueryCache({
    onError: (error) => {
      if (error instanceof ApiError && error.status !== 401) {
        toast.error(error.message || 'An error occurred');
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      if (error instanceof ApiError) {
        toast.error(error.message || 'Operation failed');
      } else if (error instanceof Error) {
        toast.error(error.message || 'An unexpected error occurred');
      }
    },
  }),
});
