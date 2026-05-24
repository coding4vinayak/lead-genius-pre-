import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Select } from './index';

describe('Select', () => {
  const options = ['option1', 'option2', 'option3'];

  it('should render with label', () => {
    render(<Select label="Status" options={options} />);
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('should render select element with options', () => {
    render(<Select options={options} />);
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    expect(screen.getByText('option1')).toBeInTheDocument();
    expect(screen.getByText('option2')).toBeInTheDocument();
    expect(screen.getByText('option3')).toBeInTheDocument();
  });

  it('should render with object options', () => {
    const objOptions = [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
    ];
    render(<Select options={objOptions} />);
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('should show error message', () => {
    render(<Select label="Status" options={options} error="Required field" />);
    expect(screen.getByText('Required field')).toBeInTheDocument();
  });

  it('should support value selection', async () => {
    const user = userEvent.setup();
    render(<Select options={options} />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;

    await user.selectOptions(select, 'option2');
    expect(select.value).toBe('option2');
  });

  it('should render without label', () => {
    const { container } = render(<Select options={options} />);
    expect(container.querySelector('label')).toBeNull();
  });
});
