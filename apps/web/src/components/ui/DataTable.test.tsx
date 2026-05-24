import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DataTable from './DataTable';

interface TestItem {
  id: string;
  name: string;
  email: string;
}

const columns = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'email', label: 'Email' },
];

const data: TestItem[] = [
  { id: '1', name: 'Alice', email: 'alice@test.com' },
  { id: '2', name: 'Bob', email: 'bob@test.com' },
];

const getId = (item: TestItem) => item.id;

describe('DataTable', () => {
  it('should render table with data', () => {
    render(<DataTable columns={columns} data={data} getId={getId} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('should show empty state when no data', () => {
    render(<DataTable columns={columns} data={[]} getId={getId} emptyTitle="No items" />);
    expect(screen.getByText('No items')).toBeInTheDocument();
  });

  it('should show spinner when loading', () => {
    const { container } = render(<DataTable columns={columns} data={[]} getId={getId} isLoading />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('should show error state', () => {
    render(<DataTable columns={columns} data={[]} getId={getId} error="Something went wrong" />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('should show search input when onSearchChange provided', () => {
    render(<DataTable columns={columns} data={data} getId={getId} onSearchChange={vi.fn()} />);
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
  });

  it('should call onSearchChange when typing', async () => {
    const onSearchChange = vi.fn();
    render(<DataTable columns={columns} data={data} getId={getId} onSearchChange={onSearchChange} />);
    const input = screen.getByPlaceholderText('Search...');
    fireEvent.change(input, { target: { value: 'Alice' } });
    expect(onSearchChange).toHaveBeenCalledWith('Alice');
  });

  it('should show pagination when meta has multiple pages', () => {
    const meta = { total: 50, page: 1, pageSize: 10, totalPages: 5 };
    render(<DataTable columns={columns} data={data} getId={getId} meta={meta} onPageChange={vi.fn()} />);
    expect(screen.getByText('Page 1 of 5 (50 items)')).toBeInTheDocument();
  });

  it('should call onPageChange on next/previous', () => {
    const onPageChange = vi.fn();
    const meta = { total: 50, page: 2, pageSize: 10, totalPages: 5 };
    render(<DataTable columns={columns} data={data} getId={getId} meta={meta} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByText('Previous'));
    expect(onPageChange).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByText('Next'));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('should render checkboxes when onSelectionChange provided', () => {
    render(<DataTable columns={columns} data={data} getId={getId} onSelectionChange={vi.fn()} />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(3); // header + 2 rows
  });

  it('should select all when header checkbox clicked', () => {
    const onSelectionChange = vi.fn();
    render(<DataTable columns={columns} data={data} getId={getId} onSelectionChange={onSelectionChange} />);
    const [headerCheckbox] = screen.getAllByRole('checkbox');
    fireEvent.click(headerCheckbox);
    expect(onSelectionChange).toHaveBeenCalledWith(['1', '2']);
  });

  it('should show bulk actions when items selected', () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        getId={getId}
        selected={['1']}
        onSelectionChange={vi.fn()}
        bulkActions={<button>Delete</button>}
      />,
    );
    expect(screen.getByText('1 selected')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('should render sort indicator and call onSort', () => {
    const onSort = vi.fn();
    render(<DataTable columns={columns} data={data} getId={getId} onSort={onSort} />);
    fireEvent.click(screen.getByText('Name'));
    expect(onSort).toHaveBeenCalledWith('name', 'asc');
  });

  it('should render filters slot', () => {
    render(<DataTable columns={columns} data={data} getId={getId} filters={<div>Status Filter</div>} />);
    expect(screen.getByText('Status Filter')).toBeInTheDocument();
  });
});
