import { useContext, useState } from 'react';
import { Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, Button, Spinner, EmptyState } from './index';

export interface Column<T> {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  meta?: { total: number; page: number; pageSize: number; totalPages: number };
  isLoading?: boolean;
  selected?: string[];
  onSelectionChange?: (ids: string[]) => void;
  getId: (item: T) => string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  onPageChange?: (page: number) => void;
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  error?: string | null;
  onRetry?: () => void;
  bulkActions?: React.ReactNode;
}

export default function DataTable<T extends Record<string, any>>({
  columns, data, meta, isLoading, selected, onSelectionChange, getId,
  searchValue, onSearchChange, searchPlaceholder = 'Search...',
  filters, emptyTitle = 'No data', emptyDescription = '', emptyAction,
  onPageChange, onSort, error, onRetry, bulkActions,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const allSelected = data.length > 0 && selected?.length === data.length;

  const handleSort = (key: string) => {
    const dir = sortKey === key && sortDir === 'asc' ? 'desc' : 'asc';
    setSortKey(key);
    setSortDir(dir);
    onSort?.(key, dir);
  };

  const toggleAll = () => {
    if (!onSelectionChange) return;
    onSelectionChange(allSelected ? [] : data.map(getId));
  };

  const toggleOne = (id: string) => {
    if (!onSelectionChange) return;
    onSelectionChange(
      selected?.includes(id)
        ? selected.filter((s) => s !== id)
        : [...(selected || []), id],
    );
  };

  if (error) {
    return (
      <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
        <span className="text-red-500 font-medium">Error:</span>
        <span className="text-sm text-red-700 flex-1">{error}</span>
        {onRetry && <Button variant="secondary" size="sm" onClick={onRetry}>Retry</Button>}
      </div>
    );
  }

  return (
    <div>
      {(onSearchChange || filters) && (
        <div className="flex flex-wrap gap-3 items-center mb-4">
          {onSearchChange && (
            <div className="flex-1 min-w-[200px] relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                placeholder={searchPlaceholder}
                value={searchValue || ''}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>
          )}
          {filters}
        </div>
      )}
      {bulkActions && selected && selected.length > 0 && (
        <div className="mb-3 flex items-center gap-2">
          <span className="text-sm text-gray-500">{selected.length} selected</span>
          {bulkActions}
        </div>
      )}
      {isLoading ? (
        <Spinner />
      ) : data.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {onSelectionChange && (
                    <th className="p-3 text-left w-8">
                      <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                    </th>
                  )}
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={`p-3 text-left font-medium text-gray-600 ${col.sortable ? 'cursor-pointer select-none hover:text-gray-900' : ''} ${col.className || ''}`}
                      onClick={() => col.sortable && handleSort(col.key)}
                    >
                      <div className="flex items-center gap-1">
                        <span>{col.label}</span>
                        {col.sortable && sortKey === col.key && (
                          sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((item) => (
                  <tr key={getId(item)} className="border-b border-gray-100 hover:bg-gray-50">
                    {onSelectionChange && (
                      <td className="p-3">
                        <input type="checkbox" checked={selected?.includes(getId(item)) || false} onChange={() => toggleOne(getId(item))} />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td key={col.key} className={`p-3 ${col.className || ''}`}>
                        {col.render ? col.render(item) : item[col.key] ?? '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {meta && meta.totalPages > 1 && onPageChange && (
            <div className="flex items-center justify-between p-3 border-t border-gray-200 text-sm text-gray-500">
              <span>Page {meta.page} of {meta.totalPages} ({meta.total} items)</span>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" disabled={meta.page <= 1} onClick={() => onPageChange(meta.page - 1)}>
                  <ChevronLeft size={14} /><span className="ml-1">Previous</span>
                </Button>
                <Button variant="secondary" size="sm" disabled={meta.page >= meta.totalPages} onClick={() => onPageChange(meta.page + 1)}>
                  <span className="mr-1">Next</span><ChevronRight size={14} />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
