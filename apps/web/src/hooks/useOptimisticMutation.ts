import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import toast from 'react-hot-toast';

interface UseOptimisticMutationOptions<TData, TVariables> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  queryKey: QueryKey;
  optimisticUpdater: (currentData: unknown, variables: TVariables) => unknown;
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: Error, variables: TVariables) => void;
}

export function useOptimisticMutation<TData = unknown, TVariables = unknown>({
  mutationFn,
  queryKey,
  optimisticUpdater,
  onSuccess,
  onError,
}: UseOptimisticMutationOptions<TData, TVariables>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onMutate: async (variables: TVariables) => {
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: unknown) => optimisticUpdater(old, variables));
      return { previousData };
    },
    onError: (error: Error, variables: TVariables, context) => {
      if (context?.previousData !== undefined) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
      toast.error(error.message || 'Something went wrong');
      onError?.(error, variables);
    },
    onSuccess: (data: TData, variables: TVariables) => {
      queryClient.invalidateQueries({ queryKey });
      onSuccess?.(data, variables);
    },
  });
}
