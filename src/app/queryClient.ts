import { QueryClient } from '@tanstack/react-query';
import { ApiError, SessionExpiredError } from '../api/errors';

/** 4xx and an expired session are final — retrying them only delays the UI. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof SessionExpiredError) return false;
  if (error instanceof ApiError && error.status < 500) return false;
  return failureCount < 2;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetry,
      staleTime: 10_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});
