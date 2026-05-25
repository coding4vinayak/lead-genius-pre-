import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { showUndoToast } from '../components/ui/UndoToast';

interface UseUndoDeleteOptions<T> {
  queryKey: QueryKey;
  deleteFn: (id: string) => Promise<T>;
  entityLabel?: string;
}

export function useUndoDelete<T = unknown>({ queryKey, deleteFn, entityLabel = 'Item' }: UseUndoDeleteOptions<T>) {
  const queryClient = useQueryClient();

  const deleteWithUndo = (id: string) => {
    const previousData = queryClient.getQueryData(queryKey);

    // Optimistically remove item from cache
    queryClient.setQueryData(queryKey, (old: unknown) => {
      if (Array.isArray(old)) {
        return old.filter((item: unknown) => (item as { id?: string }).id !== id);
      }
      if (old && typeof old === 'object' && 'data' in (old as Record<string, unknown>)) {
        const obj = old as { data: unknown[] };
        return { ...obj, data: obj.data.filter((item: unknown) => (item as { id?: string }).id !== id) };
      }
      return old;
    });

    showUndoToast(
      `${entityLabel} deleted.`,
      // onUndo: restore previous data
      () => {
        queryClient.setQueryData(queryKey, previousData);
      },
      // onConfirm: execute actual delete
      () => {
        deleteFn(id).catch(() => {
          queryClient.setQueryData(queryKey, previousData);
        });
      },
    );
  };

  return { deleteWithUndo };
}
