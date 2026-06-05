import { useContext, useState } from 'react';
import { Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, Button, Spinner, EmptyState, Skeleton } from './index';

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
      <div className="flex items-center gap-3 p-4 bg-[var(--color-error-bg)] border border-[var(--color-error)]/30 rounded-lg">
        <span className="text-[var(--color-error)] font-medium shrink-0">Error:</span>
        <span className="text-sm text-[var(--color-text)] flex-1">{error}</span>
        {onRetry && <Button variant="secondary" size="sm" onClick={onRetry}>Retry</Button>}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div>
        {(onSearchChange || filters) && (
          <div className="flex flex-wrap gap-3 items-center mb-4">
            {onSearchChange && (
              <div className="flex-1 min-w-[200px] relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
                <div className="skeleton h-10 w-full" />
              </div>
            )}
          </div>
        )}
        <Card className="overflow-hidden">
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-5 w-5 rounded" />
                {columns.map((col) => (
                  <Skeleton key={col.key} className="h-5 flex-1" />
                ))}
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div>
        {(onSearchChange || filters) && (
          <div className="flex flex-wrap gap-3 items-center mb-4">
            {onSearchChange && (
              <div className="flex-1 min-w-[200px] relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
                <input
                  className="w-full pl-9 pr-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                  placeholder={searchPlaceholder}
                  value={searchValue || ''}
                  onChange={(e) => onSearchChange(e.target.value)}
                />
              </div>
            )}
            {filters}
          </div>
        )}
        <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {(onSearchChange || filters) && (
        <div className="flex flex-wrap gap-3 items-center mb-4">
          {onSearchChange && (
            <div className="flex-1 min-w-[200px] relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
              <input
                className="w-full pl-9 pr-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-colors"
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
        <div className="mb-3 flex items-center gap-2 animate-fade-in">
          <span className="text-sm text-[var(--color-text-secondary)]">{selected.length} selected</span>
          {bulkActions}
        </div>
      )}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-secondary)]">
                {onSelectionChange && (
                  <th className="p-3 text-left w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                    />
                  </th>
                )}
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`p-3 text-left font-medium text-[var(--color-text-secondary)] text-xs uppercase tracking-wider ${col.sortable ? 'cursor-pointer select-none hover:text-[var(--color-text)]' : ''} ${col.className || ''}`}
                    onClick={() => col.sortable && handleSort(col.key)}
                  >
                    <div className="flex items-center gap-1">
                      <span>{col.label}</span>
                      {col.sortable && sortKey === col.key && (
                        sortDir === 'asc' ? <ChevronUp size={14} className="text-[var(--color-primary)]" /> : <ChevronDown size={14} className="text-[var(--color-primary)]" />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((item, idx) => (
                <tr
                  key={getId(item)}
                  className="border-b border-[var(--color-border-light)] hover:bg-[var(--color-surface-secondary)] transition-colors animate-fade-in"
                  style={{ animationDelay: `${idx * 30}ms`, animationFillMode: 'backwards' }}
                >
                  {onSelectionChange && (
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selected?.includes(getId(item)) || false}
                        onChange={() => toggleOne(getId(item))}
                        className="rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key} className={`p-3 text-[var(--color-text)] ${col.className || ''}`}>
                      {col.render ? col.render(item) : <span className="text-[var(--color-text-secondary)]">{item[col.key] ?? '—'}</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {meta && meta.totalPages > 1 && onPageChange && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 border-t border-[var(--color-border)] text-sm text-[var(--color-text-secondary)]">
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
      </Card>
    </div>
  );
}
