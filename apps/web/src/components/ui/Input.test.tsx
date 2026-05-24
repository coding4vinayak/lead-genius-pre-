import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Input } from './index';

describe('Input', () => {
  it('should render with label', () => {
    render(<Input label="Name" name="name" />);
    expect(screen.getByText('Name')).toBeInTheDocument();
  });

  it('should render input element', () => {
    render(<Input label="Email" name="email" type="email" />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('should show error message', () => {
    render(<Input label="Name" name="name" error="Required" />);
    expect(screen.getByText('Required')).toBeInTheDocument();
  });

  it('should apply default value', () => {
    render(<Input label="Name" name="name" defaultValue="John" />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('John');
  });
});
