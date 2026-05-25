import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useOptimisticMutation } from './useOptimisticMutation';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  };
}

describe('useOptimisticMutation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('applies optimistic update on mutate', async () => {
    const { queryClient, wrapper } = createWrapper();
    const queryKey = ['test-items'];
    queryClient.setQueryData(queryKey, [{ id: '1', name: 'Item 1' }]);

    const mutationFn = vi.fn().mockResolvedValue({ id: '1', name: 'Updated' });

    const { result } = renderHook(
      () =>
        useOptimisticMutation({
          mutationFn,
          queryKey,
          optimisticUpdater: (old) => {
            if (Array.isArray(old)) {
              return old.map((item: { id: string; name: string }) =>
                item.id === '1' ? { ...item, name: 'Optimistic' } : item,
              );
            }
            return old;
          },
        }),
      { wrapper },
    );

    result.current.mutate({ id: '1', name: 'Updated' });

    await waitFor(() => {
      const data = queryClient.getQueryData(queryKey) as { id: string; name: string }[];
      // After mutation starts, optimistic update should be applied
      expect(data[0].name).toBe('Optimistic');
    });
  });

  it('rolls back on error', async () => {
    const { queryClient, wrapper } = createWrapper();
    const queryKey = ['test-items-rollback'];
    queryClient.setQueryData(queryKey, [{ id: '1', name: 'Original' }]);

    const mutationFn = vi.fn().mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(
      () =>
        useOptimisticMutation({
          mutationFn,
          queryKey,
          optimisticUpdater: (old) => {
            if (Array.isArray(old)) {
              return old.map((item: { id: string; name: string }) =>
                item.id === '1' ? { ...item, name: 'Optimistic' } : item,
              );
            }
            return old;
          },
        }),
      { wrapper },
    );

    result.current.mutate({ id: '1', name: 'Updated' });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // After error, data should be rolled back
    const data = queryClient.getQueryData(queryKey) as { id: string; name: string }[];
    expect(data[0].name).toBe('Original');
  });
});
